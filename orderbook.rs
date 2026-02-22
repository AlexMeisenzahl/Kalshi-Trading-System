/*!
 * orderbook.rs
 * ------------
 * Parses raw Kalshi orderbook JSON and computes best bid / ask / mid prices.
 * All arithmetic is done in Rust to avoid JS floating-point overhead when
 * scanning hundreds of markets.
 */

#[derive(Debug, Clone)]
pub struct OrderLevel {
    pub price: f64,   // fractional (0.0 – 1.0)
    pub qty:   u64,   // number of contracts
}

#[derive(Debug, Clone)]
pub struct ParsedBook {
    pub yes_bid: f64,
    pub yes_ask: f64,
    pub no_bid:  f64,
    pub no_ask:  f64,
    pub spread:  f64,
    pub mid:     f64,
}

/// Parse a flat `[[price_cents, qty], …]` array (Kalshi wire format).
pub fn parse_levels(raw: &[[u64; 2]]) -> Vec<OrderLevel> {
    raw.iter()
        .map(|l| OrderLevel {
            price: l[0] as f64 / 100.0,
            qty:   l[1],
        })
        .filter(|l| l.qty > 0)
        .collect()
}

/// Compute best bid (highest price buyer will pay) from a YES bid ladder.
pub fn best_bid(levels: &[OrderLevel]) -> f64 {
    levels
        .iter()
        .map(|l| l.price)
        .fold(f64::NEG_INFINITY, f64::max)
        .max(0.001)
}

/// Compute best ask (lowest price seller will accept).
/// In Kalshi, YES asks are stored as NO bids: ask = 1 - best_no_bid.
pub fn best_ask_from_no_bids(no_levels: &[OrderLevel]) -> f64 {
    let best_no_bid = best_bid(no_levels);
    (1.0 - best_no_bid).clamp(0.001, 0.999)
}

/// Build a full parsed book from the Kalshi orderbook response.
pub fn compute_book(yes_bids_raw: &[[u64; 2]], no_bids_raw: &[[u64; 2]]) -> ParsedBook {
    let yes_bids = parse_levels(yes_bids_raw);
    let no_bids  = parse_levels(no_bids_raw);

    let yes_bid = best_bid(&yes_bids).clamp(0.001, 0.999);
    let yes_ask = best_ask_from_no_bids(&no_bids);
    let no_bid  = best_bid(&no_bids).clamp(0.001, 0.999);
    let no_ask  = (1.0 - yes_bid).clamp(0.001, 0.999);
    let spread  = (yes_ask - yes_bid).max(0.0);
    let mid     = (yes_bid + yes_ask) / 2.0;

    ParsedBook { yes_bid, yes_ask, no_bid, no_ask, spread, mid }
}

/// Convert a fractional price to Kalshi cents (rounded to nearest integer).
pub fn to_cents(price: f64) -> u32 {
    (price * 100.0).round() as u32
}

/// Number of contracts to buy for a target USD notional at given price.
pub fn contracts_for(usd: f64, price_frac: f64) -> u64 {
    if price_frac <= 0.0 { return 0; }
    (usd / price_frac).floor() as u64
}

// ── napi-rs bindings ─────────────────────────────────────────────────────────
#[cfg(feature = "napi")]
mod napi_bindings {
    use napi::bindgen_prelude::*;
    use napi_derive::napi;
    use super::*;

    #[napi(object)]
    pub struct JsBook {
        pub yes_bid: f64,
        pub yes_ask: f64,
        pub no_bid:  f64,
        pub no_ask:  f64,
        pub spread:  f64,
        pub mid:     f64,
    }

    /// Parse a Kalshi orderbook from JSON arrays of [price_cents, qty] pairs.
    #[napi]
    pub fn parse_orderbook(
        yes_bids: Vec<Vec<u32>>,
        no_bids:  Vec<Vec<u32>>,
    ) -> JsBook {
        let yb: Vec<[u64; 2]> = yes_bids.iter().map(|v| [v[0] as u64, v[1] as u64]).collect();
        let nb: Vec<[u64; 2]> = no_bids.iter().map(|v| [v[0] as u64, v[1] as u64]).collect();
        let b = compute_book(&yb, &nb);
        JsBook {
            yes_bid: b.yes_bid,
            yes_ask: b.yes_ask,
            no_bid:  b.no_bid,
            no_ask:  b.no_ask,
            spread:  b.spread,
            mid:     b.mid,
        }
    }

    #[napi]
    pub fn price_to_cents(price: f64) -> u32 {
        to_cents(price)
    }

    #[napi]
    pub fn contracts_to_buy(usd: f64, price: f64) -> u32 {
        contracts_for(usd, price) as u32
    }
}
