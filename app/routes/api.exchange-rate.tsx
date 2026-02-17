// Server-side exchange rate API with 5-minute cache
let cachedRate: { rate: number; bid: number; ask: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function loader() {
  const now = Date.now();

  if (cachedRate && now - cachedRate.timestamp < CACHE_TTL) {
    return Response.json(cachedRate, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const data = await res.json();
    const usd = data.USDBRL;

    cachedRate = {
      rate: parseFloat(usd.bid),
      bid: parseFloat(usd.bid),
      ask: parseFloat(usd.ask),
      timestamp: now,
    };

    return Response.json(cachedRate, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("[EXCHANGE] Failed to fetch rate:", error);

    // Return stale cache if available
    if (cachedRate) {
      return Response.json({ ...cachedRate, stale: true });
    }

    // Fallback if no cache at all
    return Response.json({ rate: 5.50, bid: 5.50, ask: 5.50, timestamp: now, fallback: true });
  }
}
