/**
 * kalshiClient.ts
 * ---------------
 * Async Kalshi REST API client.
 * Uses the Rust core for RSA request signing (falls back to pure-TS when
 * the native addon isn't compiled yet).
 */

import * as crypto from "crypto";
import * as https  from "https";

export interface KalshiConfig {
  apiKey:     string;
  privateKey: string;   // RSA PEM string
  useDemo:    boolean;
}

export interface Market {
  ticker:         string;
  event_ticker:   string;
  title:          string;
  yes_ask:        number;
  yes_bid:        number;
  no_ask:         number;
  no_bid:         number;
  volume:         number;
  open_interest:  number;
  status:         string;
  close_time:     string;
  result:         string | null;
}

export interface Event {
  event_ticker: string;
  title:        string;
  category:     string;
  volume:       number;
  markets:      Market[];
}

export interface OrderBook {
  yes: Array<[number, number]>;   // [price_cents, qty]
  no:  Array<[number, number]>;
}

export interface OrderResult {
  order_id:  string;
  status:    string;
  filled_at?: number;
}

// ── Rust native addon (optional — graceful fallback) ──────────────────────────
let rustCore: any = null;
try {
  rustCore = require("../kalshi_claw_core.node");
} catch {
  // compiled addon not present — use pure-TS signing below
}

function signRequest(pem: string, keyId: string, method: string, path: string): string {
  if (rustCore?.sign_request) {
    return rustCore.sign_request(pem, keyId, method, path);
  }
  // Pure-TS fallback
  const tsMs = Date.now().toString();
  const msg  = tsMs + method.toUpperCase() + path;
  const sig  = crypto.createSign("RSA-SHA256")
    .update(msg)
    .sign({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING })
    .toString("base64");
  return `timestamp=${tsMs}, keyId=${keyId}, signature=${sig}`;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function request<T>(
  method: string,
  url:    string,
  auth:   string,
  body?:  object,
): Promise<T> {
  const parsed = new URL(url);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": auth,
  };
  const payload = body ? JSON.stringify(body) : undefined;
  if (payload) headers["Content-Length"] = Buffer.byteLength(payload).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        method, headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error(`JSON parse error: ${data}`)); }
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── KalshiClient ─────────────────────────────────────────────────────────────
export class KalshiClient {
  private readonly base: string;
  private readonly keyId: string;
  private readonly pem:   string;

  constructor(cfg: KalshiConfig) {
    this.base  = cfg.useDemo
      ? "https://demo-api.kalshi.co/trade-api/v2"
      : "https://trading-api.kalshi.com/trade-api/v2";
    this.keyId = cfg.apiKey;
    this.pem   = cfg.privateKey;
  }

  private auth(method: string, path: string): string {
    return signRequest(this.pem, this.keyId, method, path);
  }

  private get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const qs  = params ? "?" + new URLSearchParams(params).toString() : "";
    const url = this.base + path + qs;
    return request<T>("GET", url, this.auth("GET", path + qs));
  }

  private post<T>(path: string, body: object): Promise<T> {
    return request<T>("POST", this.base + path, this.auth("POST", path), body);
  }

  // ── Market data ─────────────────────────────────────────────────────────────
  async getEvents(limit = 50, status = "open"): Promise<Event[]> {
    const data = await this.get<{ events: any[] }>("/events", {
      limit: String(limit), status,
    });
    return (data.events || [])
      .sort((a: any, b: any) => (b.volume ?? 0) - (a.volume ?? 0));
  }

  async getMarketsForEvent(eventTicker: string): Promise<Market[]> {
    const data = await this.get<{ markets: Market[] }>(
      `/events/${eventTicker}`
    );
    return data.markets ?? [];
  }

  async getOrderBook(ticker: string): Promise<OrderBook> {
    const data = await this.get<{ orderbook: OrderBook }>(
      `/markets/${ticker}/orderbook`
    );
    return data.orderbook ?? { yes: [], no: [] };
  }

  async searchMarkets(query: string, limit = 20): Promise<Market[]> {
    const data = await this.get<{ markets: Market[] }>("/markets", {
      search: query, limit: String(limit), status: "open",
    });
    return data.markets ?? [];
  }

  async getTrendingMarkets(limit = 25): Promise<Market[]> {
    const data = await this.get<{ markets: Market[] }>("/markets", {
      limit: String(limit), status: "open",
    });
    const markets = data.markets ?? [];
    return markets.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  }

  async getMarket(ticker: string): Promise<Market> {
    const data = await this.get<{ market: Market }>(`/markets/${ticker}`);
    return data.market;
  }

  // ── Portfolio ────────────────────────────────────────────────────────────────
  async getPositions(): Promise<any[]> {
    const data = await this.get<{ market_positions: any[] }>(
      "/portfolio/positions"
    );
    return data.market_positions ?? [];
  }

  async getBalance(): Promise<{ available: number; pnl: number }> {
    const data = await this.get<any>("/portfolio/balance");
    return {
      available: data.balance ?? 0,
      pnl:       data.total_pnl ?? 0,
    };
  }

  // ── Orders ───────────────────────────────────────────────────────────────────
  async placeOrder(opts: {
    ticker:   string;
    side:     "yes" | "no";
    action:   "buy" | "sell";
    count:    number;
    price:    number;   // cents
    dryRun:   boolean;
  }): Promise<OrderResult> {
    if (opts.dryRun) {
      return {
        order_id: `dry-run-${Date.now()}`,
        status:   "dry_run",
      };
    }
    const body: any = {
      ticker: opts.ticker,
      action: opts.action,
      side:   opts.side,
      count:  opts.count,
      type:   "limit",
    };
    body[opts.side === "yes" ? "yes_price" : "no_price"] = opts.price;
    const data = await this.post<{ order: any }>("/portfolio/orders", body);
    return {
      order_id:  data.order?.order_id ?? "",
      status:    data.order?.status   ?? "unknown",
      filled_at: data.order?.yes_price ?? data.order?.no_price,
    };
  }
}
