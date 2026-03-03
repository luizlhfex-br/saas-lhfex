/**
 * OpenClaw Telegram Webhook — Life Pessoal Agent
 *
 * Webhook privado para @lhfex_openclaw_bot
 * Apenas Luiz (OPENCLAW_CHAT_ID) pode usar
 * Agente: OpenClaw 🌙 (automação de vida pessoal)
 *
 * Suporta:
 * - Texto → OpenClaw agent
 * - Áudio/Voz → Groq Whisper transcrição → OpenClaw agent
 * - Foto/Imagem → Gemini Vision análise → resposta direta
 */

import { data } from "react-router";
import type { Route } from "./+types/api.openclaw-telegram-webhook";
import { askAgent } from "~/lib/ai.server";
import {
  handleCadastrarPessoa,
  handleNovoCliente,
  handleAbrirProcesso,
} from "~/lib/openclaw-telegram-actions.server";

interface TelegramFile {
  file_id: string;
  file_size?: number;
  file_unique_id: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    caption?: string;
    date: number;
    // Áudio e voz
    voice?: TelegramFile & { duration: number; mime_type?: string };
    audio?: TelegramFile & { duration: number; mime_type?: string; title?: string };
    // Imagens
    photo?: Array<TelegramFile & { width: number; height: number }>;
    // Documentos (pode ser áudio enviado como arquivo)
    document?: TelegramFile & { mime_type?: string; file_name?: string };
  };
}

export async function action({ request }: Route.ActionArgs) {
  const botToken = process.env.OPENCLAW_TELEGRAM_TOKEN;
  const allowedChatId = process.env.OPENCLAW_CHAT_ID ? Number(process.env.OPENCLAW_CHAT_ID) : null;

  if (!botToken || !allowedChatId) {
    console.error("[OPENCLAW] Bot not configured (token or chat ID missing)");
    return data({ error: "Bot not configured" }, { status: 503 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return data({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  if (!message) return data({ ok: true });

  const chatId = message.chat.id;
  const userId = message.from.id;
  const firstName = message.from.first_name;

  // Access control: apenas usuário autorizado
  if (chatId !== allowedChatId) {
    console.warn(`[OPENCLAW] Unauthorized access attempt from chat ${chatId}`);
    await sendTelegram(botToken, chatId,
      `⛔ *OpenClaw é privado.*\n\nEste bot é reservado para análise de vida pessoal. Acesso negado.`
    );
    return data({ ok: true });
  }

  // ── Determinar o tipo de mensagem e obter o texto ────────────────────────
  let messageText = message.text?.trim() ?? "";
  let mediaContext = ""; // contexto adicional sobre o tipo de mídia processada

  // ── ÁUDIO / VOZ → Groq Whisper ───────────────────────────────────────────
  const audioFile = message.voice ?? message.audio;
  const isAudioDoc = message.document?.mime_type?.startsWith("audio/");
  const audioToProcess = audioFile ?? (isAudioDoc ? message.document : null);

  if (audioToProcess && !messageText) {
    try {
      await sendChatAction(botToken, chatId, "typing");
      console.log("[OPENCLAW] Transcribing audio:", audioToProcess.file_id);

      const transcription = await transcribeAudioWithGroq(botToken, audioToProcess.file_id);
      if (transcription) {
        messageText = transcription;
        mediaContext = "🎤 _(áudio transcrito)_ ";
        console.log("[OPENCLAW] Transcription:", transcription.slice(0, 100));
      } else {
        await sendTelegram(botToken, chatId,
          "❌ Não consegui transcrever o áudio. Tente novamente ou envie o texto direto."
        );
        return data({ ok: true });
      }
    } catch (err) {
      console.error("[OPENCLAW] Audio transcription error:", err);
      await sendTelegram(botToken, chatId,
        "❌ Erro na transcrição do áudio. Tente novamente ou envie o texto."
      );
      return data({ ok: true });
    }
  }

  // ── FOTO / IMAGEM → Gemini Vision ────────────────────────────────────────
  if (message.photo && message.photo.length > 0) {
    try {
      await sendChatAction(botToken, chatId, "typing");

      // Pegar a foto com maior resolução (último item do array)
      const largestPhoto = message.photo[message.photo.length - 1];
      const caption = message.caption?.trim() ?? "";

      console.log("[OPENCLAW] Analyzing image:", largestPhoto.file_id);
      const analysis = await analyzeImageWithGemini(botToken, largestPhoto.file_id, caption);

      if (analysis) {
        const responseText = `🖼️ *Análise da imagem:*\n\n${analysis}`;
        await sendTelegram(botToken, chatId, responseText, "Markdown");
      } else {
        await sendTelegram(botToken, chatId,
          "❌ Não consegui analisar a imagem. Tente novamente com uma imagem diferente."
        );
      }
    } catch (err) {
      console.error("[OPENCLAW] Image analysis error:", err);
      await sendTelegram(botToken, chatId,
        "❌ Erro ao analisar a imagem. Tente novamente."
      );
    }
    return data({ ok: true });
  }

  // Se ainda não há texto para processar, ignorar silenciosamente
  if (!messageText) return data({ ok: true });

  // ── Comandos especiais ────────────────────────────────────────────────────

  // Command: /start
  if (messageText === "/start") {
    await sendTelegram(botToken, chatId,
      `🌙 *Bem-vindo ao OpenClaw, ${firstName}!*\n\n` +
      `Seu assistente pessoal de automação de vida.\n\n` +
      `Sou especializado em:\n` +
      `💰 *Finanças Pessoais* — análise de gastos, receitas, categorização\n` +
      `📈 *Investimentos* — portfolio, ganhos/perdas, rebalanceamento\n` +
      `❤️ *Hábitos & Rotinas* — rastreamento, sugestões\n` +
      `🎯 *Objetivos* — planejamento, progresso, cronograma\n` +
      `🎁 *Promoções* — rastreamento, oportunidades, ROI\n\n` +
      `*Comandos de cadastro:*\n` +
      `/pessoa — Cadastrar contato pessoal\n` +
      `/cliente — Cadastrar cliente LHFEX\n` +
      `/processo — Abrir processo de importação/exportação\n\n` +
      `*Exemplos de perguntas:*\n` +
      `"Como estão meus gastos este mês?"\n` +
      `"Qual foi o ROI das promoções do ano?"\n` +
      `"Como posso melhorar meus hábitos?"\n\n` +
      `*Suporte a mídia:*\n` +
      `🎤 Envie áudios — transcrevo e processo\n` +
      `🖼️ Envie fotos — analiso com visão computacional\n\n` +
      `Basta digitar, falar ou enviar uma foto!`,
      "Markdown"
    );
    return data({ ok: true });
  }

  // Command: /help
  if (messageText === "/help") {
    await sendTelegram(botToken, chatId,
      `🌙 *OpenClaw — Ajuda*\n\n` +
      `*Comandos de cadastro:*\n` +
      `/pessoa Nome, CPF, celular, email — Cadastrar contato\n` +
      `/cliente CNPJ, Razão Social, contato — Cadastrar cliente LHFEX\n` +
      `/processo tipo, cliente, produto — Abrir processo comex\n\n` +
      `*Exemplos:*\n` +
      `\`/pessoa João Silva, 31999990000, joao@gmail.com\`\n` +
      `\`/cliente 12.345.678/0001-90, Empresa ABC, contato: Maria\`\n` +
      `\`/processo importação, cliente: Empresa ABC, têxteis, USD 50.000\`\n\n` +
      `*Funcionalidades:*\n` +
      `✓ Finanças pessoais e investimentos\n` +
      `✓ Hábitos, rotinas e objetivos\n` +
      `✓ Promoções e sorteios\n` +
      `✓ Pessoas e contatos\n` +
      `🎤 Áudios transcritos automaticamente (Groq Whisper)\n` +
      `🖼️ Fotos analisadas com visão computacional (Gemini)`,
      "Markdown"
    );
    return data({ ok: true });
  }

  // ── Comandos de cadastro direto ─────────────────────────────────────────
  if (
    messageText.startsWith("/pessoa") ||
    /cadastrar\s+pessoa/i.test(messageText) ||
    /nova\s+pessoa/i.test(messageText)
  ) {
    await handleCadastrarPessoa(messageText, chatId, botToken);
    return data({ ok: true });
  }

  if (
    messageText.startsWith("/cliente") ||
    /novo\s+cliente/i.test(messageText) ||
    /cadastrar\s+cliente/i.test(messageText)
  ) {
    await handleNovoCliente(messageText, chatId, botToken);
    return data({ ok: true });
  }

  if (
    messageText.startsWith("/processo") ||
    /abrir\s+processo/i.test(messageText) ||
    /novo\s+processo/i.test(messageText)
  ) {
    await handleAbrirProcesso(messageText, chatId, botToken);
    return data({ ok: true });
  }
  // ── Fim comandos de cadastro ─────────────────────────────────────────────

  // ── Mensagem regular → OpenClaw agent ────────────────────────────────────
  try {
    await sendChatAction(botToken, chatId, "typing");

    const response = await askAgent("openclaw", messageText, `openclaw-${userId}`, {
      restricted: false,
      feature: "openclaw",
    });

    // Provider badge
    const providerBadge = response.provider === "gemini" ? "🟢 Gemini"
      : response.provider === "openrouter_free" ? "🔵 OpenRouter"
      : response.provider === "openrouter_paid" ? "🟠 OpenRouter Paid"
      : response.provider === "deepseek" ? "🔴 DeepSeek"
      : "⚪";

    let responseText = response.content;
    if (responseText.length > 3900) {
      responseText = responseText.slice(0, 3890) + "...\n\n_(resposta truncada)_";
    }
    responseText = `${mediaContext}${responseText}\n\n${providerBadge} · _${response.model}_`;

    await sendTelegram(botToken, chatId, responseText, "Markdown");
  } catch (error) {
    console.error("[OPENCLAW] Agent error:", error);
    await sendTelegram(botToken, chatId,
      `❌ *Erro ao processar sua mensagem.*\n\nTente novamente em alguns minutos.`
    );
  }

  return data({ ok: true });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendChatAction(token: string, chatId: number, action: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => { /* ignore typing indicator failures */ });
}

async function getTelegramFileUrl(token: string, fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`, {
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json() as { ok: boolean; result?: { file_path?: string } };
    if (!json.ok || !json.result?.file_path) return null;
    return `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
  } catch {
    return null;
  }
}

async function transcribeAudioWithGroq(botToken: string, fileId: string): Promise<string | null> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error("[OPENCLAW] GROQ_API_KEY not configured");
    return null;
  }

  // 1. Get file URL from Telegram
  const fileUrl = await getTelegramFileUrl(botToken, fileId);
  if (!fileUrl) {
    console.error("[OPENCLAW] Could not get file URL from Telegram");
    return null;
  }

  // 2. Download audio file
  const audioRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
  if (!audioRes.ok) {
    console.error("[OPENCLAW] Could not download audio file");
    return null;
  }
  const audioBuffer = await audioRes.arrayBuffer();

  // 3. Determine MIME type from URL
  const ext = fileUrl.split(".").pop()?.toLowerCase() ?? "ogg";
  const mimeMap: Record<string, string> = {
    ogg: "audio/ogg",
    oga: "audio/ogg",
    mp3: "audio/mpeg",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    wav: "audio/wav",
    webm: "audio/webm",
    flac: "audio/flac",
  };
  const mimeType = mimeMap[ext] ?? "audio/ogg";
  const fileName = `audio.${ext}`;

  // 4. Send to Groq Whisper
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mimeType }), fileName);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "pt");
  formData.append("response_format", "text");

  const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqApiKey}` },
    body: formData,
    signal: AbortSignal.timeout(60000),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error("[OPENCLAW] Groq transcription failed:", groqRes.status, errText);
    return null;
  }

  const transcription = await groqRes.text();
  return transcription.trim() || null;
}

async function analyzeImageWithGemini(botToken: string, fileId: string, caption: string): Promise<string | null> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("[OPENCLAW] GEMINI_API_KEY not configured");
    return null;
  }

  // 1. Get file URL from Telegram
  const fileUrl = await getTelegramFileUrl(botToken, fileId);
  if (!fileUrl) {
    console.error("[OPENCLAW] Could not get image URL from Telegram");
    return null;
  }

  // 2. Download image
  const imgRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
  if (!imgRes.ok) {
    console.error("[OPENCLAW] Could not download image");
    return null;
  }
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString("base64");

  // Determine MIME type
  const ext = fileUrl.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp", gif: "image/gif",
  };
  const mimeType = mimeMap[ext] ?? "image/jpeg";

  // 3. Send to Gemini Vision
  const prompt = caption
    ? `Analise esta imagem. O usuário enviou com a legenda: "${caption}". Responda em português, seja direto e útil.`
    : "Analise esta imagem e descreva o que você vê. Se for um documento, extrai as informações relevantes. Se for um produto, identifique-o. Responda em português, seja direto e útil.";

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error("[OPENCLAW] Gemini vision failed:", geminiRes.status, errText);
    return null;
  }

  const geminiJson = await geminiRes.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return geminiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

async function sendTelegram(token: string, chatId: number, text: string, parseMode?: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok && parseMode) {
      // Retry without Markdown if it fails
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text.replace(/[*_`\[]/g, "") }),
        signal: AbortSignal.timeout(10000),
      });
    }
  } catch (error) {
    console.error("[OPENCLAW] Send failed:", error);
    if (parseMode) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: text.replace(/[*_`\[]/g, "") }),
          signal: AbortSignal.timeout(10000),
        });
      } catch { /* silent */ }
    }
  }
}
