const cache = new Map<string, { timestamp: number; result: InvoiceConversionResult }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export type InvoiceConversionResult = {
  from: string;
  to: string;
  amount: number;
  rate: number;
  convertedAmount: number;
  source: string;
  timestamp: number;
};

function normalizeCurrency(value: string) {
  return value.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

async function fetchBrlToUsdRate(requestUrl: string): Promise<number | null> {
  const res = await fetch(new URL("/api/exchange-rate", requestUrl), {
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as { ptax?: number | null; rate?: number | null; bid?: number | null };
  const rate = Number(data.ptax ?? data.rate ?? data.bid);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function fetchFrankfurterRate(from: string, to: string): Promise<number | null> {
  const cacheKey = `${from}->${to}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result.rate;
  }

  const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = Number(data?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  return rate;
}

export async function convertInvoiceToUsd(params: {
  from: string;
  amount: number;
  requestUrl: string;
}): Promise<InvoiceConversionResult | null> {
  const from = normalizeCurrency(params.from);
  const to = "USD";
  const amount = Number(params.amount);

  if (!from || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const cacheKey = `${from}->${to}:${amount.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  let rate: number | null = null;
  let source = "frankfurter";

  if (from === to) {
    rate = 1;
    source = "identity";
  } else if (from === "BRL") {
    rate = await fetchBrlToUsdRate(params.requestUrl);
    source = "bcb_ptax";
  } else {
    rate = await fetchFrankfurterRate(from, to);
  }

  if (!rate || rate <= 0) {
    return null;
  }

  const convertedAmount = from === to ? amount : from === "BRL" ? amount / rate : amount * rate;
  const result: InvoiceConversionResult = {
    from,
    to,
    amount,
    rate,
    convertedAmount,
    source,
    timestamp: Date.now(),
  };

  cache.set(cacheKey, { timestamp: Date.now(), result });
  return result;
}
