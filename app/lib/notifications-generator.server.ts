/**
 * Notifications Generator
 * Business logic for generating in-app and Telegram notifications
 */

import { db } from "~/lib/db.server";
import { notifications, invoices, processes } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS?.split(",").map(id => id.trim()) || [];
const APP_URL = process.env.APP_URL || "https://app.lhfex.com.br";

interface BusinessNotificationOptions {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "invoice" | "process" | "changelog" | "system" | "automation";
  userId?: number;
  link?: string;
  sendTelegram?: boolean;
}

const typeEmojis = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
  invoice: "💰",
  process: "📦",
  changelog: "🔔",
};

/**
 * Create in-app notification and optionally send to Telegram
 */
async function createNotification(options: BusinessNotificationOptions) {
  // Create in-app notification
  if (options.userId) {
    await db.insert(notifications).values({
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      link: options.link,
      read: false,
      createdAt: new Date(),
    });
  }

  // Send to Telegram if enabled
  if (options.sendTelegram && TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_IDS.length > 0) {
    const emoji = typeEmojis[options.type] || "🔔";
    const linkText = options.link ? `\n\n🔗 ${APP_URL}${options.link}` : "";
    const text = `${emoji} <b>${options.title}</b>\n\n${options.message}${linkText}`;

    const promises = TELEGRAM_ADMIN_IDS.map(async (chatId) => {
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          }),
        });
      } catch (error) {
        console.error(`[Telegram] Failed to send to ${chatId}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }
}

/**
 * Notify about completed process
 */
export async function notifyProcessCompleted(processId: number) {
  const process = await db.query.processes.findFirst({
    where: eq(processes.id, processId),
    with: { client: true },
  });

  if (!process || process.status !== "completed") return;

  // Get all users to notify (could be filtered by role/permissions)
  const users = await db.query.users.findMany();

  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: "process",
      title: "Processo Concluído",
      message: `O processo ${process.reference} (${process.client?.name || "Cliente"}) foi concluído com sucesso.`,
      link: `/processes/${processId}`,
      sendTelegram: true,
    });
  }
}

/**
 * Check and notify about upcoming invoice due dates (7 days)
 */
export async function checkUpcomingInvoices() {
  const today = new Date();
  const in7Days = new Date();
  in7Days.setDate(today.getDate() + 7);

  // Find invoices due in 7 days (payables only)
  const upcomingInvoices = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      total: invoices.total,
      dueDate: invoices.dueDate,
      clientName: sql<string>`coalesce(${sql.identifier("client")}.name, 'Desconhecido')`,
    })
    .from(invoices)
    .leftJoin(sql`clients as client`, sql`${invoices.clientId} = client.id`)
    .where(
      and(
        eq(invoices.type, "payable"),
        eq(invoices.status, "pending"),
        sql`${invoices.dueDate}::date = ${in7Days.toISOString().split("T")[0]}::date`
      )
    );

  if (upcomingInvoices.length === 0) return;

  // Get all users to notify
  const users = await db.query.users.findMany();

  const totalAmount = upcomingInvoices.reduce((sum: number, inv) => sum + Number(inv.total), 0);
  const invoicesList = upcomingInvoices
    .map((inv) => `• ${inv.number || "S/N"} - ${inv.clientName} - R$ ${Number(inv.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
    .join("\n");

  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: "invoice",
      title: `${upcomingInvoices.length} Vencimento${upcomingInvoices.length > 1 ? "s" : ""} em 7 Dias`,
      message: `Total: R$ ${totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n${invoicesList}`,
      link: "/invoices?status=pending&type=payable",
      sendTelegram: true,
    });
  }
}

/**
 * Notify about system update (new version)
 */
export async function notifySystemUpdate(version: string, changes: string[]) {
  const users = await db.query.users.findMany();

  const changesList = changes.map((change) => `• ${change}`).join("\n");

  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: "changelog",
      title: `Nova Versão ${version} Disponível`,
      message: `O sistema foi atualizado com as seguintes melhorias:\n\n${changesList}`,
      link: "/settings",
      sendTelegram: true,
    });
  }
}
