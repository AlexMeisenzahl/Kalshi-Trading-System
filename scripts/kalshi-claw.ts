#!/usr/bin/env node
/**
 * kalshi-claw.ts
 * ==============
 * CLI dispatcher for Kalshi-Claw.
 *
 * Usage:
 *   npx tsx scripts/kalshi-claw.ts markets trending
 *   npx tsx scripts/kalshi-claw.ts markets search "fed rate"
 *   npx tsx scripts/kalshi-claw.ts market KXBTC-24DEC31-B100000
 *   npx tsx scripts/kalshi-claw.ts buy KXBTC-24DEC31-B100000 YES 50
 *   npx tsx scripts/kalshi-claw.ts positions
 *   npx tsx scripts/kalshi-claw.ts wallet status
 *   npx tsx scripts/kalshi-claw.ts hedge scan
 *   npx tsx scripts/kalshi-claw.ts hedge scan --query "election"
 *   npx tsx scripts/kalshi-claw.ts hedge analyze TICKER_A TICKER_B
 */

import { runMarkets }   from "./markets";
import { runWallet }    from "./wallet";
import { runTrade }     from "./trade";
import { runPositions } from "./positions";
import { runHedge }     from "./hedge";
import { printBanner, printError } from "../lib/display";

const args    = process.argv.slice(2);
const command = args[0] ?? "";
const sub     = args[1] ?? "";

const DRY_RUN = process.env.DRY_RUN !== "false";
const DEMO    = process.env.KALSHI_USE_DEMO !== "false";

printBanner(DRY_RUN, DEMO);

(async () => {
  try {
    switch (command) {
      case "markets":
        await runMarkets(sub, args.slice(2));
        break;

      case "market":
        await runMarkets("single", [sub]);
        break;

      case "buy":
        // buy <ticker> <YES|NO> <amount>
        await runTrade({
          ticker: sub,
          side:   (args[2] ?? "yes").toLowerCase() as "yes" | "no",
          amount: parseFloat(args[3] ?? "10"),
          dryRun: DRY_RUN,
        });
        break;

      case "sell":
        await runTrade({
          ticker: sub,
          side:   (args[2] ?? "yes").toLowerCase() as "yes" | "no",
          amount: parseFloat(args[3] ?? "0"),
          action: "sell",
          dryRun: DRY_RUN,
        });
        break;

      case "positions":
        await runPositions(sub, args.slice(2));
        break;

      case "wallet":
        await runWallet(sub);
        break;

      case "hedge":
        await runHedge(sub, args.slice(2));
        break;

      default:
        printError(`Unknown command: ${command || "(none)"}`);
        console.log(`
Available commands:
  markets trending                  — Top markets by volume
  markets search "<query>"          — Search markets by keyword
  market <ticker>                   — Market details + orderbook
  buy <ticker> YES|NO <amount>      — Buy a position (USD)
  sell <ticker> YES|NO              — Sell a position
  positions                         — List open positions with P&L
  positions <ticker>                — Single position detail
  wallet status                     — Show API key + balance
  hedge scan [--query "topic"]      — LLM-powered hedge discovery
  hedge scan --limit <n>            — Scan top N markets
  hedge analyze <tickerA> <tickerB> — Analyse specific market pair
        `);
        process.exit(1);
    }
  } catch (err: any) {
    printError(err?.message ?? String(err));
    process.exit(1);
  }
})();
