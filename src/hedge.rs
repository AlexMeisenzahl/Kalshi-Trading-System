/*!
 * hedge.rs
 * --------
 * Hedge opportunity scoring for Kalshi markets.
 *
 * A hedge exists when two market outcomes are logically complementary:
 *   "Event A happens"  ←→  "Event A does NOT happen at a related market"
 *
 * Coverage = probability that buying both positions guarantees at least one payout.
 * We compute this from current mid-prices without LLM, then tier the result.
 * The TypeScript layer feeds pairs to an LLM for qualitative validation.
 */

#[derive(Debug, Clone, PartialEq)]
pub enum CoverageTier {
    T1,       // ≥ 95% — near-arbitrage
    T2,       // 90–95% — strong hedge
    T3,       // 85–90% — moderate hedge
    Weak,     // < 85% — filtered by default
}

impl CoverageTier {
    pub fn label(&self) -> &'static str {
        match self {
            CoverageTier::T1   => "T1 (HIGH ≥95%)",
            CoverageTier::T2   => "T2 (GOOD 90–95%)",
            CoverageTier::T3   => "T3 (MODERATE 85–90%)",
            CoverageTier::Weak => "WEAK (<85%)",
        }
    }
}

#[derive(Debug, Clone)]
pub struct HedgeScore {
    pub market_a_id:    String,
    pub market_b_id:    String,
    pub yes_price_a:    f64,
    pub no_price_b:     f64,
    pub combined_cost:  f64,
    pub coverage:       f64,
    pub net_edge:       f64,   // coverage - combined_cost (positive = profitable)
    pub tier:           CoverageTier,
}

impl HedgeScore {
    pub fn is_actionable(&self) -> bool {
        matches!(self.tier, CoverageTier::T1 | CoverageTier::T2 | CoverageTier::T3)
    }
}

/// Score a potential hedge pair.
///
/// `yes_mid_a` — mid-price for YES on market A (the target outcome)
/// `no_mid_b`  — mid-price for NO on market B (the covering outcome)
pub fn score_hedge(
    market_a_id: &str,
    market_b_id: &str,
    yes_ask_a:   f64,
    no_ask_b:    f64,
) -> HedgeScore {
    let combined = (yes_ask_a + no_ask_b).clamp(0.01, 2.0);

    // Coverage: fraction of scenarios where at least one leg pays out.
    // Approximation: 1 - P(neither pays) ≈ 1 - (1 - yes_ask_a)(1 - no_ask_b)
    // For true complement pairs this approaches 1.0 minus slippage.
    let p_a   = yes_ask_a.clamp(0.01, 0.99);
    let p_b   = no_ask_b.clamp(0.01, 0.99);
    let coverage = 1.0 - (1.0 - p_a) * (1.0 - p_b);
    let coverage = coverage.clamp(0.0, 1.0);

    let net_edge = coverage - combined;

    let tier = if coverage >= 0.95 {
        CoverageTier::T1
    } else if coverage >= 0.90 {
        CoverageTier::T2
    } else if coverage >= 0.85 {
        CoverageTier::T3
    } else {
        CoverageTier::Weak
    };

    HedgeScore {
        market_a_id:   market_a_id.to_string(),
        market_b_id:   market_b_id.to_string(),
        yes_price_a:   yes_ask_a,
        no_price_b:    no_ask_b,
        combined_cost: combined,
        coverage,
        net_edge,
        tier,
    }
}

/// Batch-score a list of (market_a_id, market_b_id, yes_ask_a, no_ask_b) tuples.
/// Returns only actionable hedges (T1/T2/T3), sorted by coverage descending.
pub fn scan_hedges(
    pairs: &[(String, String, f64, f64)],
    include_weak: bool,
) -> Vec<HedgeScore> {
    let mut scored: Vec<HedgeScore> = pairs
        .iter()
        .map(|(a, b, ya, nb)| score_hedge(a, b, *ya, *nb))
        .filter(|s| include_weak || s.is_actionable())
        .collect();

    scored.sort_by(|a, b| b.coverage.partial_cmp(&a.coverage).unwrap());
    scored
}

// ── napi-rs bindings ─────────────────────────────────────────────────────────
#[cfg(feature = "napi")]
mod napi_bindings {
    use napi::bindgen_prelude::*;
    use napi_derive::napi;
    use super::*;

    #[napi(object)]
    pub struct JsHedgeScore {
        pub market_a_id:    String,
        pub market_b_id:    String,
        pub yes_price_a:    f64,
        pub no_price_b:     f64,
        pub combined_cost:  f64,
        pub coverage:       f64,
        pub net_edge:       f64,
        pub tier:           String,
        pub actionable:     bool,
    }

    #[napi(object)]
    pub struct JsHedgePair {
        pub market_a_id: String,
        pub market_b_id: String,
        pub yes_ask_a:   f64,
        pub no_ask_b:    f64,
    }

    #[napi]
    pub fn score_hedge_pair(
        market_a_id: String,
        market_b_id: String,
        yes_ask_a:   f64,
        no_ask_b:    f64,
    ) -> JsHedgeScore {
        let s = score_hedge(&market_a_id, &market_b_id, yes_ask_a, no_ask_b);
        JsHedgeScore {
            market_a_id:    s.market_a_id,
            market_b_id:    s.market_b_id,
            yes_price_a:    s.yes_price_a,
            no_price_b:     s.no_price_b,
            combined_cost:  s.combined_cost,
            coverage:       s.coverage,
            net_edge:       s.net_edge,
            tier:           s.tier.label().to_string(),
            actionable:     s.is_actionable(),
        }
    }

    #[napi]
    pub fn scan_hedge_pairs(pairs: Vec<JsHedgePair>, include_weak: bool) -> Vec<JsHedgeScore> {
        let raw: Vec<(String, String, f64, f64)> = pairs
            .into_iter()
            .map(|p| (p.market_a_id, p.market_b_id, p.yes_ask_a, p.no_ask_b))
            .collect();
        scan_hedges(&raw, include_weak)
            .into_iter()
            .map(|s| JsHedgeScore {
                market_a_id:    s.market_a_id,
                market_b_id:    s.market_b_id,
                yes_price_a:    s.yes_price_a,
                no_price_b:     s.no_price_b,
                combined_cost:  s.combined_cost,
                coverage:       s.coverage,
                net_edge:       s.net_edge,
                tier:           s.tier.label().to_string(),
                actionable:     s.is_actionable(),
            })
            .collect()
    }
}
