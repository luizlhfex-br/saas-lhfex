/**
 * POST /api/promotion-strategy
 * Envia regulamento de promoção para o OpenClaw analisar e inicia conversa no Telegram
 */

import { data } from "react-router";
import type { Route } from "./+types/api.promotion-strategy";
import { requireAuth } from "~/lib/auth.server";
import { askAgent } from "~/lib/ai.server";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  const botToken =
    process.env.OPENCLAW_TELEGRAM_TOKEN ||
    process.env.MONITOR_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    process.env.OPENCLAW_CHAT_ID ||
    process.env.MONITOR_BOT_CHAT_ID;

  if (!botToken || !chatId) {
    return data(
      { error: "OpenClaw Telegram não configurado no servidor." },
      { status: 503 }
    );
  }

  let body: {
    promotionName?: string;
    company?: string;
    prize?: string;
    endDate?: string;
    rules?: string;
    extractedText?: string;
    userLuckyNumbers?: string;
    officialLuckyNumber?: string;
    inferredLuckyNumber?: string;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return data({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const { promotionName, company, prize, endDate, rules, extractedText, userLuckyNumbers, officialLuckyNumber, inferredLuckyNumber } = body;

  if (!promotionName && !extractedText) {
    return data({ error: "Dados insuficientes para análise" }, { status: 400 });
  }

  const prompt = `Você é o OpenClaw, especialista em promoções e sorteios.

O usuário acabou de fazer upload do regulamento de uma promoção e quer sua análise estratégica.

DADOS DA PROMOÇÃO:
- Nome: ${promotionName || "Não identificado"}
- Empresa: ${company || "Não identificado"}
- Prêmio: ${prize || "Não identificado"}
- Encerramento: ${endDate || "Não identificado"}
- Regras resumidas: ${rules || "Não disponível"}
- Meus números da sorte: ${userLuckyNumbers || "Não informado"}
- Número oficial sorteado: ${officialLuckyNumber || "Não informado"}
- Número inferido pela IA: ${inferredLuckyNumber || "Não inferido"}

${extractedText ? `TEXTO COMPLETO DO REGULAMENTO:\n${extractedText.slice(0, 3000)}` : ""}

Por favor, faça uma análise completa:
1. 📋 Resumo rápido da promoção (2-3 linhas)
2. 🎯 Estratégia de participação recomendada
3. ⏰ Datas importantes e frequência ideal de participação
4. 🤔 Perguntas para alinhar a abordagem (ex: há indicação de amigos? Limite de participações?)
5. ⚠️ Pontos de atenção ou restrições relevantes
6. 🔢 Número da sorte: inferir pela regra (se possível) e comparar com meus números + número oficial (se informado), mostrando a menor distância numérica

Seja objetivo e prático. Responda em português.`;

  try {
    const aiResponse = await askAgent("iana", prompt, user.id, {
      feature: "openclaw",
      forceProvider: "deepseek",
    });

    const telegramMsg =
      `🦞 *ANÁLISE DE PROMOÇÃO — OpenClaw*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*${promotionName || "Promoção sem nome"}*` +
      (company ? ` — ${company}` : "") + "\n\n" +
      aiResponse.content;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: Number(chatId),
          text: telegramMsg.slice(0, 4096), // Telegram limit
          parse_mode: "Markdown",
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error("[Promotion Strategy] Telegram error:", err);
      return data(
        { error: "Erro ao enviar mensagem no Telegram" },
        { status: 502 }
      );
    }

    return data({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Promotion Strategy] Error:", msg);
    return data({ error: "Falha ao processar análise de estratégia" }, { status: 500 });
  }
}
