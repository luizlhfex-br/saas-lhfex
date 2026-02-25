/**
 * OpenClaw Telegram Webhook — Life Pessoal Agent
 *
 * Webhook privado para @lhfex_openclaw_bot
 * Apenas Luiz (OPENCLAW_CHAT_ID) pode usar
 * Agente: OpenClaw 🌙 (automação de vida pessoal)
 *
 * Recebe mensagens do Telegram e responde com análises de vida pessoal:
 * - Finanças pessoais
 * - Investimentos
 * - Hábitos e rotinas
 * - Objetivos pessoais
 * - Promoções e sorteios
 */

import { data } from "react-router";
import type { Route } from "./+types/api.openclaw-telegram-webhook";
import { askAgent } from "~/lib/ai.server";
import {
  handleCadastrarPessoa,
  handleNovoCliente,
  handleAbrirProcesso,
} from "~/lib/openclaw-telegram-actions.server";

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
  if (!message?.text) return data({ ok: true });

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();
  const firstName = message.from.first_name;

  // Access control: apenas usuário autorizado
  if (chatId !== allowedChatId) {
    console.warn(`[OPENCLAW] Unauthorized access attempt from chat ${chatId}`);
    await sendTelegram(botToken, chatId,
      `⛔ *OpenClaw é privado.*\n\nEste bot é reservado para análise de vida pessoal. Acesso negado.`
    );
    return data({ ok: true });
  }

  // Command: /start
  if (text === "/start") {
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
      `Basta digitar sua pergunta!`,
      "Markdown"
    );
    return data({ ok: true });
  }

  // Command: /help
  if (text === "/help") {
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
      `*Análise de vida pessoal:*\n` +
      `/start — Mensagem de boas-vindas\n` +
      `/help — Esta mensagem\n\n` +
      `*Funcionalidades de análise:*\n` +
      `✓ Finanças pessoais e investimentos\n` +
      `✓ Hábitos, rotinas e objetivos\n` +
      `✓ Promoções e sorteios\n` +
      `✓ Pessoas e contatos\n\n` +
      `*Dicas:*\n` +
      `— Seja específico em suas perguntas\n` +
      `— Mencione períodos (este mês, ano, trimestre)\n` +
      `— Pergunte sobre padrões e tendências`,
      "Markdown"
    );
    return data({ ok: true });
  }

  // ── Comandos de cadastro direto ─────────────────────────────────────────
  if (
    text.startsWith("/pessoa") ||
    /cadastrar\s+pessoa/i.test(text) ||
    /nova\s+pessoa/i.test(text)
  ) {
    await handleCadastrarPessoa(text, chatId, botToken);
    return data({ ok: true });
  }

  if (
    text.startsWith("/cliente") ||
    /novo\s+cliente/i.test(text) ||
    /cadastrar\s+cliente/i.test(text)
  ) {
    await handleNovoCliente(text, chatId, botToken);
    return data({ ok: true });
  }

  if (
    text.startsWith("/processo") ||
    /abrir\s+processo/i.test(text) ||
    /novo\s+processo/i.test(text)
  ) {
    await handleAbrirProcesso(text, chatId, botToken);
    return data({ ok: true });
  }
  // ── Fim comandos de cadastro ─────────────────────────────────────────────

  // Regular message — send to OpenClaw agent
  try {
    // Send "typing" indicator
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => { /* ignore typing indicator failures */ });

    // Call OpenClaw with full access (no restricted mode)
    const response = await askAgent("openclaw", text, `openclaw-${userId}`, {
      restricted: false,
      feature: "openclaw",
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
    console.error("[OPENCLAW] Agent error:", error);
    await sendTelegram(botToken, chatId,
      `❌ *Erro ao processar sua mensagem.*\n\nTente novamente em alguns minutos.`
    );
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
