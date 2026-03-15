import { data } from "react-router";
import type { Route } from "./+types/api.promotion-extract";
import { requireAuth } from "~/lib/auth.server";
import { parseLiteraryContestText, parsePromotionText } from "~/lib/ai.server";

async function extractTextFromPdfBytes(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractTextFromPdf(file: File): Promise<string> {
  return extractTextFromPdfBytes(Buffer.from(await file.arrayBuffer()));
}

function stripHtml(raw: string) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LHFEXBot/1.0; +https://saas.lhfex.com.br)",
      Accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Falha ao ler URL (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("pdf")) {
    return extractTextFromPdfBytes(Buffer.from(await response.arrayBuffer()));
  }

  return stripHtml(await response.text());
}

export async function action({ request }: Route.ActionArgs) {
  const { checkRateLimit, RATE_LIMITS } = await import("~/lib/rate-limit.server");
  const { user } = await requireAuth(request);

  const rateCheck = await checkRateLimit(
    `promotion-extract:${user.id}`,
    RATE_LIMITS.ocrExtract.maxAttempts,
    RATE_LIMITS.ocrExtract.windowMs
  );

  if (!rateCheck.allowed) {
    return data(
      {
        error: "Muitas extracoes. Aguarde um momento antes de tentar novamente.",
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
  const url = String(formData.get("url") || "").trim();
  const mode = String(formData.get("mode") || "promotion").trim();

  if ((!file || file.size === 0) && !url) {
    return data({ error: "Envie um arquivo ou informe um link" }, { status: 400 });
  }

  try {
    let text = "";

    if (url) {
      text = await extractTextFromUrl(url);
    } else if (file.type === "application/pdf") {
      text = await extractTextFromPdf(file);
    } else {
      text = await file.text();
    }

    if (!text.trim()) {
      return data({ error: "Nao foi possivel extrair texto do arquivo ou link" }, { status: 400 });
    }

    const fields =
      mode === "literary"
        ? await parseLiteraryContestText(text, user.id, url || null)
        : await parsePromotionText(text, user.id);

    return data({ success: true, fields, extractedText: text.slice(0, 20000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Promotion Extract] Error:", message);
    const userMessage = message.includes("API_KEY") || message.includes("not configured")
      ? "Servico de IA nao configurado no servidor. Contate o administrador."
      : message.includes("timeout") || message.includes("AbortError")
        ? "Tempo limite excedido. Tente novamente."
        : "Falha ao processar documento";

    return data({ error: userMessage }, { status: 500 });
  }
}
