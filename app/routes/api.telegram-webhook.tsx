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
    date: number;
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
  if (!message?.text) return data({ ok: true });

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();
  const firstName = message.from.first_name;

  // Access control
  const accessLevel = getAccessLevel(userId);
  if (accessLevel === "denied") {
    await sendTelegram(botToken, chatId,
      `⛔ Acesso negado.\n\nSeu ID (${userId}) não está autorizado.\nPeça ao administrador para adicionar seu acesso.`
    );
    return data({ ok: true });
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

    const response = await askAgent(agentId, text, `telegram-${userId}`, {
      restricted: isRestricted,
      feature: "telegram",
    });

    // Add provider badge to response
    // 🟢 Gemini Free | 🔵 OpenRouter Free | 🟠 OpenRouter Paid | 🔴 DeepSeek Paid | ⚪ Unknown
    const providerBadge = response.provider === "gemini" ? "🟢 Gemini"
      : response.provider === "openrouter_free" ? "🔵 OpenRouter"
      : response.provider === "openrouter_paid" ? "🟠 OpenRouter Paid"
      : response.provider === "deepseek" ? "🔴 DeepSeek"
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
