import { getCache, setCache, CACHE_TTL } from "~/lib/cache.server";

// In-memory cache fallback (when Redis unavailable)
let cachedRate: { rate: number; bid: number; ask: number; ptax: number | null; source: string; timestamp: number } | null = null;
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface ExchangeRateResponse {
  rate: number;
  bid: number;
  ask: number;
  ptax: number | null;
  source: string;
  timestamp: number;
  cached?: boolean;
  stale?: boolean;
  fallback?: boolean;
}

/**
 * Busca PTAX do Banco Central do Brasil (média diária dólar comercial).
 * Usado para cálculos aduaneiros — base legal para importação.
 * API pública: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata
 */
async function fetchPTAX(): Promise<number | null> {
  // Tenta os últimos 5 dias úteis para garantir que pegamos um valor (feriados, fins de semana)
  const today = new Date();
  for (let i = 0; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // Pula fins de semana
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const dateStr = `${mm}-${dd}-${yyyy}`; // formato MM-DD-YYYY que o BCB usa

    try {
      const url =
        `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
        `CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dateStr}'` +
        `&$top=1&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoCompra,cotacaoVenda`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) continue;

      const data = await res.json();
      const values = data?.value;
      if (values && values.length > 0) {
        const compra = parseFloat(values[0].cotacaoCompra);
        const venda = parseFloat(values[0].cotacaoVenda);
        if (!isNaN(compra) && !isNaN(venda)) {
          // PTAX médio (compra + venda) / 2
          return Math.round(((compra + venda) / 2) * 10000) / 10000;
        }
      }
    } catch {
      // Tenta próximo dia
      continue;
    }
  }
  return null;
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
        retryAfter: rateCheck.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) },
      }
    );
  }

  const now = Date.now();
  const cacheKey = "exchange-rate:usd-brl-ptax";

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

  // ── Busca PTAX BCB (fonte primária para importação) ──
  let ptax: number | null = null;
  try {
    ptax = await fetchPTAX();
  } catch {
    // PTAX falhou — continua sem ela
  }

  // ── Busca taxa de mercado (bid/ask em tempo real) ──
  let bid = 0;
  let ask = 0;
  let marketSource = "bcb_ptax";

  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const usd = data.USDBRL;
      bid = parseFloat(usd.bid);
      ask = parseFloat(usd.ask);
      marketSource = ptax ? "bcb_ptax" : "awesomeapi";
    }
  } catch {
    // AwesomeAPI falhou
  }

  // Se conseguiu PTAX, usa como taxa principal (para cálculos aduaneiros)
  // Se não, usa bid do mercado
  const rate = ptax ?? bid ?? 5.5;
  const effectiveBid = bid || rate;
  const effectiveAsk = ask || rate;

  const result: ExchangeRateResponse = {
    rate,
    bid: effectiveBid,
    ask: effectiveAsk,
    ptax,
    source: marketSource,
    timestamp: now,
  };

  // Cache em Redis (1 hora)
  await setCache(cacheKey, result, CACHE_TTL.exchangeRate);

  // Atualiza cache in-memory como fallback
  cachedRate = result;

  return Response.json(result, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
