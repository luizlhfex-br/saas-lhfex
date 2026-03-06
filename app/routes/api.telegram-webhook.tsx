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

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return data({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  if (!message) return data({ ok: true });

  // Only process text, voice, audio, photo messages
  const hasContent = message.text || message.voice || message.audio || message.photo;
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

  const text = message.text?.trim() ?? "";

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

  // Regular message — send to agent
  const agentId = chatAgentMap.get(chatId) || "airton";
  const isRestricted = accessLevel === "restricted";

  try {
    // Send "typing" indicator
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });

    // Handle audio/voice messages — transcribe with Groq Whisper
    if (message.voice || message.audio) {
      const fileId = (message.voice ?? message.audio)!.file_id;
      const transcription = await transcribeAudioWithGroq(botToken, fileId);
      if (!transcription) {
        await sendTelegram(botToken, chatId, "❌ Não consegui transcrever o áudio. Tente novamente ou envie o texto.");
        return data({ ok: true });
      }
      const agentResponse = await askAgent(agentId, `🎤 (áudio transcrito): ${transcription}`, `telegram-${userId}`, {
        restricted: isRestricted,
        feature: "telegram",
      });
      const providerBadge = agentResponse.provider === "gemini" ? "🟢 Gemini"
        : agentResponse.provider === "openrouter_free" ? "🔵 OpenRouter"
        : agentResponse.provider === "deepseek" ? "🟠 DeepSeek Paid"
        : "⚪";
      let responseText = agentResponse.content;
      if (responseText.length > 3900) responseText = responseText.slice(0, 3890) + "...\n_(truncado)_";
      responseText += `\n\n_🎤 Transcrição: "${transcription.slice(0, 100)}${transcription.length > 100 ? "..." : ""}"_\n${providerBadge} · _${agentResponse.model}_`;
      await sendTelegram(botToken, chatId, responseText, "Markdown");
      return data({ ok: true });
    }

    // Handle image messages — analyze with Gemini Vision
    if (message.photo) {
      const largestPhoto = message.photo[message.photo.length - 1];
      const caption = message.caption ?? "";
      const analysis = await analyzeImageWithGemini(botToken, largestPhoto.file_id, caption);
      if (!analysis) {
        await sendTelegram(botToken, chatId, "❌ Não consegui analisar a imagem. Tente novamente.");
        return data({ ok: true });
      }
      // Pass image analysis to the agent for context-aware response
      const agentInput = caption
        ? `📷 Imagem recebida com legenda: "${caption}"\n\nAnálise da imagem: ${analysis}`
        : `📷 Imagem recebida sem legenda.\n\nAnálise da imagem: ${analysis}`;
      const agentResponse = await askAgent(agentId, agentInput, `telegram-${userId}`, {
        restricted: isRestricted,
        feature: "telegram",
      });
      const providerBadge = agentResponse.provider === "gemini" ? "🟢 Gemini"
        : agentResponse.provider === "openrouter_free" ? "🔵 OpenRouter"
        : agentResponse.provider === "deepseek" ? "🟠 DeepSeek Paid"
        : "⚪";
      let responseText = agentResponse.content;
      if (responseText.length > 3950) responseText = responseText.slice(0, 3940) + "...\n_(truncado)_";
      responseText += `\n\n${providerBadge} · _${agentResponse.model}_`;
      await sendTelegram(botToken, chatId, responseText, "Markdown");
      return data({ ok: true });
    }

    const response = await askAgent(agentId, text, `telegram-${userId}`, {
      restricted: isRestricted,
      feature: "telegram",
    });

    // Add provider badge to response
    // 🟢 Gemini Free | 🔵 OpenRouter Free | 🟠 DeepSeek Paid | ⚪ Unknown
    const providerBadge = response.provider === "gemini" ? "🟢 Gemini"
      : response.provider === "openrouter_free" ? "🔵 OpenRouter"
      : response.provider === "deepseek" ? "🟠 DeepSeek Paid"
      : "⚪";

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

async function transcribeAudioWithGroq(botToken: string, fileId: string): Promise<string | null> {
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

  const ext = fileUrl.split(".").pop()?.toLowerCase() ?? "ogg";
  const mimeMap: Record<string, string> = {
    ogg: "audio/ogg", oga: "audio/ogg", mp3: "audio/mpeg",
    mp4: "audio/mp4", m4a: "audio/mp4", wav: "audio/wav",
    webm: "audio/webm", flac: "audio/flac",
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

async function analyzeImageWithGemini(botToken: string, fileId: string, caption: string): Promise<string | null> {
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
  const mimeType = mimeMap[ext] ?? "image/jpeg";

  const prompt = caption
    ? `Analise esta imagem. O usuário enviou com a legenda: "${caption}". Responda em português, seja direto e útil.`
    : "Analise esta imagem e descreva o que você vê. Se for um documento, extrai as informações relevantes. Se for um produto, identifique-o. Responda em português, seja direto e útil.";

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
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
  if (!geminiRes.ok) {
    console.error("[TELEGRAM] Gemini vision failed:", geminiRes.status, await geminiRes.text());
    return null;
  }
  const json = await geminiRes.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
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
    const appUrl = process.env.APP_URL || "https://saas.lhfex.com.br";
    const webhookUrl = `${appUrl}/api/telegram-webhook`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const result = await res.json();
      return data({ status: "ok", webhook: webhookUrl, telegram: result });
    } catch (error) {
      return data({ status: "error", message: String(error) }, { status: 500 });
    }
  }

  return data({ status: "ok", bot: !!botToken });
}
