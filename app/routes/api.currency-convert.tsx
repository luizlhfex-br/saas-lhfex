import type { Route } from "./+types/api.currency-convert";
import { requireAuth } from "~/lib/auth.server";
import { jsonApiError } from "~/lib/api-error";
import { getClientIP, checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { convertInvoiceToUsd } from "~/lib/invoice-conversion.server";

export async function loader({ request }: Route["LoaderArgs"]) {
  const { user } = await requireAuth(request);

  const rateCheck = await checkRateLimit(
    `currency-convert:${getClientIP(request)}`,
    RATE_LIMITS.exchangeRate.maxAttempts,
    RATE_LIMITS.exchangeRate.windowMs,
  );

  if (!rateCheck.allowed) {
    return jsonApiError(
      "RATE_LIMITED",
      "Muitas conversoes. Aguarde um momento antes de tentar novamente.",
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) },
      },
      { retryAfter: rateCheck.retryAfterSeconds },
    );
  }

  const url = new URL(request.url);
  const from = (url.searchParams.get("from") || "USD").toUpperCase();
  const to = (url.searchParams.get("to") || "USD").toUpperCase();
  const amount = Number(url.searchParams.get("amount") || 0);

  if (!from || from.length !== 3 || !to || to.length !== 3 || !Number.isFinite(amount) || amount <= 0) {
    return jsonApiError("INVALID_INPUT", "Informe moeda e valor validos para conversao.", { status: 400 });
  }

  const result = await convertInvoiceToUsd({
    from,
    amount,
    requestUrl: request.url,
  });

  if (!result) {
    return jsonApiError(
      "INTERNAL_ERROR",
      `Nao foi possivel converter ${from} para ${to}.`,
      { status: 502 },
    );
  }

  return Response.json({
    ...result,
    userId: user.id,
  });
}
