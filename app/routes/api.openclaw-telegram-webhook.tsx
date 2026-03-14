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
  handleCancelarProcesso,
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

const openclawPaidApprovalMap = new Map<number, number>();
const openclawCnpjConfirmationMap = new Map<number, { originalText: string; cnpj: string; expiresAt: number }>();

const CNPJ_REGEX = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;

function normalizeCnpj(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 14) return "";
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function extractCnpjFromText(text: string): string {
  const match = text.match(CNPJ_REGEX);
  if (!match) return "";
  return normalizeCnpj(match[0]);
}

function isConfirmMessage(text: string): boolean {
  return /^(sim|s|ok|confirmo|pode|prosseguir)$/i.test(text.trim());
}

function isRejectMessage(text: string): boolean {
  return /^(não|nao|n|cancelar|cancela|parar|recusar)$/i.test(text.trim());
}

function isPaidOverrideMessage(text: string): boolean {
  return /^\/pago$/i.test(text)
    || /^\/deepseek$/i.test(text)
    || /(pode|pode usar|liberado|autorizado).*(deepseek|pago)/i.test(text)
    || /(deepseek|pago).*(liberado|autorizado|ok)/i.test(text);
}

function hasPaidApproval(chatId: number): boolean {
  const exp = openclawPaidApprovalMap.get(chatId);
  if (!exp) return false;
  if (Date.now() > exp) {
    openclawPaidApprovalMap.delete(chatId);
    return false;
  }
  return true;
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
  let messageText = message.text?.trim() ?? message.caption?.trim() ?? "";
  let mediaContext = ""; // contexto adicional sobre o tipo de mídia processada

  // ── ÁUDIO / VOZ → Groq Whisper ───────────────────────────────────────────
  const audioFile = message.voice ?? message.audio;
  const isAudioDoc = message.document?.mime_type?.startsWith("audio/");
  const audioToProcess = audioFile ?? (isAudioDoc ? message.document : null);

  if (audioToProcess) {
    try {
      await sendChatAction(botToken, chatId, "typing");
      console.log("[OPENCLAW] Transcribing audio:", audioToProcess.file_id);

      const transcription = await transcribeAudioWithGroq(botToken, audioToProcess.file_id, audioToProcess.mime_type);
      if (transcription) {
        messageText = messageText
          ? `${messageText}\n\nTranscrição do áudio: ${transcription}`
          : transcription;
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
  const isImageDoc = message.document?.mime_type?.startsWith("image/") ?? false;
  if ((message.photo && message.photo.length > 0) || isImageDoc) {
    try {
      await sendChatAction(botToken, chatId, "typing");

      const imageFileId = message.photo && message.photo.length > 0
        ? message.photo[message.photo.length - 1].file_id
        : message.document!.file_id;
      const caption = message.caption?.trim() ?? "";

      console.log("[OPENCLAW] Analyzing image:", imageFileId);
      const analysis = await analyzeImageWithGemini(botToken, imageFileId, caption, message.document?.mime_type);

      if (analysis) {
        messageText = messageText
          ? `${messageText}\n\nAnálise da imagem: ${analysis}`
          : `Análise da imagem: ${analysis}`;
        mediaContext = mediaContext
          ? `${mediaContext}🖼️ _(imagem analisada)_ `
          : "🖼️ _(imagem analisada)_ ";
      } else {
        await sendTelegram(botToken, chatId,
          "❌ Não consegui analisar a imagem agora (cota/instabilidade do Gemini Free). Tente novamente em alguns minutos ou envie um áudio/texto."
        );
        return data({ ok: true });
      }
    } catch (err) {
      console.error("[OPENCLAW] Image analysis error:", err);
      await sendTelegram(botToken, chatId,
        "❌ Erro ao analisar a imagem. Tente novamente."
      );
      return data({ ok: true });
    }
  }

  // Se ainda não há texto para processar, ignorar silenciosamente
  if (!messageText) return data({ ok: true });

  const pendingCnpjConfirmation = openclawCnpjConfirmationMap.get(chatId);
  if (pendingCnpjConfirmation) {
    if (Date.now() > pendingCnpjConfirmation.expiresAt) {
      openclawCnpjConfirmationMap.delete(chatId);
    } else if (isConfirmMessage(messageText)) {
      openclawCnpjConfirmationMap.delete(chatId);
      await sendTelegram(botToken, chatId, `✅ Confirmação recebida. Cadastrando cliente com CNPJ *${pendingCnpjConfirmation.cnpj}*...`, "Markdown");
      await handleNovoCliente(pendingCnpjConfirmation.originalText, chatId, botToken);
      return data({ ok: true });
    } else if (isRejectMessage(messageText)) {
      openclawCnpjConfirmationMap.delete(chatId);
      await sendTelegram(botToken, chatId, "❎ Cadastro cancelado. Se quiser, envie novamente o comando com os dados corrigidos.");
      return data({ ok: true });
    } else if (messageText !== "/start") {
      await sendTelegram(
        botToken,
        chatId,
        `⏳ Tenho um cadastro pendente para CNPJ *${pendingCnpjConfirmation.cnpj}*.
Responda *sim* para confirmar ou *não* para cancelar (expira em 10 min).`,
        "Markdown"
      );
      return data({ ok: true });
    }
  }

  // ── Comandos especiais ────────────────────────────────────────────────────

  if (isPaidOverrideMessage(messageText)) {
    openclawPaidApprovalMap.set(chatId, Date.now() + 10 * 60 * 1000);
    await sendTelegram(botToken, chatId, "✅ DeepSeek Paid liberado para esta conversa por 10 minutos.");
    return data({ ok: true });
  }

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
      `/processo — Abrir processo de importação/exportação\n` +
      `/cancelar_processo — Cancelar processo com justificativa\n\n` +
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
      `/processo tipo, cliente, produto — Abrir processo comex\n` +
      `/cancelar_processo IMP-2026-0001 motivo: texto — Cancelar processo\n\n` +
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
    /cadastro\s+de\s+cliente/i.test(messageText) ||
    /cria(?:r)?\s+(?:um\s+)?cliente/i.test(messageText) ||
    /novo\s+cliente/i.test(messageText) ||
    /cadastrar\s+cliente/i.test(messageText)
  ) {
    const cnpj = extractCnpjFromText(messageText);
    if (cnpj) {
      openclawCnpjConfirmationMap.set(chatId, {
        originalText: messageText,
        cnpj,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      await sendTelegram(
        botToken,
        chatId,
        `🔐 Confirma o cadastro de cliente para CNPJ *${cnpj}*?
Responda *sim* para continuar ou *não* para cancelar (válido por 10 min).`,
        "Markdown"
      );
      return data({ ok: true });
    }

    await handleNovoCliente(messageText, chatId, botToken);
    return data({ ok: true });
  }

  if (CNPJ_REGEX.test(messageText)) {
    const cnpj = extractCnpjFromText(messageText);
    if (cnpj) {
      openclawCnpjConfirmationMap.set(chatId, {
        originalText: messageText,
        cnpj,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      await sendTelegram(
        botToken,
        chatId,
        `🔐 Confirma o cadastro de cliente para CNPJ *${cnpj}*?
Responda *sim* para continuar ou *não* para cancelar (válido por 10 min).`,
        "Markdown"
      );
      return data({ ok: true });
    }

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

  if (
    messageText.startsWith("/cancelar_processo") ||
    /cancelar\s+processo/i.test(messageText)
  ) {
    await handleCancelarProcesso(messageText, chatId, botToken);
    return data({ ok: true });
  }
  // ── Fim comandos de cadastro ─────────────────────────────────────────────

  // ── Mensagem regular → OpenClaw agent ────────────────────────────────────
  try {
    await sendChatAction(botToken, chatId, "typing");

    const allowPaidFallback = hasPaidApproval(chatId);

    const response = await askAgent("openclaw", messageText, `openclaw-${userId}`, {
      restricted: false,
      feature: "openclaw",
      allowPaidFallback,
    });

    // Provider badge
    const providerBadge = response.provider === "vertex_gemini" ? "🟣 Vertex"
      : response.provider === "openrouter_qwen" ? "🔵 Qwen Free"
      : response.provider === "openrouter_llama" ? "🔵 Llama Free"
      : response.provider === "openrouter_deepseek_free" ? "🔵 R1 Free"
      : response.provider === "deepseek_direct" ? "🟠 DeepSeek Direct"
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

async function transcribeAudioWithGroq(botToken: string, fileId: string, mimeTypeHint?: string): Promise<string | null> {
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
  const extFromUrl = fileUrl.split(".").pop()?.toLowerCase();
  const normalizedHint = mimeTypeHint?.toLowerCase().split(";")[0]?.trim();
  const mimeToExt: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/flac": "flac",
  };
  const allowedExt = new Set(["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"]);
  const extFromHint = normalizedHint ? mimeToExt[normalizedHint] : undefined;
  const ext = (extFromHint && allowedExt.has(extFromHint))
    ? extFromHint
    : (extFromUrl && allowedExt.has(extFromUrl) ? extFromUrl : "ogg");

  const mimeMap: Record<string, string> = {
    ogg: "audio/ogg", opus: "audio/opus", mp3: "audio/mpeg",
    mpeg: "audio/mpeg", mpga: "audio/mpeg", mp4: "audio/mp4",
    m4a: "audio/mp4", wav: "audio/wav", webm: "audio/webm", flac: "audio/flac",
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

async function analyzeImageWithGemini(botToken: string, fileId: string, caption: string, mimeTypeHint?: string): Promise<string | null> {
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
  const mimeType = mimeTypeHint ?? mimeMap[ext] ?? "image/jpeg";

  // 3. Send to Gemini Vision
  const prompt = caption
    ? `Analise esta imagem. O usuário enviou com a legenda: "${caption}". Responda em português, seja direto e útil.`
    : "Analise esta imagem e descreva o que você vê. Se for um documento, extrai as informações relevantes. Se for um produto, identifique-o. Responda em português, seja direto e útil.";

  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
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

      if (geminiRes.ok) {
        const geminiJson = await geminiRes.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } else {
        const errText = await geminiRes.text();
        console.error("[OPENCLAW] Gemini vision failed:", model, geminiRes.status, errText);
        if (geminiRes.status === 429 && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
          continue;
        }
      }

      break;
    }
  }

  const openRouterResult = await analyzeImageWithOpenRouter(prompt, mimeType, base64);
  if (openRouterResult) return openRouterResult;

  return null;
}

async function analyzeImageWithOpenRouter(prompt: string, mimeType: string, base64: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const candidateModels = [
    process.env.OPENROUTER_VISION_MODEL?.trim(),
    "qwen/qwen2.5-vl-72b-instruct:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "google/gemma-3-27b-it:free",
  ].filter((v): v is string => !!v);

  const dataUrl = `data:${mimeType};base64,${base64}`;

  for (const model of candidateModels) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.COOLIFY_URL || process.env.SAAS_URL || "https://saas.lhfex.com.br",
          "X-Title": "OpenClaw Telegram Vision",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          max_tokens: 800,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) {
        console.error("[OPENCLAW] OpenRouter vision failed:", model, res.status, await res.text());
        continue;
      }

      const json = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (error) {
      console.error("[OPENCLAW] OpenRouter vision error:", model, error);
    }
  }

  return null;
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
