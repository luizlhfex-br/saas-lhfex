/**
 * Notifications generator
 * Regras de negocio para notificacoes in-app e Telegram.
 */

import { and, eq, or } from "drizzle-orm";
import { clients, invoices, notifications, processes } from "../../drizzle/schema";
import { db } from "~/lib/db.server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS?.split(",").map((id) => id.trim()) || [];
const APP_URL = process.env.APP_URL || "https://app.lhfex.com.br";

interface BusinessNotificationOptions {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "invoice" | "process" | "changelog" | "system" | "automation";
  userId?: string;
  link?: string;
  sendTelegram?: boolean;
}

const typeEmojis: Record<BusinessNotificationOptions["type"], string> = {
  info: "\u2139\uFE0F",
  success: "\u2705",
  warning: "\u26A0\uFE0F",
  error: "\u274C",
  invoice: "\uD83D\uDCB0",
  process: "\uD83D\uDCE6",
  changelog: "\uD83D\uDD14",
  system: "\uD83D\uDD27",
  automation: "\u2699\uFE0F",
};

async function createNotification(options: BusinessNotificationOptions) {
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

  if (options.sendTelegram && TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_IDS.length > 0) {
    const emoji = typeEmojis[options.type] || typeEmojis.system;
    const linkText = options.link ? `\n\nLink: ${APP_URL}${options.link}` : "";
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

export async function notifyProcessCompleted(processId: string) {
  const process = await db.query.processes.findFirst({
    where: eq(processes.id, processId),
  });

  if (!process || process.status !== "completed") return;

  const users = await db.query.users.findMany();
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, process.clientId),
  });

  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: "process",
      title: "Processo concluido",
      message: `O processo ${process.reference} (${client?.razaoSocial || "Cliente"}) foi concluido com sucesso.`,
      link: `/processes/${processId}`,
      sendTelegram: true,
    });
  }
}

export async function checkUpcomingInvoices() {
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const dueDate = in7Days.toISOString().split("T")[0];

  const upcomingInvoices = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      total: invoices.total,
      dueDate: invoices.dueDate,
      clientName: clients.razaoSocial,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.type, "payable"),
        or(eq(invoices.status, "draft"), eq(invoices.status, "sent")),
        eq(invoices.dueDate, dueDate!),
      ),
    );

  if (upcomingInvoices.length === 0) return;

  const users = await db.query.users.findMany();
  const totalAmount = upcomingInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const invoicesList = upcomingInvoices
    .map(
      (invoice) =>
        `- ${invoice.number || "S/N"} - ${invoice.clientName || "Desconhecido"} - R$ ${Number(invoice.total).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`,
    )
    .join("\n");

  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: "invoice",
      title: `${upcomingInvoices.length} vencimento${upcomingInvoices.length > 1 ? "s" : ""} em 7 dias`,
      message: `Total: R$ ${totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n${invoicesList}`,
      link: "/financial?type=payable",
      sendTelegram: true,
    });
  }
}

export async function notifySystemUpdate(version: string, changes: string[]) {
  const users = await db.query.users.findMany();
  const changesList = changes.map((change) => `- ${change}`).join("\n");

  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: "changelog",
      title: `Nova versao ${version} disponivel`,
      message: `O sistema foi atualizado com as seguintes melhorias:\n\n${changesList}`,
      link: "/settings",
      sendTelegram: true,
    });
  }
}
