/**
 * positionStorage.ts
 * ------------------
 * Persist and retrieve open Kalshi positions to/from
 * ~/.kalshi-claw/positions.json (mirrors polyclaw's approach).
 */

import * as fs   from "fs";
import * as os   from "os";
import * as path from "path";

export interface Position {
  id:           string;   // order_id
  ticker:       string;
  side:         "yes" | "no";
  contracts:    number;
  entry_price:  number;   // fractional (0.0 – 1.0)
  opened_at:    string;   // ISO timestamp
  current_price?: number;
  pnl?:           number;
}

const DATA_DIR  = path.join(os.homedir(), ".kalshi-claw");
const POS_FILE  = path.join(DATA_DIR, "positions.json");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadPositions(): Position[] {
  ensureDir();
  if (!fs.existsSync(POS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(POS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function savePositions(positions: Position[]): void {
  ensureDir();
  fs.writeFileSync(POS_FILE, JSON.stringify(positions, null, 2));
}

export function addPosition(p: Position): void {
  const all = loadPositions();
  all.push(p);
  savePositions(all);
}

export function removePosition(orderId: string): boolean {
  const all     = loadPositions();
  const filtered = all.filter((p) => p.id !== orderId);
  if (filtered.length === all.length) return false;
  savePositions(filtered);
  return true;
}

export function enrichWithPnl(
  positions: Position[],
  currentPrices: Record<string, number>,
): Position[] {
  return positions.map((p) => {
    const cur = currentPrices[p.ticker];
    if (cur === undefined) return p;
    const pnl = p.side === "yes"
      ? p.contracts * (cur - p.entry_price)
      : p.contracts * ((1 - cur) - (1 - p.entry_price));
    return { ...p, current_price: cur, pnl: Math.round(pnl * 100) / 100 };
  });
}
