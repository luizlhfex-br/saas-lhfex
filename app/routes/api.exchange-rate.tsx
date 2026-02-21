import { getCache, setCache, CACHE_TTL } from "~/lib/cache.server";

// In-memory cache fallback (when Redis unavailable)
let cachedRate: { rate: number; bid: number; ask: number; timestamp: number } | null = null;
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface ExchangeRateResponse {
  rate: number;
  bid: number;
  ask: number;
  timestamp: number;
  cached?: boolean;
  stale?: boolean;
  fallback?: boolean;
}

export async function loader({ request }: { request: Request }) {
  const { checkRateLimit, RATE_LIMITS, getClientIP } = await import("~/lib/rate-limit.server");
  
  // Rate limit by IP: 30 requests per minute
  const clientIp = getClientIP(request);
  const rateCheck = await checkRateLimit(
    `exchange-rate:${clientIp}`,
    RATE_LIMITS.exchangeRate.maxAttempts,
    RATE_LIMITS.exchangeRate.windowMs
  );
  
  if (!rateCheck.allowed) {
    return Response.json(
      { 
        error: "Muitas consultas. Aguarde um momento.",
        retryAfter: rateCheck.retryAfterSeconds 
      },
      { 
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) }
      }
    );
  }

  const now = Date.now();
  const cacheKey = "exchange-rate:usd-brl";

  // Try Redis cache first (1 hour TTL)
  const cached = await getCache<ExchangeRateResponse>(cacheKey);
  if (cached) {
    return Response.json({ ...cached, cached: true }, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  // Fallback to in-memory cache (5 min TTL)
  if (cachedRate && now - cachedRate.timestamp < MEMORY_CACHE_TTL) {
    return Response.json({ ...cachedRate, cached: true }, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  // Fetch from external API
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const data = await res.json();
    const usd = data.USDBRL;

    const result: ExchangeRateResponse = {
      rate: parseFloat(usd.bid),
      bid: parseFloat(usd.bid),
      ask: parseFloat(usd.ask),
      timestamp: now,
    };

    // Cache in Redis (1 hour)
    await setCache(cacheKey, result, CACHE_TTL.exchangeRate);

    // Also update in-memory cache as fallback
    cachedRate = result;

    return Response.json(result, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) {
    console.error("[EXCHANGE] Failed to fetch rate:", error);

    // Return stale cache if available (memory)
    if (cachedRate) {
      return Response.json({ ...cachedRate, stale: true });
    }

    // Final fallback: hardcoded rate
    return Response.json({ 
      rate: 5.50, 
      bid: 5.50, 
      ask: 5.50, 
      timestamp: now, 
      fallback: true 
    });
  }
}
