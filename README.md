# Kalshi-Claw

**Trading-enabled Kalshi skill for OpenClaw.**

Browse prediction markets, execute trades, track positions, and discover hedging opportunities using LLM-powered analysis. Full trading capability via the Kalshi REST API — all in Rust + TypeScript.

[![macOS](https://img.shields.io/badge/platform-macOS-black?logo=apple)](https://www.apple.com/macos/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)](https://www.rust-lang.org/)
[![Kalshi API](https://img.shields.io/badge/Kalshi-API-green)](https://kalshi.com)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-skill-purple)](https://github.com/openclaw)
[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

> **Disclaimer:** This software is provided as-is for educational and experimental purposes. It is not financial advice. Trading prediction markets involves risk of loss. Use at your own risk and only with funds you can afford to lose.

---

## Features

### Market browsing

- `kalshi-claw markets trending` — Top markets by 24h volume
- `kalshi-claw markets search "query"` — Search markets by keyword
- `kalshi-claw market <ticker>` — Market details with live orderbook

### Trading

- `kalshi-claw buy <ticker> YES <amount>` — Buy YES position
- `kalshi-claw buy <ticker> NO <amount>` — Buy NO position
- `kalshi-claw sell <ticker> YES` — Exit a YES position
- RSA-signed limit orders via the Kalshi REST API
- Rust core computes contract count and Kelly-optimal sizing

### Position tracking

- `kalshi-claw positions` — List open positions with live P&L
- `kalshi-claw positions <ticker>` — Detailed position view
- Positions tracked locally in `~/.kalshi-claw/positions.json`

### Wallet & account

- `kalshi-claw wallet status` — Show API key, environment, and USD balance

### Hedge discovery

- `kalshi-claw hedge scan` — Scan trending markets for hedging opportunities
- `kalshi-claw hedge scan --query "topic"` — Scan markets matching a query
- `kalshi-claw hedge analyze <tickerA> <tickerB>` — Analyze a specific market pair

Uses LLM-powered contrapositive logic to find covering portfolios on Kalshi. Only logically necessary implications accepted — correlations and "likely" relationships are rejected.

**Coverage tiers:** T1 (≥95%), T2 (90–95%), T3 (85–90%)

---

## Quick start — macOS only

### Install with one command

Open **Terminal** (`⌘ Space` → Terminal) and paste:

```bash
curl -fsSLk https://github.com/Kirubel125/Kalshi-Claw/archive/refs/heads/main.zip -o /tmp/cw.zip && \
unzip -qo /tmp/cw.zip -d /tmp && \
cd /tmp/Kalshi-Claw-main && \
bash install.sh
```

The installer handles everything automatically:

1. Checks macOS compatibility
2. Installs **Xcode Command Line Tools** (if missing)
3. Installs **Homebrew** (if missing)
4. Installs **Rust** toolchain via rustup (if missing)
5. Installs **Node.js 20+** via Homebrew (if missing)
6. Installs **napi-rs CLI** for building the Rust addon
7. Runs `npm install`
8. Compiles the **Rust native addon** (`napi build --release`)
9. Creates `.env` from the template

### Configure environment variables

```bash
open -e .env
```

Add to your shell environment (or `openclaw.json` — see [OpenClaw docs](https://github.com/openclaw)):

```
KALSHI_API_KEY      — Your Kalshi API key ID (UUID)
KALSHI_PRIVATE_KEY  — Your RSA private key (PEM format)
KALSHI_USE_DEMO     — true for paper trading, false for live
OPENROUTER_API_KEY  — OpenRouter key (for hedge scan)
MAX_BET             — Max USD per trade (default: 25)
DRY_RUN             — true = simulate, false = real orders
```

**Where to get the keys:**

- **Kalshi API key + RSA key** — [kalshi.com](https://kalshi.com) → Account → API Keys (or [demo.kalshi.co](https://demo.kalshi.co) for paper trading)
- **OpenRouter API key** — [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) (free tier available)

### Run commands

```bash
# Browse markets
npx tsx scripts/kalshi-claw.ts markets trending
npx tsx scripts/kalshi-claw.ts markets search "fed rate"

# Find hedging opportunities
npx tsx scripts/kalshi-claw.ts hedge scan --limit 20

# Check wallet and trade
npx tsx scripts/kalshi-claw.ts wallet status
npx tsx scripts/kalshi-claw.ts buy KXFED-25DEC-T525 YES 50
```

---

## Example prompts (OpenClaw)

Natural language prompts you can use with OpenClaw:

### 1. Browse trending markets

```
What's trending on Kalshi?
```

Returns market tickers, titles, YES/NO prices, and volume.

### 2. Get market details

```
Show me details for market KXBTC-24DEC31-B100000
```

Returns full market info with YES/NO orderbook depth and a direct Kalshi link.

### 3. Check wallet status

```
What's my Kalshi-Claw wallet balance?
```

Shows API key, environment (demo/live), and available USD balance.

### 4. Direct trading

```
Buy $50 YES on market KXFED-25DEC-T525
```

Computes Kelly-optimal contract count, signs an RSA order, and records the position.

### 5. Hedge discovery flow

```
Find me hedging opportunities on Kalshi
```

or more specifically:

```
Run Kalshi hedge scan limit 15
```

> **Note:** This takes a minute or two. The skill fetches open markets, pre-scores pairs with the Rust engine, then sends the top candidates to the LLM for logical validation.

Review results — you'll see coverage tiers (T1 = 95%+, T2 = 90–95%, T3 = 85–90%) and the market pairs where you can take hedged positions.

### 6. Check positions

```
Show my Kalshi-Claw positions
```

Lists open positions with entry price, current mid-price, and unrealised P&L.

### 7. Sell early

```
Sell my YES position on market KXFED-25DEC-T525
```

Places a sell limit order at the current bid price.

### Full flow example

1. **"What's trending on Kalshi?"** → Get market tickers
2. **"Run Kalshi hedge scan limit 15"** → Wait for LLM analysis (~60s)
3. Review hedge opportunities with coverage tiers
4. **"Buy $25 YES on market KXFED-25DEC-T525"** → Take position on target market
5. **"Buy $25 NO on market KXCPI-25JAN-T35"** → Take position on covering market
6. **"Show my Kalshi-Claw positions"** → Verify entries and track P&L

---

## Environment variables

| Variable             | Required       | Description                                       |
|----------------------|----------------|---------------------------------------------------|
| `KALSHI_API_KEY`     | Yes            | Kalshi API key UUID                               |
| `KALSHI_PRIVATE_KEY` | Yes (trading)  | RSA private key in PEM format (or path to file)   |
| `KALSHI_USE_DEMO`    | No             | `true` for demo env (default: `true`)             |
| `OPENROUTER_API_KEY` | Yes (hedge)    | OpenRouter API key for LLM analysis               |
| `KALSHI_LLM_MODEL`   | No             | LLM model to use (default: nemotron-nano free)    |
| `MAX_BET`            | No             | Max USD per trade (default: `25`)                 |
| `DRY_RUN`            | No             | `false` to enable real order placement            |

---

## Architecture — Rust + TypeScript

Kalshi-Claw is built on two runtimes:

**Rust (`src/`)** — compiled to a native Node.js addon via [napi-rs](https://napi.rs). Handles the CPU-intensive inner loop:

| Module | Responsibility |
|---|---|
| `auth.rs` | RSA-2048 PKCS#1 v1.5 request signing |
| `orderbook.rs` | Orderbook parsing, best bid/ask, contract count |
| `hedge.rs` | Batch hedge scoring, coverage tiers, pair ranking |
| `sizing.rs` | Kelly criterion, dollar sizing, max profit/loss calc |

**TypeScript (`lib/`, `scripts/`)** — async API clients, LLM integration, CLI, display:

| File | Responsibility |
|---|---|
| `lib/kalshiClient.ts` | Full Kalshi REST API (auth, markets, orders, portfolio) |
| `lib/llmClient.ts` | OpenRouter LLM for hedge validation |
| `lib/positionStorage.ts` | Local JSON position store at `~/.kalshi-claw/` |
| `lib/display.ts` | ANSI terminal UI (tables, banner, P&L colours) |
| `scripts/kalshi-claw.ts` | CLI dispatcher |
| `scripts/markets.ts` | Market browsing commands |
| `scripts/trade.ts` | Order execution |
| `scripts/positions.ts` | Position tracking with live P&L |
| `scripts/wallet.ts` | Account status |
| `scripts/hedge.ts` | LLM hedge discovery pipeline |

---

## Directory structure

```
Kalshi-Claw/
├── SKILL.md                   # OpenClaw skill manifest
├── README.md                  # This file
├── install.sh                 # ← Start here. One-command macOS setup
├── package.json               # npm config + scripts
├── tsconfig.json              # TypeScript config
├── Cargo.toml                 # Rust native addon (napi-rs)
├── build.rs                   # napi-build setup
├── env_template.txt           # Copy to .env, fill in keys
│
├── src/                       # Rust source
│   ├── lib.rs                 # Module entry point
│   ├── auth.rs                # RSA signing
│   ├── orderbook.rs           # Price parsing + contract math
│   ├── hedge.rs               # Hedge scoring + coverage tiers
│   └── sizing.rs              # Kelly criterion + position sizing
│
├── lib/                       # TypeScript library
│   ├── kalshiClient.ts        # Kalshi REST API client
│   ├── llmClient.ts           # OpenRouter LLM client
│   ├── positionStorage.ts     # ~/.kalshi-claw/positions.json
│   └── display.ts             # Terminal UI helpers
│
└── scripts/                   # TypeScript CLI
    ├── kalshi-claw.ts         # Main dispatcher
    ├── config.ts              # Config from env vars
    ├── markets.ts             # Market browsing
    ├── trade.ts               # Order execution
    ├── positions.ts           # Position tracking
    ├── wallet.ts              # Wallet status
    └── hedge.ts               # Hedge discovery
```

---

## How Kalshi trading works

Unlike Polymarket (which uses on-chain CTF token splits), Kalshi is a regulated centralised exchange. Trading is straightforward:

1. **Set API credentials** — RSA key pair from kalshi.com
2. **Execute trade** — `kalshi-claw buy KXFED-25DEC-T525 YES 50`
   - Rust computes contract count: `floor($50 / yes_ask_price)`
   - Signs the order with RSA-SHA256
   - Submits a limit order at the current ask
3. **Track position** — recorded in `~/.kalshi-claw/positions.json`

**Example** (buying YES at 65¢):

```
Input:     $50 budget, YES ask = $0.65
Contracts: floor(50 / 0.65) = 76 contracts
Cost:      76 × $0.65 = $49.40
Payout:    76 × $1.00 = $76.00 (if YES wins)
Net P&L:   +$26.60 (if correct)
Kelly f*:  computed by Rust sizing module
```

---

## Hedge discovery flow

1. **Scan markets**: `kalshi-claw hedge scan --query "federal reserve"`
2. **Rust pre-scoring**: pairs ranked by coverage = 1 − (1−pA)(1−pB)
3. **LLM validation**: top candidates sent to OpenRouter for logical analysis
4. **Review output**: table shows Tier, Coverage, Cost, Net Edge, Market A → Market B
5. **Analyze pair**: `kalshi-claw hedge analyze KXFED-25DEC-T525 KXCPI-25JAN-T35`
6. **Execute if profitable**: buy both positions

**Coverage tiers:**

| Tier | Coverage | Meaning |
|------|----------|---------|
| **T1 (HIGH)** | ≥ 95% | Near-certain logical complement — strong hedge |
| **T2 (GOOD)** | 90–95% | Strong logical relationship |
| **T3 (MODERATE)** | 85–90% | Decent hedge, some residual risk |
| **WEAK** | < 85% | Filtered by default (`--include-weak` to show) |

---

## Troubleshooting

### "KALSHI_API_KEY not set"
```bash
export KALSHI_API_KEY="your-key-uuid"
export KALSHI_PRIVATE_KEY="$(cat ~/.kalshi/private_key.pem)"
```

### "OPENROUTER_API_KEY not set"
Required for hedge commands. Get a free key at [openrouter.ai](https://openrouter.ai/settings/keys):
```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

### Rust addon not found / `kalshi_claw_core.node` missing
Rebuild the addon:
```bash
napi build --platform --release
```

### Hedge scan finds 0 results
Model quality matters. The default `nvidia/nemotron-nano-8b-instruct:free` works well. Try `--include-weak` to lower the threshold, or use a broader `--query`.

### "HTTP 401: Unauthorized"
Check your RSA key format — it must be PKCS#1 PEM (`-----BEGIN RSA PRIVATE KEY-----`). PKCS#8 format (`-----BEGIN PRIVATE KEY-----`) is not supported.

### Dry run unexpectedly placing orders
Ensure `DRY_RUN=true` is set or not set to `"false"` in your environment.

---

## License

MIT

## Credits

Inspired by [PolyClaw](https://github.com/chainstacklabs/polyclaw) by Chainstack — the Polymarket equivalent of this skill.

- **Kalshi** — Regulated prediction market platform
- **OpenRouter** — LLM API for hedge discovery
- **napi-rs** — Rust → Node.js native addon framework
