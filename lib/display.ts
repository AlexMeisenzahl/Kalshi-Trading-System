/**
 * display.ts
 * ----------
 * Terminal output helpers — colour-coded tables, banners, and summaries.
 * No external deps; plain ANSI codes only.
 */

const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  magenta:"\x1b[35m",
  white:  "\x1b[37m",
  blue:   "\x1b[34m",
} as const;

const fmt = (c: keyof typeof C, s: string) => C[c] + s + C.reset;

export const BANNER = `
${C.cyan}${C.bold}
 ██╗  ██╗ █████╗ ██╗     ███████╗██╗  ██╗██╗      ██████╗██╗      █████╗ ██╗    ██╗
 ██║ ██╔╝██╔══██╗██║     ██╔════╝██║  ██║██║     ██╔════╝██║     ██╔══██╗██║    ██║
 █████╔╝ ███████║██║     ███████╗███████║██║     ██║     ██║     ███████║██║ █╗ ██║
 ██╔═██╗ ██╔══██║██║     ╚════██║██╔══██║██║     ██║     ██║     ██╔══██║██║███╗██║
 ██║  ██╗██║  ██║███████╗███████║██║  ██║██║     ╚██████╗███████╗██║  ██║╚███╔███╔╝
 ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝      ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
           Kalshi trading skill for OpenClaw  •  Rust + TypeScript
${C.reset}`;

export function printBanner(dryRun: boolean, demo: boolean): void {
  console.log(BANNER);
  const tags: string[] = [];
  if (dryRun) tags.push(fmt("yellow", "DRY RUN"));
  if (demo)   tags.push(fmt("cyan",   "KALSHI DEMO"));
  if (!dryRun && !demo) tags.push(fmt("red", "⚠  LIVE TRADING"));
  console.log("  " + tags.join("  |  ") + "\n");
}

export function printMarketTable(markets: any[]): void {
  console.log(
    fmt("bold", `\n  ${"Ticker".padEnd(30)} ${"Title".padEnd(45)} ${"YES".padStart(6)} ${"NO".padStart(6)} ${"Vol".padStart(10)}`)
  );
  console.log("  " + "─".repeat(100));
  for (const m of markets) {
    const ya = ((m.yes_ask ?? 0) * 100).toFixed(0).padStart(5) + "¢";
    const na = ((m.no_ask  ?? 0) * 100).toFixed(0).padStart(5) + "¢";
    const vol = (m.volume ?? 0).toLocaleString().padStart(10);
    console.log(
      `  ${fmt("cyan", (m.ticker ?? "").padEnd(30))} ${(m.title ?? "").substring(0, 45).padEnd(45)} ${ya} ${na} ${vol}`
    );
  }
  console.log();
}

export function printHedgeTable(hedges: any[]): void {
  if (!hedges.length) {
    console.log(fmt("dim", "  No hedge opportunities found.\n"));
    return;
  }
  console.log(fmt("bold", `\n  ${"Tier".padEnd(18)} ${"Coverage".padStart(9)} ${"Cost".padStart(7)} ${"Edge".padStart(7)}  Market A → Market B`));
  console.log("  " + "─".repeat(95));
  for (const h of hedges) {
    const tier     = h.tier ?? h.coverage ?? "?";
    const coverPct = ((h.coverage ?? 0) * 100).toFixed(1) + "%";
    const cost     = ((h.combined_cost ?? 0) * 100).toFixed(1) + "¢";
    const edge     = fmt(
      (h.net_edge ?? 0) >= 0 ? "green" : "red",
      (((h.net_edge ?? 0) * 100).toFixed(1) + "%").padStart(7),
    );
    console.log(
      `  ${fmt("magenta", tier.padEnd(18))} ${coverPct.padStart(9)} ${cost.padStart(7)} ${edge}  ${h.market_a_id} → ${h.market_b_id}`
    );
  }
  console.log();
}

export function printPositionTable(positions: any[]): void {
  if (!positions.length) {
    console.log(fmt("dim", "  No open positions.\n"));
    return;
  }
  console.log(fmt("bold", `\n  ${"Ticker".padEnd(30)} ${"Side".padEnd(5)} ${"Contracts".padStart(10)} ${"Entry".padStart(7)} ${"Current".padStart(8)} ${"P&L".padStart(8)}`));
  console.log("  " + "─".repeat(80));
  for (const p of positions) {
    const pnl = p.pnl ?? 0;
    const pnlStr = fmt(pnl >= 0 ? "green" : "red", (pnl >= 0 ? "+" : "") + pnl.toFixed(2));
    console.log(
      `  ${(p.ticker ?? "").padEnd(30)} ${(p.side ?? "").padEnd(5)} ${String(p.contracts ?? 0).padStart(10)} ${((p.entry_price ?? 0) * 100).toFixed(0).padStart(5)}¢ ${((p.current_price ?? 0) * 100).toFixed(0).padStart(6)}¢ ${pnlStr.padStart(8)}`
    );
  }
  console.log();
}

export function printSuccess(msg: string): void { console.log(fmt("green", `  ✓ ${msg}`)); }
export function printError(msg: string):   void { console.log(fmt("red",   `  ✗ ${msg}`)); }
export function printInfo(msg: string):    void { console.log(fmt("dim",   `  ${msg}`)); }
export function printWarn(msg: string):    void { console.log(fmt("yellow",`  ⚠ ${msg}`)); }
