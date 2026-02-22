/**
 * hedge.ts
 * --------
 * kalshi-claw hedge scan [--query "topic"] [--limit 20]
 * kalshi-claw hedge analyze <tickerA> <tickerB>
 *
 * Uses the Rust core to pre-score pairs by price complementarity,
 * then sends actionable pairs to the LLM for logical validation.
 */

import { KalshiClient } from "../lib/kalshiClient";
import { LLMClient }    from "../lib/llmClient";
import { loadConfig }   from "./config";
import { printHedgeTable, printInfo, printSuccess, printWarn, printError } from "../lib/display";

// Try Rust core for batch scoring
let rustCore: any = null;
try { rustCore = require("../kalshi_claw_core.node"); } catch {}

function pairMarkets(markets: any[]): Array<[any, any]> {
  const pairs: Array<[any, any]> = [];
  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      pairs.push([markets[i], markets[j]]);
    }
  }
  return pairs;
}

function parseArgs(args: string[]): { query?: string; limit: number; includeWeak: boolean } {
  let query: string | undefined;
  let limit = 20;
  let includeWeak = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--query" && args[i + 1]) query = args[++i];
    if (args[i] === "--limit" && args[i + 1]) limit = parseInt(args[++i]);
    if (args[i] === "--include-weak") includeWeak = true;
  }
  return { query, limit, includeWeak };
}

export async function runHedge(sub: string, args: string[]): Promise<void> {
  const cfg    = loadConfig();
  const client = new KalshiClient(cfg.kalshi);
  const llm    = new LLMClient(cfg.openrouterApiKey, cfg.llmModel);

  switch (sub) {
    case "scan": {
      const { query, limit, includeWeak } = parseArgs(args);

      printInfo(query
        ? `Scanning markets matching "${query}"…`
        : `Scanning top ${limit} trending markets…`);

      let markets: any[];
      if (query) {
        markets = await client.searchMarkets(query, limit);
      } else {
        markets = await client.getTrendingMarkets(limit);
      }

      if (markets.length < 2) {
        printError("Not enough markets to form pairs.");
        return;
      }

      const pairs = pairMarkets(markets);
      printInfo(`Formed ${pairs.length} pairs — pre-scoring with Rust core…`);

      // Rust batch scoring
      let scored: any[] = [];
      if (rustCore?.scan_hedge_pairs) {
        const input = pairs.map(([a, b]) => ({
          market_a_id: a.ticker,
          market_b_id: b.ticker,
          yes_ask_a:   a.yes_ask ?? 0.5,
          no_ask_b:    b.no_ask  ?? 0.5,
        }));
        scored = rustCore.scan_hedge_pairs(input, includeWeak);
      } else {
        // Pure-TS fallback
        scored = pairs.flatMap(([a, b]) => {
          const yesA   = a.yes_ask ?? 0.5;
          const noB    = b.no_ask  ?? 0.5;
          const comb   = yesA + noB;
          const pA     = yesA;
          const pB     = noB;
          const cov    = 1 - (1 - pA) * (1 - pB);
          const tier   = cov >= 0.95 ? "T1 (HIGH ≥95%)"
                       : cov >= 0.90 ? "T2 (GOOD 90–95%)"
                       : cov >= 0.85 ? "T3 (MODERATE 85–90%)"
                       : "WEAK (<85%)";
          if (!includeWeak && cov < 0.85) return [];
          return [{ market_a_id: a.ticker, market_b_id: b.ticker, combined_cost: comb, coverage: cov, net_edge: cov - comb, tier, actionable: cov >= 0.85 }];
        });
      }

      const actionable = scored.filter((s: any) => s.actionable);
      printSuccess(`${actionable.length} actionable pair(s) above threshold`);

      if (!actionable.length) {
        printWarn("No strong hedges found. Try a broader query or --include-weak.");
        return;
      }

      printInfo(`Sending ${Math.min(actionable.length, 10)} pairs to LLM for logical validation…`);
      const top = actionable.slice(0, 10);

      // Enrich with market titles for LLM context
      const titleMap: Record<string, string> = {};
      markets.forEach((m) => { titleMap[m.ticker] = m.title; });

      const validated = await Promise.all(
        top.map(async (h: any) => {
          const analysis = await llm.analyzeHedgePair(
            titleMap[h.market_a_id] ?? h.market_a_id,
            h.market_a_id,
            titleMap[h.market_b_id] ?? h.market_b_id,
            h.market_b_id,
          );
          return {
            ...h,
            tier:      analysis.coverage + " " + (analysis.isHedge ? "✓" : "✗"),
            reasoning: analysis.reasoning,
            llm_ok:    analysis.isHedge,
          };
        })
      );

      const confirmed = validated.filter((h: any) => h.llm_ok);
      printSuccess(`LLM confirmed ${confirmed.length} / ${top.length} as valid hedges`);
      printHedgeTable(confirmed.length ? confirmed : validated);
      break;
    }

    case "analyze": {
      const [tickerA, tickerB] = args;
      if (!tickerA || !tickerB) {
        console.log("Usage: hedge analyze <tickerA> <tickerB>");
        return;
      }
      printInfo(`Fetching markets ${tickerA} and ${tickerB}…`);
      const [mA, mB] = await Promise.all([
        client.getMarket(tickerA),
        client.getMarket(tickerB),
      ]);

      const analysis = await llm.analyzeHedgePair(mA.title, tickerA, mB.title, tickerB);
      console.log(`\n  Market A: ${mA.title}`);
      console.log(`  Market B: ${mB.title}`);
      console.log(`  Is hedge: ${analysis.isHedge ? "YES" : "NO"}`);
      console.log(`  Coverage: ${analysis.coverage}`);
      console.log(`  Reasoning: ${analysis.reasoning}`);
      console.log(`  Confidence: ${(analysis.confidence * 100).toFixed(0)}%\n`);
      break;
    }

    default:
      console.log("Usage: hedge scan [--query \"topic\"] [--limit 20] | hedge analyze <tickerA> <tickerB>");
  }
}
