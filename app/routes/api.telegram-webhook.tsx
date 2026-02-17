/**
 * Telegram Bot Webhook — Receives messages from Telegram and responds via AI agents
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram → get TELEGRAM_BOT_TOKEN
 * 2. Set webhook: curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://saas.lhfex.com.br/api/telegram-webhook"
 * 3. Add TELEGRAM_BOT_TOKEN to .env
 *
 * Commands:
 * /airton — Talk to AIrton (Maestro)
 * /iana — Talk to IAna (Comex)
 * /maria — Talk to marIA (Finance)
 * /iago — Talk to IAgo (Infra)
 * /start — Welcome message
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

// Authorized Telegram user IDs (set via env var TELEGRAM_ALLOWED_USERS=123,456)
function isAuthorized(userId: number): boolean {
  const allowed = process.env.TELEGRAM_ALLOWED_USERS;
  if (!allowed) return true; // If not set, allow all (you should set this!)
  return allowed.split(",").map(Number).includes(userId);
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

  // Auth check
  if (!isAuthorized(userId)) {
    await sendTelegram(botToken, chatId, "⛔ Acesso negado. Seu ID de Telegram não está autorizado. Peça ao administrador para adicionar seu ID.");
    return data({ ok: true });
  }

  // Command handling
  if (text === "/start") {
    await sendTelegram(botToken, chatId,
      "🎯 *Bem-vindo ao LHFEX Bot!*\n\n" +
      "Você pode conversar diretamente com nossos agentes IA:\n\n" +
      "🎯 /airton — Maestro (visão geral)\n" +
      "📦 /iana — Especialista Comex\n" +
      "💰 /maria — Gestora Financeira\n" +
      "🔧 /iago — Engenheiro de Infra\n\n" +
      `Agente atual: *AIrton* 🎯\n` +
      "Basta digitar sua pergunta!",
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

  try {
    // Send "typing" indicator
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });

    const response = await askAgent(agentId, text, `telegram-${userId}`);

    // Limit to Telegram max (4096 chars)
    const responseText = response.content.length > 4000
      ? response.content.slice(0, 3990) + "...\n\n_(resposta truncada)_"
      : response.content;

    await sendTelegram(botToken, chatId, responseText, "Markdown");
  } catch (error) {
    console.error("[TELEGRAM] Agent error:", error);
    await sendTelegram(botToken, chatId, "❌ Erro ao processar sua mensagem. Tente novamente.");
  }

  return data({ ok: true });
}

async function sendTelegram(token: string, chatId: number, text: string, parseMode?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error("[TELEGRAM] Send failed:", error);
    // If Markdown parsing fails, try without it
    if (parseMode) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
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

  // GET /api/telegram-webhook?setup=1 → configures the webhook
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
