/**
 * config.ts
 * ---------
 * Read configuration from environment variables (set via openclaw.json
 * or directly via export before running).
 */

import * as fs   from "fs";
import * as path from "path";
import * as os   from "os";

export interface Config {
  kalshi: {
    apiKey:     string;
    privateKey: string;
    useDemo:    boolean;
  };
  openrouterApiKey: string;
  llmModel:         string;
  maxBet:           number;
  dryRun:           boolean;
}

function readPem(raw: string): string {
  // Could be inline PEM or a file path
  if (raw.startsWith("-----")) return raw;
  const expanded = raw.replace("~", os.homedir());
  if (fs.existsSync(expanded)) return fs.readFileSync(expanded, "utf-8");
  return raw;
}

export function loadConfig(): Config {
  const apiKey     = process.env.KALSHI_API_KEY     ?? "";
  const privateKey = process.env.KALSHI_PRIVATE_KEY ?? "";
  const useDemo    = process.env.KALSHI_USE_DEMO !== "false";

  if (!apiKey)     console.warn("⚠  KALSHI_API_KEY not set");
  if (!privateKey) console.warn("⚠  KALSHI_PRIVATE_KEY not set");

  return {
    kalshi: {
      apiKey,
      privateKey: readPem(privateKey),
      useDemo,
    },
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
    llmModel:         process.env.KALSHI_LLM_MODEL ?? "nvidia/nemotron-nano-8b-instruct:free",
    maxBet:           parseFloat(process.env.MAX_BET ?? "25"),
    dryRun:           process.env.DRY_RUN !== "false",
  };
}
