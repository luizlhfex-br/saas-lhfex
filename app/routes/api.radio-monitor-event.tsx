import { data } from "react-router";
import type { Route } from "./+types/api.radio-monitor-event";
import { db } from "~/lib/db.server";
import { radioMonitorEvents } from "../../drizzle/schema/radio-monitor";

export async function action({ request }: Route.ActionArgs) {
  // Valida API key do script da VM
  const apiKey = request.headers.get("x-radio-monitor-key");
  const expected = process.env.RADIO_MONITOR_SECRET;
  if (!expected || apiKey !== expected) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    stationId: string;
    stationName: string;
    transcriptionText: string;
    detectedKeywords: string[];
    confidence: number;
    detectedAt: string;
  };

  try {
    body = await request.json();
  } catch {
    return data({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stationId, stationName, transcriptionText, detectedKeywords, confidence, detectedAt } = body;

  if (!stationId || !transcriptionText || !detectedKeywords?.length) {
    return data({ error: "Missing required fields" }, { status: 400 });
  }

  // Salva evento no banco
  await db.insert(radioMonitorEvents).values({
    stationId,
    transcriptionText,
    detectedPromotionKeywords: JSON.stringify(detectedKeywords),
    confidence: String(confidence),
    isPromotion: confidence >= 50,
    recordedAt: detectedAt ? new Date(detectedAt) : new Date(),
  });

  // Notifica via Telegram (openclaw bot)
  const botToken = process.env.OPENCLAW_TELEGRAM_TOKEN;
  const chatId = process.env.OPENCLAW_CHAT_ID;

  if (botToken && chatId) {
    const dt = detectedAt
      ? new Date(detectedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const kws = detectedKeywords.map((k: string) => "`" + k + "`").join(", ");
    const snippet = transcriptionText.slice(0, 400).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");

    const lines = [
      "\u{1F4FB} *PALAVRA-CHAVE DETECTADA NO R\u00C1DIO*",
      "",
      "\u{1F399}\uFE0F Esta\u00E7\u00E3o: *" + stationName + "*",
      "\uD83D\uDD11 Keywords: " + kws,
      "\u23F0 Hor\u00E1rio: *" + dt + "*",
      "\uD83D\uDCCA Confian\u00E7a: " + confidence + "%",
      "",
      "Transcri\u00E7\u00E3o:",
      "_" + snippet + "_",
    ];

    const msg = lines.join("\n");

    try {
      await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" }),
      });
    } catch (err) {
      console.error("[RadioMonitor API] Telegram notification failed:", err);
    }
  }

  return data({ success: true });
}
