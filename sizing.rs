/*!
 * sizing.rs
 * ---------
 * Position sizing utilities: Kelly criterion, bankroll-aware bet sizing,
 * and contract count computation for Kalshi orders.
 */

/// Full Kelly fraction for a binary bet.
///
/// `p`    — estimated probability of winning (0.0 – 1.0)
/// `odds` — payout odds (Kalshi YES: 1/price - 1)
pub fn kelly_full(p: f64, odds: f64) -> f64 {
    if odds <= 0.0 || p <= 0.0 || p >= 1.0 {
        return 0.0;
    }
    // f* = (p * odds - (1 - p)) / odds
    let f = (p * odds - (1.0 - p)) / odds;
    f.clamp(0.0, 1.0)
}

/// Fractional Kelly (recommended: 0.25 = quarter-Kelly for safety).
pub fn kelly_fractional(p: f64, odds: f64, fraction: f64) -> f64 {
    kelly_full(p, odds) * fraction.clamp(0.0, 1.0)
}

/// Dollar bet size given bankroll, Kelly fraction, and hard cap.
pub fn dollar_size(bankroll: f64, kelly_f: f64, max_bet: f64) -> f64 {
    (bankroll * kelly_f).min(max_bet).max(1.0)
}

/// Kalshi payout odds for a YES position at given ask price.
/// If you pay `price` and win, you receive $1 → net profit = 1 - price → odds = (1 - price) / price
pub fn kalshi_yes_odds(yes_ask: f64) -> f64 {
    if yes_ask >= 1.0 { return 0.0; }
    (1.0 - yes_ask) / yes_ask
}

/// Number of contracts to buy for a target USD size at given ask price.
/// Kalshi: 1 contract = $0.01 face value, price in cents.
pub fn contract_count(usd: f64, price_frac: f64) -> u64 {
    if price_frac <= 0.0 { return 0; }
    (usd / price_frac).floor() as u64
}

/// Recommended sizing struct for a single Kalshi position.
#[derive(Debug, Clone)]
pub struct SizingResult {
    pub kelly_full:     f64,
    pub kelly_quarter:  f64,
    pub dollar_size:    f64,
    pub contracts:      u64,
    pub max_profit:     f64,
    pub max_loss:       f64,
}

pub fn size_position(
    estimated_prob: f64,
    yes_ask:        f64,
    bankroll:       f64,
    max_bet:        f64,
) -> SizingResult {
    let odds      = kalshi_yes_odds(yes_ask);
    let kf        = kelly_full(estimated_prob, odds);
    let kq        = kelly_fractional(estimated_prob, odds, 0.25);
    let dollars   = dollar_size(bankroll, kq, max_bet);
    let contracts = contract_count(dollars, yes_ask);
    let max_profit = contracts as f64 * (1.0 - yes_ask);
    let max_loss   = contracts as f64 * yes_ask;

    SizingResult {
        kelly_full:    kf,
        kelly_quarter: kq,
        dollar_size:   dollars,
        contracts,
        max_profit,
        max_loss,
    }
}

// ── napi-rs bindings ─────────────────────────────────────────────────────────
#[cfg(feature = "napi")]
mod napi_bindings {
    use napi::bindgen_prelude::*;
    use napi_derive::napi;
    use super::*;

    #[napi(object)]
    pub struct JsSizingResult {
        pub kelly_full:     f64,
        pub kelly_quarter:  f64,
        pub dollar_size:    f64,
        pub contracts:      u32,
        pub max_profit:     f64,
        pub max_loss:       f64,
    }

    /// Compute recommended Kalshi position sizing.
    ///
    /// `estimated_prob` — your probability estimate for YES (0.0 – 1.0)
    /// `yes_ask`        — current YES ask price (0.0 – 1.0)
    /// `bankroll`       — total available capital in USD
    /// `max_bet`        — hard cap per trade in USD
    #[napi]
    pub fn kelly_size(
        estimated_prob: f64,
        yes_ask:        f64,
        bankroll:       f64,
        max_bet:        f64,
    ) -> JsSizingResult {
        let r = size_position(estimated_prob, yes_ask, bankroll, max_bet);
        JsSizingResult {
            kelly_full:    r.kelly_full,
            kelly_quarter: r.kelly_quarter,
            dollar_size:   r.dollar_size,
            contracts:     r.contracts as u32,
            max_profit:    r.max_profit,
            max_loss:      r.max_loss,
        }
    }

    #[napi]
    pub fn yes_odds(yes_ask: f64) -> f64 {
        kalshi_yes_odds(yes_ask)
    }
}
