# Kalshi-Claw Skill

Trading-enabled Kalshi skill for OpenClaw — browse markets, execute trades, track positions, discover hedges. Built in Rust + TypeScript.

## Skill name
`kalshi-claw`

## Commands

```
kalshi-claw markets trending
kalshi-claw markets search "<query>"
kalshi-claw market <ticker>
kalshi-claw buy <ticker> YES|NO <amount>
kalshi-claw sell <ticker> YES|NO
kalshi-claw positions
kalshi-claw positions <ticker>
kalshi-claw wallet status
kalshi-claw hedge scan [--query "topic"] [--limit 20]
kalshi-claw hedge analyze <tickerA> <tickerB>
```

## Environment variables required

| Variable              | Purpose                              |
|-----------------------|--------------------------------------|
| `KALSHI_API_KEY`      | Kalshi API key ID (UUID)             |
| `KALSHI_PRIVATE_KEY`  | RSA private key (PEM or file path)   |
| `KALSHI_USE_DEMO`     | `true` for demo env (default: true)  |
| `OPENROUTER_API_KEY`  | LLM API key (hedge scan only)        |
| `MAX_BET`             | Hard cap per trade in USD (default: 25) |
| `DRY_RUN`             | `false` to enable real order placement |

## Example OpenClaw config

```json
"kalshi-claw": {
  "enabled": true,
  "env": {
    "KALSHI_API_KEY":     "your-key-uuid",
    "KALSHI_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...",
    "KALSHI_USE_DEMO":    "true",
    "OPENROUTER_API_KEY": "sk-or-v1-...",
    "MAX_BET":            "25",
    "DRY_RUN":            "true"
  }
}
```

## Example prompts

- "What's trending on Kalshi?"
- "Show me details for market KXBTC-24DEC31-B100000"
- "Find hedging opportunities on Kalshi"
- "Buy $50 YES on market KXFED-25DEC-T525"
- "Show my Kalshi positions"
- "What's my Kalshi balance?"
