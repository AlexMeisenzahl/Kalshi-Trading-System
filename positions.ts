/**
 * positions.ts
 * ------------
 * kalshi-claw positions             — all open positions
 * kalshi-claw positions <ticker>    — single position detail
 */

import { KalshiClient }                 from "../lib/kalshiClient";
import { loadPositions, enrichWithPnl } from "../lib/positionStorage";
import { loadConfig }                   from "./config";
import { printPositionTable, printInfo, printSuccess, printError } from "../lib/display";

export async function runPositions(ticker: string, _args: string[]): Promise<void> {
  const cfg        = loadConfig();
  const client     = new KalshiClient(cfg.kalshi);
  const positions  = loadPositions();

  if (!positions.length) {
    console.log("  No open positions tracked in ~/.kalshi-claw/positions.json\n");
    return;
  }

  // Fetch live prices for all held tickers
  const tickers   = [...new Set(positions.map((p) => p.ticker))];
  const priceMap: Record<string, number> = {};

  printInfo(`Fetching live prices for ${tickers.length} markets…`);
  await Promise.all(
    tickers.map(async (t) => {
      try {
        const m = await client.getMarket(t);
        priceMap[t] = m.yes_ask;
      } catch {
        // leave missing
      }
    })
  );

  const enriched = enrichWithPnl(positions, priceMap);

  if (ticker) {
    const pos = enriched.filter((p) => p.ticker === ticker);
    if (!pos.length) {
      printError(`No position found for ${ticker}`);
      return;
    }
    printPositionTable(pos);
  } else {
    printSuccess(`${enriched.length} open position(s)`);
    printPositionTable(enriched);
  }

  // Summary
  const totalPnl = enriched.reduce((acc, p) => acc + (p.pnl ?? 0), 0);
  console.log(`  Total unrealised P&L: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}\n`);
}
