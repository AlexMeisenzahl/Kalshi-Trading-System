/**
 * wallet.ts
 * ---------
 * kalshi-claw wallet status   — Show balance + API key info
 */

import { KalshiClient } from "../lib/kalshiClient";
import { loadConfig }   from "./config";
import { printSuccess, printError, printInfo } from "../lib/display";

export async function runWallet(sub: string): Promise<void> {
  const cfg    = loadConfig();
  const client = new KalshiClient(cfg.kalshi);

  switch (sub) {
    case "status": {
      printInfo("Fetching Kalshi account info…");
      try {
        const { available, pnl } = await client.getBalance();
        console.log(`
  API Key:      ${cfg.kalshi.apiKey.slice(0, 8)}…
  Environment:  ${cfg.kalshi.useDemo ? "DEMO (paper money)" : "PRODUCTION (real money)"}
  Available:    $${(available / 100).toFixed(2)}
  Lifetime P&L: $${(pnl       / 100).toFixed(2)}
        `);
        printSuccess("Wallet status OK");
      } catch (err: any) {
        printError(`Could not fetch balance: ${err?.message}`);
        printInfo("Check KALSHI_API_KEY and KALSHI_PRIVATE_KEY in your environment");
      }
      break;
    }
    default:
      console.log("Usage: wallet status");
  }
}
