/**
 * OpenCLAW Bot Integration
 * Orchestrates Telegram bot for sending promotions, raffles, and company announcements
 */

import { db } from "./db.server";
import { companyPromotions, companyRaffles } from "../../drizzle/schema";
import { eq, and, lte, gte } from "drizzle-orm";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "";

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: "HTML" | "Markdown";
  disable_web_page_preview?: boolean;
}

/**
 * Send message to Telegram channel/group
 */
export async function sendTelegramMessage(message: TelegramMessage): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    console.error("[OpenCLAW] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...message,
          chat_id: message.chat_id || TELEGRAM_CHANNEL_ID,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[OpenCLAW] Telegram API error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[OpenCLAW] Failed to send Telegram message:", error);
    return false;
  }
}

/**
 * Format promotion message for Telegram
 */
export function formatPromotionMessage(promo: any): string {
  const lines = [
    `🎉 <b>${promo.title}</b>`,
    "",
    promo.description ? `${promo.description}` : "",
    "",
  ];

  if (promo.discountType && promo.discountValue) {
    const discount =
      promo.discountType === "percentage"
        ? `${promo.discountValue}% OFF`
        : `R$ ${promo.discountValue} de desconto`;
    lines.push(`💰 <b>${discount}</b>`);
  }

  if (promo.minPurchaseAmount) {
    lines.push(`📦 Compra mínima: R$ ${promo.minPurchaseAmount}`);
  }

  if (promo.promotionCode) {
    lines.push(`🏷️ Código: <code>${promo.promotionCode}</code>`);
  }

  const startDate = new Date(promo.startDate).toLocaleDateString("pt-BR");
  const endDate = new Date(promo.endDate).toLocaleDateString("pt-BR");
  lines.push(`📅 Válido: ${startDate} até ${endDate}`);

  return lines.filter(Boolean).join("\n");
}

/**
 * Format raffle message for Telegram
 */
export function formatRaffleMessage(raffle: any): string {
  const lines = [
    `🎁 <b>SORTEIO: ${raffle.title}</b>`,
    "",
    raffle.description ? `${raffle.description}` : "",
    "",
    `🏆 Prêmio: ${raffle.prizeDescription || "A definir"}`,
  ];

  if (raffle.prizeValue) {
    lines.push(`💵 Valor: R$ ${raffle.prizeValue}`);
  }

  lines.push(`👥 Vencedores: ${raffle.numberOfWinners}`);

  if (raffle.participationRequired) {
    lines.push(`📋 Requisito: ${raffle.participationRequired}`);
  }

  const drawDate = new Date(raffle.drawDate).toLocaleDateString("pt-BR", {
    dateStyle: "full",
  });
  lines.push(`📅 Sorteio em: ${drawDate}`);

  return lines.filter(Boolean).join("\n");
}

/**
 * Send promotion announcement to Telegram
 */
export async function announcePromotion(promotionId: string): Promise<boolean> {
  const [promo] = await db
    .select()
    .from(companyPromotions)
    .where(eq(companyPromotions.id, promotionId))
    .limit(1);

  if (!promo) {
    console.error("[OpenCLAW] Promotion not found:", promotionId);
    return false;
  }

  const message = promo.telegramMessage || formatPromotionMessage(promo);

  return await sendTelegramMessage({
    chat_id: TELEGRAM_CHANNEL_ID,
    text: message,
    parse_mode: "HTML",
  });
}

/**
 * Send raffle announcement to Telegram
 */
export async function announceRaffle(raffleId: string): Promise<boolean> {
  const [raffle] = await db
    .select()
    .from(companyRaffles)
    .where(eq(companyRaffles.id, raffleId))
    .limit(1);

  if (!raffle) {
    console.error("[OpenCLAW] Raffle not found:", raffleId);
    return false;
  }

  const message = raffle.telegramMessage || formatRaffleMessage(raffle);

  return await sendTelegramMessage({
    chat_id: TELEGRAM_CHANNEL_ID,
    text: message,
    parse_mode: "HTML",
  });
}

/**
 * Get active promotions scheduled for announcement
 */
export async function getScheduledPromotions() {
  const now = new Date();

  return await db
    .select()
    .from(companyPromotions)
    .where(
      and(
        eq(companyPromotions.isActive, true),
        lte(companyPromotions.startDate, now),
        gte(companyPromotions.endDate, now)
      )
    );
}

/**
 * Get upcoming raffles for announcement
 */
export async function getUpcomingRaffles() {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return await db
    .select()
    .from(companyRaffles)
    .where(
      and(
        eq(companyRaffles.isActive, true),
        eq(companyRaffles.isDrawn, false),
        lte(companyRaffles.drawDate, nextWeek),
        gte(companyRaffles.drawDate, now)
      )
    );
}
