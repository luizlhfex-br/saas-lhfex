import type { Route } from "./+types/api.enrich-cnpj";
import { requireAuth } from "~/lib/auth.server";
import { enrichCNPJ } from "~/lib/ai.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { checkRateLimit, RATE_LIMITS } = await import("~/lib/rate-limit.server");
  const { user } = await requireAuth(request);

  // Rate limit: 30 requests per minute per user (BrasilAPI tolerance)
  const rateCheck = await checkRateLimit(
    `enrich-cnpj:${user.id}`,
    RATE_LIMITS.enrichCnpj.maxAttempts,
    RATE_LIMITS.enrichCnpj.windowMs
  
  );
  
  if (!rateCheck.allowed) {
    return Response.json(
      { 
        error: "Muitas consultas. Aguarde um momento antes de tentar novamente.",
        retryAfter: rateCheck.retryAfterSeconds 
      },
      { 
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) }
      }
    );
  }

  const url = new URL(request.url);
  const cnpj = url.searchParams.get("cnpj") || "";
  const cleanCnpj = cnpj.replace(/\D/g, "");

  if (!cleanCnpj) {
    return Response.json({ error: "CNPJ é obrigatório" }, { status: 400 });
  }

  if (cleanCnpj.length !== 14) {
    return Response.json(
      { error: "CNPJ inválido. Informe 14 dígitos." },
      { status: 400 }
    );
  }

  const data = await enrichCNPJ(cleanCnpj);

  if (!data) {
    return Response.json(
      {
        error:
          "Não foi possível consultar este CNPJ agora. Verifique o número e tente novamente em instantes.",
      },
      { status: 503 }
    );
  }

  return Response.json(data, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
