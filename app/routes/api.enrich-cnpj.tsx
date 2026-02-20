import type { Route } from "./+types/api.enrich-cnpj";
import { requireAuth } from "~/lib/auth.server";
import { enrichCNPJ } from "~/lib/ai.server";
import { checkRateLimit } from "~/lib/rate-limit.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  // Rate limit: 5 requests per minute (BrasilAPI has limits)
  const rateCheck = checkRateLimit(`cnpj:${user.id}`, 5, 60_000);
  if (!rateCheck.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Aguarde um minuto." },
      { status: 429 }
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
