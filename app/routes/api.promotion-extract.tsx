import { data } from "react-router";
import type { Route } from "./+types/api.promotion-extract";
import { requireAuth } from "~/lib/auth.server";
import { parsePromotionText } from "~/lib/ai.server";

export async function action({ request }: Route.ActionArgs) {
  const { checkRateLimit, RATE_LIMITS } = await import("~/lib/rate-limit.server");
  const { user } = await requireAuth(request);

  // Rate limit: reutiliza o mesmo limite do OCR (10 req/min por usuário)
  const rateCheck = await checkRateLimit(
    `promotion-extract:${user.id}`,
    RATE_LIMITS.ocrExtract.maxAttempts,
    RATE_LIMITS.ocrExtract.windowMs
  );

  if (!rateCheck.allowed) {
    return data(
      {
        error: "Muitas extrações. Aguarde um momento antes de tentar novamente.",
        retryAfter: rateCheck.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) },
      }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file || file.size === 0) {
    return data({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  try {
    let text = "";

    if (file.type === "application/pdf") {
      const pdfParse = (await import("pdf-parse")) as unknown as (
        buffer: Buffer
      ) => Promise<{ text: string }>;
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    } else {
      // Texto plano ou HTML
      text = await file.text();
    }

    if (!text.trim()) {
      return data({ error: "Não foi possível extrair texto do arquivo" }, { status: 400 });
    }

    const fields = await parsePromotionText(text);
    return data({ success: true, fields });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Promotion Extract] Error:", msg);
    // Erros de API/provedor retornam mensagem útil; outros retornam genérico
    const userMsg = msg.includes("API_KEY") || msg.includes("not configured")
      ? "Serviço de IA não configurado no servidor. Contate o administrador."
      : msg.includes("timeout") || msg.includes("AbortError")
      ? "Tempo limite excedido. Tente novamente."
      : "Falha ao processar documento";
    return data({ error: userMsg }, { status: 500 });
  }
}
