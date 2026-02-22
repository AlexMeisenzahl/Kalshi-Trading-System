/**
 * trade.ts
 * --------
 * kalshi-claw buy <ticker> YES|NO <amount>
 * kalshi-claw sell <ticker> YES|NO
 *
 * Kalshi is a centralised exchange — no CTF / token split needed.
 * We simply submit a limit order at the current ask price.
 * The Rust core computes contract count via Kelly-aware sizing.
 */

import { KalshiClient }     from "../lib/kalshiClient";
import { addPosition }      from "../lib/positionStorage";
import { loadConfig }       from "./config";
import { printSuccess, printError, printInfo, printWarn } from "../lib/display";

// Try to use Rust core for sizing; fall back to TS if not compiled.
let rustCore: any = null;
try { rustCore = require("../kalshi_claw_core.node"); } catch {}

interface TradeOpts {
  ticker: string;
  side:   "yes" | "no";
  amount: number;   // USD
  action?: "buy" | "sell";
  dryRun: boolean;
}

export async function runTrade(opts: TradeOpts): Promise<void> {
  const cfg    = loadConfig();
  const client = new KalshiClient(cfg.kalshi);
  const action = opts.action ?? "buy";

  printInfo(`Fetching orderbook for ${opts.ticker}…`);
  const market = await client.getMarket(opts.ticker);
  const ob     = await client.getOrderBook(opts.ticker);

  // Determine ask price for the chosen side
  const askPrice = opts.side === "yes" ? market.yes_ask : market.no_ask;
  const priceCents = Math.ceil(askPrice * 100);

  // Contract count
  let contracts: number;
  if (rustCore?.contracts_to_buy) {
    contracts = rustCore.contracts_to_buy(opts.amount, askPrice);
  } else {
    contracts = Math.floor(opts.amount / askPrice);
  }

  if (contracts < 1) {
    printError(`Amount $${opts.amount} too small at price ${priceCents}¢`);
    return;
  }

  const netCost = contracts * askPrice;

  if (opts.dryRun) {
    printWarn("DRY RUN — no real order placed");
  }

  console.log(`
  Market:    ${market.title}
  Ticker:    ${opts.ticker}
  Action:    ${action.toUpperCase()} ${opts.side.toUpperCase()}
  Price:     ${priceCents}¢ per contract
  Contracts: ${contracts}
  Net cost:  $${netCost.toFixed(2)}
  `);

  const result = await client.placeOrder({
    ticker:  opts.ticker,
    side:    opts.side,
    action,
    count:   contracts,
    price:   priceCents,
    dryRun:  opts.dryRun,
  });

  if (result.status === "dry_run" || result.status === "resting" || result.status === "executed") {
    printSuccess(`Order ${result.order_id} → ${result.status}`);

    if (action === "buy") {
      addPosition({
        id:          result.order_id,
        ticker:      opts.ticker,
        side:        opts.side,
        contracts,
        entry_price: askPrice,
        opened_at:   new Date().toISOString(),
      });
      printSuccess("Position recorded in ~/.kalshi-claw/positions.json");
    }
  } else {
    printError(`Unexpected order status: ${result.status}`);
  }
}
