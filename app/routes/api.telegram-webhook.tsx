/**
 * Telegram Bot Webhook — AI agents with admin/restricted access control
 *
 * Admin users (TELEGRAM_ADMIN_USERS): full access to everything including financial data
 * Regular users (TELEGRAM_ALLOWED_USERS): restricted access — no financial values, no sensitive details
 * Unauthorized users: denied
 *
 * Commands:
 * /start — Welcome + available agents
 * /airton — Talk to AIrton (Maestro)
 * /iana — Talk to IAna (Comex)
 * /maria — Talk to marIA (Finance)
 * /iago — Talk to IAgo (Infra)
 */

import { data } from "react-router";
import type { Route } from "./+types/api.telegram-webhook";
import { askAgent } from "~/lib/ai.server";
import { getAiProviderBadge } from "~/lib/ai-provider-presentation";
import {
  handleNovoCliente,
  handleAbrirProcesso,
  handleCancelarProcesso,
} from "~/lib/openclaw-telegram-actions.server";
import {
  getTelegramWebhookSecret,
  hasValidTelegramWebhookRequest,
  hasValidWebhookSetupRequest,
} from "~/lib/webhook-security.server";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    caption?: string;
    date: number;
    voice?: { file_id: string; duration: number; mime_type?: string };
    audio?: { file_id: string; duration: number; mime_type?: string };
    photo?: Array<{ file_id: string; width: number; height: number }>;
    document?: { file_id: string; mime_type?: string; file_name?: string };
  };
}

// Map chatId → current agent
const chatAgentMap = new Map<number, string>();
const paidFallbackApprovalMap = new Map<number, number>();
const cnpjCreateConfirmationMap = new Map<number, { originalText: string; cnpj: string; expiresAt: number }>();

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
  const exp = paidFallbackApprovalMap.get(chatId);
  if (!exp) return false;
  if (Date.now() > exp) {
    paidFallbackApprovalMap.delete(chatId);
    return false;
  }
  return true;
}

// Access control levels
type AccessLevel = "admin" | "restricted" | "denied";

function getAccessLevel(userId: number): AccessLevel {
  // Admin users — full access (financial data, sensitive info, everything)
  const admins = process.env.TELEGRAM_ADMIN_USERS;
  if (admins && admins.split(",").map(Number).includes(userId)) {
    return "admin";
  }

  // Allowed users — restricted access (no financial values, no sensitive details)
  const allowed = process.env.TELEGRAM_ALLOWED_USERS;
  if (allowed && allowed.split(",").map(Number).includes(userId)) {
    return "restricted";
  }

  // If neither list is configured, deny all for security
  if (!admins && !allowed) {
    return "denied";
  }

  return "denied";
}

export async function action({ request }: Route.ActionArgs) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return data({ error: "Bot not configured" }, { status: 503 });
  }

  if (!hasValidTelegramWebhookRequest(request, "saas")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return data({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  if (!message) return data({ ok: true });

  // Only process supported message content (text/media)
  const hasContent = message.text || message.caption || message.voice || message.audio || message.photo || message.document;
  if (!hasContent) return data({ ok: true });

  const chatId = message.chat.id;
  const userId = message.from.id;
  const firstName = message.from.first_name;

  // Access control
  const accessLevel = getAccessLevel(userId);
  if (accessLevel === "denied") {
    await sendTelegram(botToken, chatId,
      `⛔ Acesso negado.\n\nSeu ID (${userId}) não está autorizado.\nPeça ao administrador para adicionar seu acesso.`
    );
    return data({ ok: true });
  }

  const text = message.text?.trim() ?? message.caption?.trim() ?? "";

  const pendingCnpjConfirmation = cnpjCreateConfirmationMap.get(chatId);
  if (pendingCnpjConfirmation) {
    if (Date.now() > pendingCnpjConfirmation.expiresAt) {
      cnpjCreateConfirmationMap.delete(chatId);
    } else if (isConfirmMessage(text)) {
      cnpjCreateConfirmationMap.delete(chatId);
      await sendTelegram(botToken, chatId, `✅ Confirmação recebida. Cadastrando cliente com CNPJ *${pendingCnpjConfirmation.cnpj}*...`, "Markdown");
      await handleNovoCliente(pendingCnpjConfirmation.originalText, chatId, botToken);
      return data({ ok: true });
    } else if (isRejectMessage(text)) {
      cnpjCreateConfirmationMap.delete(chatId);
      await sendTelegram(botToken, chatId, "❎ Cadastro cancelado. Se quiser, envie novamente o comando com os dados corrigidos.");
      return data({ ok: true });
    } else if (text && text !== "/start") {
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

  // Command: /start
  if (text === "/start") {
    const accessInfo = accessLevel === "admin"
      ? "🔓 *Acesso completo* — você tem acesso a todas as informações."
      : "🔒 *Acesso restrito* — informações sensíveis e financeiras não serão exibidas.";

    await sendTelegram(botToken, chatId,
      `🎯 *Bem-vindo ao LHFEX Bot, ${firstName}!*\n\n` +
      `${accessInfo}\n\n` +
      "Converse com nossos agentes IA:\n\n" +
      "🎯 /airton — Maestro (visão geral)\n" +
      "📦 /iana — Especialista Comex\n" +
      "💰 /maria — Gestora Financeira\n" +
      "🔧 /iago — Engenheiro de Infra\n\n" +
      "*Comandos operacionais (admin):*\n" +
      "/cliente CNPJ..., Razão Social...\n" +
      "/processo importação, cliente..., produto...\n" +
      "/cancelar_processo IMP-2026-0001 motivo: ...\n\n" +
      `Agente atual: *AIrton* 🎯\nBasta digitar sua pergunta!`,
      "Markdown"
    );
    return data({ ok: true });
  }

  // Switch agent commands
  const agentCommands: Record<string, string> = {
    "/airton": "airton",
    "/iana": "iana",
    "/maria": "maria",
    "/iago": "iago",
  };

  if (agentCommands[text.toLowerCase()]) {
    const agentId = agentCommands[text.toLowerCase()];
    chatAgentMap.set(chatId, agentId);
    const agentNames: Record<string, string> = {
      airton: "AIrton 🎯 (Maestro)",
      iana: "IAna 📦 (Comex)",
      maria: "marIA 💰 (Financeiro)",
      iago: "IAgo 🔧 (Infra)",
    };
    await sendTelegram(botToken, chatId, `✅ Agente trocado para: *${agentNames[agentId]}*\n\nDigite sua pergunta!`, "Markdown");
    return data({ ok: true });
  }

  if (isPaidOverrideMessage(text)) {
    paidFallbackApprovalMap.set(chatId, Date.now() + 10 * 60 * 1000);
    await sendTelegram(
      botToken,
      chatId,
      "✅ DeepSeek Paid liberado para esta conversa por 10 minutos."
    );
    return data({ ok: true });
  }

  // Operações no SAAS via Telegram (somente admin)
  const isClientCreateCmd =
    text.startsWith("/cliente") ||
    /cadastro\s+de\s+cliente/i.test(text) ||
    /cria(?:r)?\s+(?:um\s+)?cliente/i.test(text) ||
    /novo\s+cliente/i.test(text) ||
    /cadastrar\s+cliente/i.test(text);

  const hasCnpj = CNPJ_REGEX.test(text);

  const isProcessCreateCmd =
    text.startsWith("/processo") ||
    /abrir\s+processo/i.test(text) ||
    /novo\s+processo/i.test(text);

  const isProcessCancelCmd =
    text.startsWith("/cancelar_processo") ||
    /cancelar\s+processo/i.test(text);

  if (isClientCreateCmd || isProcessCreateCmd || isProcessCancelCmd || hasCnpj) {
    if (accessLevel !== "admin") {
      await sendTelegram(
        botToken,
        chatId,
        "⛔ Este comando operacional exige perfil admin."
      );
      return data({ ok: true });
    }

    if (isClientCreateCmd || hasCnpj) {
      const cnpj = extractCnpjFromText(text);
      if (cnpj) {
        cnpjCreateConfirmationMap.set(chatId, {
          originalText: text,
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

      await handleNovoCliente(text, chatId, botToken);
      return data({ ok: true });
    }

    if (isProcessCreateCmd) {
      await handleAbrirProcesso(text, chatId, botToken);
      return data({ ok: true });
    }

    await handleCancelarProcesso(text, chatId, botToken);
    return data({ ok: true });
  }

  // Regular message — send to agent
  const agentId = chatAgentMap.get(chatId) || "airton";
  const isRestricted = accessLevel === "restricted";
  const allowPaidFallback = hasPaidApproval(chatId);

  try {
    // Send "typing" indicator
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });

    // Handle audio/voice messages — transcribe with Groq Whisper
    const isAudioDocument = !!message.document?.mime_type?.startsWith("audio/");
    if (message.voice || message.audio || isAudioDocument) {
      const sourceAudio = message.voice ?? message.audio ?? message.document;
      const fileId = sourceAudio!.file_id;
      const transcription = await transcribeAudioWithGroq(botToken, fileId, sourceAudio?.mime_type);
      if (!transcription) {
        await sendTelegram(botToken, chatId, "❌ Não consegui transcrever o áudio. Tente novamente ou envie o texto.");
        return data({ ok: true });
      }
      const agentResponse = await askAgent(agentId, `🎤 (áudio transcrito): ${transcription}`, `telegram-${userId}`, {
        restricted: isRestricted,
        feature: "telegram",
        allowPaidFallback,
      });
      const providerBadge = getAiProviderBadge(agentResponse.provider, agentResponse.model);
      let responseText = agentResponse.content;
      if (responseText.length > 3900) responseText = responseText.slice(0, 3890) + "...\n_(truncado)_";
      responseText += `\n\n_🎤 Transcrição: "${transcription.slice(0, 100)}${transcription.length > 100 ? "..." : ""}"_\n${providerBadge} · _${agentResponse.model}_`;
      await sendTelegram(botToken, chatId, responseText, "Markdown");
      return data({ ok: true });
    }

    // Handle image messages — analyze with Gemini Vision
    const isImageDocument = !!message.document?.mime_type?.startsWith("image/");
    if (message.photo || isImageDocument) {
      const imageFileId = message.photo
        ? message.photo[message.photo.length - 1].file_id
        : message.document!.file_id;
      const caption = message.caption ?? "";
      const analysis = await analyzeImageWithGemini(botToken, imageFileId, caption, message.document?.mime_type);
      if (!analysis) {
        await sendTelegram(botToken, chatId, "❌ Não consegui analisar a imagem agora (cota/instabilidade do Gemini Free). Tente novamente em alguns minutos ou envie texto/áudio.");
        return data({ ok: true });
      }
      // Pass image analysis to the agent for context-aware response
      const agentInput = caption
        ? `📷 Imagem recebida com legenda: "${caption}"\n\nAnálise da imagem: ${analysis}`
        : `📷 Imagem recebida sem legenda.\n\nAnálise da imagem: ${analysis}`;
      const agentResponse = await askAgent(agentId, agentInput, `telegram-${userId}`, {
        restricted: isRestricted,
        feature: "telegram",
        allowPaidFallback,
      });
      const providerBadge = getAiProviderBadge(agentResponse.provider, agentResponse.model);
      let responseText = agentResponse.content;
      if (responseText.length > 3950) responseText = responseText.slice(0, 3940) + "...\n_(truncado)_";
      responseText += `\n\n${providerBadge} · _${agentResponse.model}_`;
      await sendTelegram(botToken, chatId, responseText, "Markdown");
      return data({ ok: true });
    }

    if (message.document && !message.text && !message.caption) {
      await sendTelegram(botToken, chatId, "📎 Tipo de arquivo ainda não suportado. Envie texto, áudio (voz/documento) ou imagem.");
      return data({ ok: true });
    }

    const response = await askAgent(agentId, text, `telegram-${userId}`, {
      restricted: isRestricted,
      feature: "telegram",
      allowPaidFallback,
    });

    // Add provider badge to response
    const providerBadge = getAiProviderBadge(response.provider, response.model);

    // Limit to Telegram max (4096 chars)
    let responseText = response.content;
    if (responseText.length > 3950) {
      responseText = responseText.slice(0, 3940) + "...\n\n_(resposta truncada)_";
    }
    responseText += `\n\n${providerBadge} · _${response.model}_`;

    await sendTelegram(botToken, chatId, responseText, "Markdown");
  } catch (error) {
    console.error("[TELEGRAM] Agent error:", error);
    await sendTelegram(botToken, chatId, "❌ Erro ao processar sua mensagem. Tente novamente.");
  }

  return data({ ok: true });
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
    console.error("[TELEGRAM] GROQ_API_KEY not configured");
    return null;
  }
  const fileUrl = await getTelegramFileUrl(botToken, fileId);
  if (!fileUrl) return null;

  const audioRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
  if (!audioRes.ok) return null;
  const audioBuffer = await audioRes.arrayBuffer();

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

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
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
    console.error("[TELEGRAM] Groq transcription failed:", groqRes.status, await groqRes.text());
    return null;
  }
  return (await groqRes.text()).trim() || null;
}

async function analyzeImageWithGemini(botToken: string, fileId: string, caption: string, mimeTypeHint?: string): Promise<string | null> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("[TELEGRAM] GEMINI_API_KEY not configured");
    return null;
  }
  const fileUrl = await getTelegramFileUrl(botToken, fileId);
  if (!fileUrl) return null;

  const imgRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
  if (!imgRes.ok) return null;
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString("base64");

  const ext = fileUrl.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp", gif: "image/gif",
  };
  const mimeType = mimeTypeHint ?? mimeMap[ext] ?? "image/jpeg";

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
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (geminiRes.ok) {
        const json = await geminiRes.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } else {
        const errText = await geminiRes.text();
        console.error("[TELEGRAM] Gemini vision failed:", model, geminiRes.status, errText);
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
          "HTTP-Referer": process.env.APP_URL || "https://saas.lhfex.com.br",
          "X-Title": "LHFEX Telegram Vision",
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
        console.error("[TELEGRAM] OpenRouter vision failed:", model, res.status, await res.text());
        continue;
      }

      const json = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (error) {
      console.error("[TELEGRAM] OpenRouter vision error:", model, error);
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
    // If Markdown fails, retry without parse mode
    if (!res.ok && parseMode) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text.replace(/[*_`\[]/g, "") }),
        signal: AbortSignal.timeout(10000),
      });
    }
  } catch (error) {
    console.error("[TELEGRAM] Send failed:", error);
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

// GET — health check + setup webhook
export async function loader({ request }: Route.LoaderArgs) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const url = new URL(request.url);
  const setup = url.searchParams.get("setup");

  if (setup === "1" && botToken) {
    if (!hasValidWebhookSetupRequest(request)) {
      return data({ error: "Unauthorized" }, { status: 401 });
    }

    const appUrl = process.env.APP_URL || "https://saas.lhfex.com.br";
    const webhookUrl = `${appUrl}/api/telegram-webhook`;
    const secretToken = getTelegramWebhookSecret("saas");

    if (!secretToken) {
      return data({ error: "Webhook secret not configured" }, { status: 503 });
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secretToken,
          allowed_updates: ["message"],
        }),
      });

      if (!res.ok) {
        return data({ status: "error", message: "Telegram webhook setup failed" }, { status: 502 });
      }

      return data({ status: "ok", webhookConfigured: true }, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return data({ status: "error", message: String(error) }, { status: 500 });
    }
  }

  return data({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
