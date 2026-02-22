/**
 * markets.ts
 * ----------
 * kalshi-claw markets trending
 * kalshi-claw markets search "<query>"
 * kalshi-claw market <ticker>
 */

import { KalshiClient } from "../lib/kalshiClient";
import { loadConfig }   from "./config";
import { printMarketTable, printInfo, printSuccess } from "../lib/display";

export async function runMarkets(sub: string, args: string[]): Promise<void> {
  const cfg    = loadConfig();
  const client = new KalshiClient(cfg.kalshi);

  switch (sub) {
    case "trending": {
      printInfo("Fetching trending Kalshi markets by 24h volume…");
      const markets = await client.getTrendingMarkets(25);
      printSuccess(`Found ${markets.length} markets`);
      printMarketTable(markets);
      break;
    }

    case "search": {
      const query = args[0] ?? "";
      if (!query) { console.log("Usage: markets search \"<query>\""); break; }
      printInfo(`Searching markets for: "${query}"…`);
      const markets = await client.searchMarkets(query, 20);
      printSuccess(`Found ${markets.length} matching markets`);
      printMarketTable(markets);
      break;
    }

    case "single": {
      const ticker = args[0] ?? "";
      if (!ticker) { console.log("Usage: market <ticker>"); break; }
      printInfo(`Fetching market: ${ticker}…`);
      const m = await client.getMarket(ticker);
      const ob = await client.getOrderBook(ticker);

      console.log(`\n  ${m.title}`);
      console.log(`  Ticker:      ${m.ticker}`);
      console.log(`  Event:       ${m.event_ticker}`);
      console.log(`  YES ask:     ${(m.yes_ask * 100).toFixed(0)}¢`);
      console.log(`  YES bid:     ${(m.yes_bid * 100).toFixed(0)}¢`);
      console.log(`  NO ask:      ${(m.no_ask  * 100).toFixed(0)}¢`);
      console.log(`  Volume:      ${(m.volume ?? 0).toLocaleString()}`);
      console.log(`  Closes:      ${m.close_time}`);
      console.log(`  Status:      ${m.status}`);
      console.log(`\n  Orderbook YES bids: ${ob.yes.length} levels`);
      console.log(`  Orderbook NO  bids: ${ob.no.length} levels`);
      console.log(`\n  https://kalshi.com/markets/${m.event_ticker}/${m.ticker}\n`);
      break;
    }

    default:
      console.log("Usage: markets trending | markets search \"<query>\"");
  }
}
