// Simple currency conversion utility with in-memory caching.
// In production you would replace the static rates with a periodic fetch from an FX API.
// All rates are expressed relative to a base (USD). Adjust base currency as needed.

export type FXRates = Record<string, number>; // e.g. { USD:1, EUR:0.92, UZS:12600 }

let lastFetch = 0;
let cached: FXRates | null = null;

// Static fallback rates (illustrative only; NOT real-time!)
const STATIC_RATES: FXRates = {
  USD: 1,
  EUR: 0.92,
  UZS: 12600, // approximate
  RUB: 96,
};

/**
 * Get FX rates (stale-after 3h). Currently returns static fallback.
 */
export async function getRates(): Promise<FXRates> {
  const now = Date.now();
  if (!cached || (now - lastFetch) > 3 * 60 * 60 * 1000) {
    // TODO: fetch from API (e.g., exchangerate.host/latest) without exposing keys.
    cached = { ...STATIC_RATES };
    lastFetch = now;
  }
  return cached;
}

/** Convert an amount from source currency into target currency using USD as bridge if needed. */
export async function convert(amount: number, from: string, to: string): Promise<number> {
  if (!from || !to || from === to) return amount;
  const rates = await getRates();
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (!rates[f] || !rates[t]) return amount; // unknown currency -> no conversion
  // All rates relative to USD: value_in_to = amount / rate_from * rate_to
  return amount / rates[f] * rates[t];
}

/** Batch convert sum of many amounts expressed in various currencies to target. */
export async function sumConverted(entries: { amount: number; currency: string }[], target: string): Promise<number> {
  const rates = await getRates();
  const t = target.toUpperCase();
  if (!rates[t]) return entries.reduce((s,e)=>s+e.amount,0);
  let totalUSD = 0; // accumulate in USD then convert once
  for (const e of entries) {
    const c = e.currency?.toUpperCase?.();
    if (!c || !rates[c]) { totalUSD += e.amount; continue; }
    // amount_in_USD = amount / rate_c (since rate_c = c per USD)
    totalUSD += e.amount / rates[c];
  }
  return totalUSD * rates[t];
}
