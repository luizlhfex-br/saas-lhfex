import type { Route } from "./+types/api.siscomex";
import { requireAuth } from "~/lib/auth.server";
import { jsonApiError } from "~/lib/api-error";
import { getClientIP, checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { resolveSiscomexFee } from "~/lib/siscomex.server";

export async function loader({ request }: Route["LoaderArgs"]) {
  await requireAuth(request);

  const rateCheck = await checkRateLimit(
    `siscomex:${getClientIP(request)}`,
    RATE_LIMITS.exchangeRate.maxAttempts,
    RATE_LIMITS.exchangeRate.windowMs,
  );

  if (!rateCheck.allowed) {
    return jsonApiError(
      "RATE_LIMITED",
      "Muitas consultas de taxa Siscomex. Aguarde um momento.",
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) },
      },
      { retryAfter: rateCheck.retryAfterSeconds },
    );
  }

  const url = new URL(request.url);
  const additions = Number(url.searchParams.get("additions") || 0);
  const fee = await resolveSiscomexFee(additions);

  if (!fee) {
    return jsonApiError("INTERNAL_ERROR", "Tabela Siscomex indisponivel.", { status: 404 });
  }

  return Response.json(fee, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
