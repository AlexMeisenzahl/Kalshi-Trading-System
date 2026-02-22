/**
 * llmClient.ts
 * ------------
 * Thin wrapper around the OpenRouter API for LLM-powered hedge analysis.
 * Mirrors PolyClaw's approach: only logically necessary implications accepted —
 * correlations and "likely" relationships are rejected.
 */

import * as https from "https";

export interface HedgeAnalysis {
  marketA:    string;
  marketB:    string;
  isHedge:    boolean;
  coverage:   "T1" | "T2" | "T3" | "WEAK";
  reasoning:  string;
  confidence: number;   // 0.0 – 1.0
}

const SYSTEM_PROMPT = `
You are a logical hedge analyst for Kalshi prediction markets.
Given two market titles, determine if they form a logically valid hedge.

A VALID hedge exists ONLY when:
- The outcomes are logically complementary (one necessarily covers the other)
- NOT merely correlated or "likely" to move together

Coverage tiers:
- T1: ≥95% — near-certain logical complement
- T2: 90–95% — strong logical relationship
- T3: 85–90% — moderate, some residual risk
- WEAK: <85% — reject

Respond ONLY with JSON:
{
  "isHedge": boolean,
  "coverage": "T1" | "T2" | "T3" | "WEAK",
  "reasoning": "one sentence",
  "confidence": number
}
`.trim();

async function callLLM(apiKey: string, model: string, prompt: string): Promise<string> {
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: prompt },
    ],
    temperature:     0.1,
    response_format: { type: "json_object" },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "openrouter.ai",
        path:     "/api/v1/chat/completions",
        method:   "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer":  "https://github.com/Kirubel125/Kalshi-Claw",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const json   = JSON.parse(data);
            const text   = json.choices?.[0]?.message?.content ?? "{}";
            resolve(text);
          } catch {
            reject(new Error(`LLM parse error: ${data}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export class LLMClient {
  private readonly apiKey: string;
  private readonly model:  string;

  constructor(apiKey: string, model = "nvidia/nemotron-nano-8b-instruct:free") {
    this.apiKey = apiKey;
    this.model  = model;
  }

  async analyzeHedgePair(
    titleA: string,
    tickerA: string,
    titleB: string,
    tickerB: string,
  ): Promise<HedgeAnalysis> {
    const prompt = `
Market A: "${titleA}" (${tickerA})
Market B: "${titleB}" (${tickerB})

Do these markets form a logical hedge? Does buying YES on A and NO on B (or vice versa) guarantee at least one payout in all realistic scenarios?
`.trim();

    try {
      const raw  = await callLLM(this.apiKey, this.model, prompt);
      const data = JSON.parse(raw);
      return {
        marketA:    tickerA,
        marketB:    tickerB,
        isHedge:    !!data.isHedge,
        coverage:   (data.coverage as any) ?? "WEAK",
        reasoning:  data.reasoning ?? "",
        confidence: Number(data.confidence ?? 0),
      };
    } catch {
      return {
        marketA:    tickerA,
        marketB:    tickerB,
        isHedge:    false,
        coverage:   "WEAK",
        reasoning:  "LLM analysis failed",
        confidence: 0,
      };
    }
  }
}
