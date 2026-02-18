import { data } from "react-router";
import type { Route } from "./+types/api.ocr-extract";
import { requireAuth } from "~/lib/auth.server";
import { parseInvoiceText } from "~/lib/ai.server";

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file || file.size === 0) {
    return data({ error: "No file provided" }, { status: 400 });
  }

  try {
    let text = "";

    if (file.type === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    } else {
      // For text-based files, read directly
      text = await file.text();
    }

    if (!text.trim()) {
      return data({ error: "Could not extract text from file" }, { status: 400 });
    }

    const extracted = await parseInvoiceText(text);
    return data({ success: true, fields: extracted, rawText: text.slice(0, 500) });
  } catch (error) {
    console.error("[OCR] Extraction error:", error);
    return data({ error: "Failed to process document" }, { status: 500 });
  }
}
