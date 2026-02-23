/**
 * Radio Monitor — Lógica de monitoramento de streams de rádio
 *
 * Fluxo:
 * 1. Busca estações com monitoringEnabled = true
 * 2. Captura ~30s do stream HTTP (MP3/AAC)
 * 3. Transcreve via Groq Whisper (gratuito)
 * 4. Detecta palavras-chave cadastradas na transcrição
 * 5. Se detectado: salva evento + notifica via @lhfex_openclaw_bot
 */

import { db } from "./db.server";
import { radioStations, radioMonitorEvents, radioMonitorKeywords } from "../../drizzle/schema/radio-monitor";
import { eq, and } from "drizzle-orm";
import { transcribeRadioSegment, detectPromotionKeywords } from "./ai.server";

const CAPTURE_BYTES = 512 * 1024; // ~30s de MP3 128kbps
const CAPTURE_TIMEOUT_MS = 40_000; // 40s timeout

/**
 * Captura um segmento de áudio de uma stream HTTP de rádio.
 * Retorna buffer com os primeiros ~CAPTURE_BYTES bytes ou null em caso de falha.
 */
async function captureStreamSegment(streamUrl: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT_MS);

  try {
    const response = await fetch(streamUrl, {
      signal: controller.signal,
      headers: {
        // Simula player de rádio básico
        "User-Agent": "Mozilla/5.0 (compatible; RadioMonitor/1.0)",
        "Icy-MetaData": "1",
      },
    });

    if (!response.ok || !response.body) {
      console.warn(`[RadioMonitor] Stream returned ${response.status} for ${streamUrl}`);
      return null;
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const reader = response.body.getReader();

    while (totalBytes < CAPTURE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.byteLength;
    }

    reader.cancel(); // Cancela o stream após captura suficiente

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    console.log(`[RadioMonitor] Captured ${buffer.length} bytes from ${streamUrl}`);
    return buffer;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.warn(`[RadioMonitor] Stream capture timed out for ${streamUrl}`);
    } else {
      console.error(`[RadioMonitor] Stream capture failed for ${streamUrl}:`, error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Envia notificação via Telegram quando promoção é detectada no rádio.
 */
async function notifyPromoDetected(
  stationName: string,
  found: string[],
  companyName: string | null,
  promotionDetails: string | null,
  transcriptionSnippet: string
): Promise<void> {
  const botToken = process.env.OPENCLAW_TELEGRAM_TOKEN;
  const chatId = process.env.OPENCLAW_CHAT_ID;
  if (!botToken || !chatId) return;

  const lines: string[] = [
    `📻 *PROMOÇÃO DETECTADA NO RÁDIO*`,
    ``,
    `🎙️ Estação: *${stationName}*`,
    companyName ? `🏢 Empresa: *${companyName}*` : "",
    `🔑 Keywords: ${found.map((k) => `\`${k}\``).join(", ")}`,
    promotionDetails ? `\n📋 Detalhes:\n${promotionDetails}` : "",
    ``,
    `💬 Trecho transcrito:`,
    `_${transcriptionSnippet.slice(0, 300).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&")}..._`,
  ].filter((l) => l !== "");

  const message = lines.join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (error) {
    console.error("[RadioMonitor] Telegram notification failed:", error);
  }
}

/**
 * Ponto de entrada principal — chamado pelo cron job a cada 2 horas.
 */
export async function runRadioMonitor(): Promise<void> {
  console.log("[RadioMonitor] Starting radio monitoring run...");

  // 1. Busca estações ativas com monitoramento habilitado
  const stations = await db
    .select()
    .from(radioStations)
    .where(and(eq(radioStations.isActive, true), eq(radioStations.monitoringEnabled, true)));

  if (stations.length === 0) {
    console.log("[RadioMonitor] No stations with monitoring enabled — skipping");
    return;
  }

  // 2. Busca palavras-chave ativas
  const keywords = await db
    .select()
    .from(radioMonitorKeywords)
    .where(eq(radioMonitorKeywords.isActive, true));

  if (keywords.length === 0) {
    console.log("[RadioMonitor] No active keywords — skipping");
    return;
  }

  const keywordList = keywords.map((k) => k.keyword);
  console.log(
    `[RadioMonitor] Monitoring ${stations.length} station(s) with ${keywordList.length} keyword(s)`
  );

  // 3. Processa cada estação
  for (const station of stations) {
    console.log(`[RadioMonitor] Processing station: ${station.name}`);

    try {
      let transcriptionText = "";

      if (station.streamUrl) {
        // Captura áudio do stream
        const audioBuffer = await captureStreamSegment(station.streamUrl);

        if (audioBuffer && audioBuffer.length > 0) {
          // Transcreve via Groq Whisper
          transcriptionText = await transcribeRadioSegment(
            audioBuffer,
            `${station.id}_segment.mp3`
          );
          console.log(
            `[RadioMonitor] Transcription (${station.name}): ${transcriptionText.slice(0, 100)}...`
          );
        } else {
          console.warn(`[RadioMonitor] No audio captured for ${station.name}`);
        }
      } else {
        console.log(`[RadioMonitor] Station ${station.name} has no streamUrl — skipping audio`);
        continue;
      }

      if (!transcriptionText) {
        console.log(`[RadioMonitor] No transcription for ${station.name} — skipping keyword check`);
        continue;
      }

      // 4. Detecta keywords na transcrição
      const result = await detectPromotionKeywords(transcriptionText, keywordList);

      console.log(
        `[RadioMonitor] ${station.name}: found=${result.found.join(",") || "none"} ` +
          `confidence=${result.confidence}% isPromotion=${result.isPromotion}`
      );

      // 5. Salva evento no banco (apenas se encontrou algo relevante)
      if (result.found.length > 0 || result.isPromotion) {
        await db.insert(radioMonitorEvents).values({
          stationId: station.id,
          transcriptionText,
          detectedPromotionKeywords: JSON.stringify(result.found),
          confidence: String(result.confidence),
          isPromotion: result.isPromotion,
          companyName: result.companyName,
          promotionDetails: result.promotionDetails,
        });

        // 6. Notifica via Telegram se for promoção confirmada
        if (result.isPromotion) {
          await notifyPromoDetected(
            station.name,
            result.found,
            result.companyName,
            result.promotionDetails,
            transcriptionText
          );
        }
      }
    } catch (error) {
      console.error(`[RadioMonitor] Error processing station ${station.name}:`, error);
    }
  }

  console.log("[RadioMonitor] Run complete");
}
