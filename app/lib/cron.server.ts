/**
 * Cron Engine — Scheduled background jobs
 * Runs on server start and executes registered cron tasks periodically
 */

import { db } from "./db.server";
import { invoices, processes, clients, automationLogs, auditLogs, personalFinance } from "../../drizzle/schema";
import { bills } from "../../drizzle/schema/bills";
import { eq, lt, isNull, and, sql, lte, gte } from "drizzle-orm";
import { fireTrigger } from "./automation-engine.server";
import { enrichCNPJ, askAgent } from "./ai.server";
import os from "node:os";

function parseEnvInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

const AUTOMATION_LOG_RETENTION_ENABLED = process.env.AUTOMATION_LOG_RETENTION_ENABLED !== "false";
const AUTOMATION_LOG_RETENTION_DAYS = parseEnvInt("AUTOMATION_LOG_RETENTION_DAYS", 90, 1, 3650);
const AUTOMATION_LOG_RETENTION_INTERVAL_HOURS = parseEnvInt("AUTOMATION_LOG_RETENTION_INTERVAL_HOURS", 24, 1, 168);

interface CronJob {
  name: string;
  cronExpression: string; // Simple format: "0 */4 * * *" = every 4 hours
  handler: () => Promise<void>;
  lastRun?: Date;
}

const jobs: CronJob[] = [
  {
    name: "invoice_due_soon",
    cronExpression: "0 9,12,15,18 * * *", // Every day at 9am, 12pm, 3pm, 6pm
    handler: checkInvoicesDueSoon,
  },
  {
    name: "process_eta_approaching",
    cronExpression: "0 */6 * * *", // Every 6 hours
    handler: checkProcessesEtaApproaching,
  },
  {
    name: "cnpj_enrichment",
    cronExpression: "0 2 * * 0", // Weekly at 2am on Sunday
    handler: enrichNewClientsBackground,
  },
  ...(AUTOMATION_LOG_RETENTION_ENABLED
    ? [{
        name: "automation_logs_retention",
        cronExpression: `0 */${AUTOMATION_LOG_RETENTION_INTERVAL_HOURS} * * *`,
        handler: cleanupOldAutomationLogs,
      }]
    : []),
  {
    name: "news_daily_digest",
    cronExpression: "0 7 * * *", // Todo dia às 7h
    handler: sendDailyNewsDigest,
  },
  {
    name: "vps_monitor",
    cronExpression: "0 */1 * * *", // A cada 1 hora
    handler: checkVpsResources,
  },
  {
    name: "personal_finance_weekly",
    cronExpression: "0 8 * * 1", // Toda segunda às 8h
    handler: sendWeeklyPersonalFinanceSummary,
  },
  {
    name: "bills_alert",
    cronExpression: "0 8 * * *", // Todo dia às 8h
    handler: sendBillsAlert,
  },
  {
    name: "vps_weekly_report",
    cronExpression: "0 9 * * 0", // Todo domingo às 9h
    handler: sendVpsWeeklyReport,
  },
];

/**
 * Initialize cron scheduler — call once on server start
 */
export function initializeCronScheduler() {
  console.log("[CRON] Initializing scheduler with", jobs.length, "jobs");

  jobs.forEach((job) => {
    scheduleJob(job);
  });
}

/**
 * Schedule a single cron job using simple time-based intervals
 */
function scheduleJob(job: CronJob) {
  // For simplicity, we'll use interval-based scheduling
  // In production, consider using a library like node-cron
  
  const intervalMs = parseInterval(job.cronExpression);
  
  setInterval(async () => {
    try {
      console.log(`[CRON] Running job: ${job.name}`);
      const startTime = Date.now();
      
      await job.handler();
      
      const duration = Date.now() - startTime;
      console.log(`[CRON] Job ${job.name} completed in ${duration}ms`);
    } catch (error) {
      console.error(`[CRON] Job ${job.name} failed:`, error);
    }
  }, intervalMs);
  
  console.log(`[CRON] Scheduled job "${job.name}" every ${intervalMs / 1000 / 60} minutes`);
}

/**
 * Simple interval parser for cron-like expressions
 * Format: minute hour day month dayofweek
 * Only supports hours field for now
 */
function parseInterval(expression: string): number {
  const parts = expression.split(" ");
  if (parts.length < 3) return 60 * 60 * 1000; // Default: 1 hour
  
  const hourPart = parts[1];
  
  if (hourPart.includes("*/")) {
    const hours = parseInt(hourPart.replace("*/", ""));
    return hours * 60 * 60 * 1000;
  }
  
  // Default: 1 hour
  return 60 * 60 * 1000;
}

/**
 * Check invoices due soon and fire trigger
 */
async function checkInvoicesDueSoon() {
  try {
    const daysBeforeDue = 3;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysBeforeDue);
    const thresholdDateStr = thresholdDate.toISOString().slice(0, 10);
    
    const upcomingInvoices = await db
      .select({ id: invoices.id, number: invoices.number, dueDate: invoices.dueDate, clientId: invoices.clientId })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "sent"),
          isNull(invoices.paidDate),
          lt(invoices.dueDate, thresholdDateStr),
        )
      )
      .limit(100);
    
    console.log(`[CRON] Found ${upcomingInvoices.length} invoices due soon`);
    
    for (const invoice of upcomingInvoices) {
      const daysUntilDue = Math.ceil(
        (new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      await fireTrigger({
        type: "invoice_due_soon",
        data: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          dueDate: invoice.dueDate,
          daysUntilDue,
          clientId: invoice.clientId,
        },
      });
    }
  } catch (error) {
    console.error("[CRON] Error checking invoices due soon:", error);
  }
}

/**
 * Check processes with ETA approaching
 */
async function checkProcessesEtaApproaching() {
  try {
    const hoursBeforeEta = 48;
    const thresholdTime = new Date(Date.now() + hoursBeforeEta * 60 * 60 * 1000);
    
    const upcomingProcesses = await db
      .select({ id: processes.id, reference: processes.reference, eta: processes.eta, clientId: processes.clientId })
      .from(processes)
      .where(
        and(
          isNull(processes.actualArrival),
          eq(processes.status, "in_transit"),
          lt(processes.eta as any, thresholdTime),
        )
      )
      .limit(100);
    
    console.log(`[CRON] Found ${upcomingProcesses.length} processes with ETA approaching`);
    
    for (const process of upcomingProcesses) {
      const hoursUntilEta = Math.ceil(
        (new Date(process.eta!).getTime() - Date.now()) / (1000 * 60 * 60)
      );
      
      await fireTrigger({
        type: "eta_approaching",
        data: {
          processId: process.id,
          processRef: process.reference,
          eta: process.eta?.toISOString(),
          hoursUntilEta,
          clientId: process.clientId,
        },
      });
    }
  } catch (error) {
    console.error("[CRON] Error checking process ETAs:", error);
  }
}

/**
 * Enrich new clients with CNPJ data periodically
 */
async function enrichNewClientsBackground() {
  try {
    // Get clients created in last 7 days that don't have CNAE info yet
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const newClients = await db
      .select({ id: clients.id, cnpj: clients.cnpj, razaoSocial: clients.razaoSocial })
      .from(clients)
      .where(
        and(
          isNull(clients.cnaeCode),
          sql`${clients.createdAt} > ${sevenDaysAgo}`,
        )
      )
      .limit(50);
    
    console.log(`[CRON] Enriching ${newClients.length} new clients with CNPJ data`);
    
    let successCount = 0;
    for (const client of newClients) {
      try {
        const enriched = await enrichCNPJ(client.cnpj);
        if (enriched) {
          await db.update(clients).set({
            cnaeCode: enriched.cnaeCode,
            razaoSocial: enriched.razaoSocial || client.razaoSocial,
          }).where(eq(clients.id, client.id));
          
          successCount++;
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.warn(`[CRON] Failed to enrich client ${client.cnpj}:`, err);
      }
    }
    
    console.log(`[CRON] Successfully enriched ${successCount}/${newClients.length} clients`);
  } catch (error) {
    console.error("[CRON] Error enriching clients:", error);
  }
}

/**
 * Cleanup old automation logs by retention policy
 */
async function cleanupOldAutomationLogs() {
  try {
    const cutoffDate = new Date(Date.now() - AUTOMATION_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const [{ count: totalToDelete }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationLogs)
      .where(lt(automationLogs.executedAt, cutoffDate));

    if (totalToDelete > 0) {
      await db
        .delete(automationLogs)
        .where(lt(automationLogs.executedAt, cutoffDate));
    }

    await db.insert(auditLogs).values({
      userId: null,
      action: "cleanup",
      entity: "automation_log",
      changes: {
        deletedCount: totalToDelete,
        retentionDays: AUTOMATION_LOG_RETENTION_DAYS,
        cutoffDate: cutoffDate.toISOString(),
        mode: "automatic_cron",
      },
      ipAddress: "internal-cron",
      userAgent: "cron.server",
    });

    console.log(`[CRON] Automation logs retention done. Deleted ${totalToDelete} logs older than ${AUTOMATION_LOG_RETENTION_DAYS} days`);
  } catch (error) {
    console.error("[CRON] Error cleaning old automation logs:", error);
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTOMAÇÕES PESSOAIS — OpenClaw
// ═══════════════════════════════════════════════════════════════

/**
 * Coleta e resume notícias diárias por tema e envia via Telegram
 * Roda todo dia às 7h
 */
async function sendDailyNewsDigest() {
  const gnewsKey = process.env.GNEWS_API_KEY;
  // Usa bot dedicado de notícias (@lhfex_noticias_bot) se configurado, senão fallback para OpenClaw
  const botToken = process.env.NEWS_BOT_TOKEN || process.env.OPENCLAW_TELEGRAM_TOKEN;
  const chatId = process.env.NEWS_BOT_CHAT_ID || process.env.OPENCLAW_CHAT_ID;

  if (!gnewsKey || !botToken || !chatId) {
    console.log("[CRON] news_daily_digest: GNEWS_API_KEY, NEWS_BOT_TOKEN ou chat ID não configurados — pulando");
    return;
  }

  try {
    // Temas configurados via variável de ambiente (separados por vírgula)
    // Formato: "tecnologia:technology,finanças:business,brasil:brazil"
    const topicsEnv = process.env.NEWS_TOPICS || "tecnologia:technology,inteligência artificial:technology,mercado financeiro:business";
    const topicPairs = topicsEnv.split(",").map(t => {
      const [label, category] = t.split(":");
      return { label: label.trim(), category: (category || "").trim() };
    });

    const allArticles: string[] = [];

    for (const topic of topicPairs.slice(0, 4)) { // máximo 4 temas
      try {
        const url = new URL("https://gnews.io/api/v4/search");
        url.searchParams.set("q", topic.label);
        url.searchParams.set("lang", "pt");
        url.searchParams.set("max", "3");
        url.searchParams.set("sortby", "publishedAt");
        url.searchParams.set("apikey", gnewsKey);

        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;

        const data = await res.json() as { articles?: Array<{ title: string; description: string; url: string; source: { name: string } }> };
        const articles = data.articles?.slice(0, 3) ?? [];

        if (articles.length > 0) {
          allArticles.push(`📌 *${topic.label.toUpperCase()}*`);
          for (const a of articles) {
            const desc = a.description ? ` — ${a.description.slice(0, 100)}` : "";
            allArticles.push(`• ${a.title}${desc}\n  _${a.source.name}_ | [Ver mais](${a.url})`);
          }
          allArticles.push("");
        }
      } catch (topicErr) {
        console.warn(`[CRON] news_daily_digest: falha ao buscar tema "${topic.label}":`, topicErr);
      }
    }

    if (allArticles.length === 0) {
      console.log("[CRON] news_daily_digest: nenhum artigo encontrado");
      return;
    }

    // IA resume e comenta as notícias
    const rawNews = allArticles.join("\n");
    const aiPrompt = `Você recebeu as seguintes notícias do dia:\n\n${rawNews}\n\nFaça um briefing matinal conciso em português. Para cada tema, destaque o que é mais relevante e importante. Seja direto e use no máximo 3 linhas por tema. Termine com uma frase motivacional curta.`;

    let summaryText: string;
    try {
      const aiResponse = await askAgent("openclaw", aiPrompt, "system", { feature: "openclaw" });
      summaryText = aiResponse.content;
    } catch {
      // Fallback: envia notícias brutas sem resumo de IA
      summaryText = rawNews;
    }

    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const message = `📰 *NOTÍCIAS DO DIA — ${today.toUpperCase()}*\n\n${summaryText}`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: message.slice(0, 4000),
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    console.log(`[CRON] news_daily_digest: enviado com ${topicPairs.length} temas`);
  } catch (error) {
    console.error("[CRON] news_daily_digest error:", error);
  }
}

/**
 * Monitora recursos da VPS e alerta via Telegram quando ≥ 80%
 * Roda a cada hora
 */
async function checkVpsResources() {
  // Monitor VPS → usa bot dedicado @lhfex_monitor_bot (MONITOR_BOT_TOKEN)
  // Fallback: bot principal LHFEX Agentes
  const botToken = process.env.MONITOR_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.MONITOR_BOT_CHAT_ID || process.env.OPENCLAW_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("[CRON] vps_monitor: MONITOR_BOT_TOKEN ou chat ID não configurados — pulando");
    return;
  }

  try {
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const ramPct = Math.round((usedRam / totalRam) * 100);

    const cpuLoad = os.loadavg()[0]; // média 1 min
    const cpuCount = os.cpus().length;
    const cpuPct = Math.round((cpuLoad / cpuCount) * 100);

    const uptimeHours = Math.round(os.uptime() / 3600);

    const toGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(1);

    // Disco — usa /proc/mounts se disponível (Linux)
    let diskPct = 0;
    let diskUsedGB = "?";
    let diskTotalGB = "?";
    try {
      // Lê uso do disco via df-like approach em Node.js
      const { execSync } = await import("node:child_process");
      const dfOutput = execSync("df / --output=pcent,used,size -B G 2>/dev/null | tail -1", { timeout: 3000 }).toString().trim();
      const parts = dfOutput.split(/\s+/);
      if (parts.length >= 3) {
        diskPct = parseInt(parts[0].replace("%", ""), 10);
        diskUsedGB = parts[1].replace("G", "");
        diskTotalGB = parts[2].replace("G", "");
      }
    } catch {
      // df não disponível — pula disco
    }

    const ALERT_THRESHOLD = 80;
    const issues: string[] = [];
    if (ramPct >= ALERT_THRESHOLD) issues.push(`🧠 RAM: ${ramPct}%`);
    if (cpuPct >= ALERT_THRESHOLD) issues.push(`⚡ CPU: ${cpuPct}%`);
    if (diskPct >= ALERT_THRESHOLD) issues.push(`💾 Disco: ${diskPct}%`);

    if (issues.length > 0) {
      // Há problema — envia alerta
      const tips: Record<string, string> = {
        "🧠 RAM": "Reiniciar app ou verificar memory leaks",
        "⚡ CPU": "Verificar processos intensivos no servidor",
        "💾 Disco": "Limpar logs antigos: `npm run db:cleanup` ou remover arquivos temporários",
      };

      const tipsText = issues.map(i => {
        const key = Object.keys(tips).find(k => i.startsWith(k));
        return key ? `💡 ${tips[key]}` : "";
      }).filter(Boolean).join("\n");

      const alertMsg = `🔴 *ALERTA VPS HOSTINGER*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        issues.join("\n") + "\n" +
        `━━━━━━━━━━━━━━━━\n` +
        `🧠 RAM: ${toGB(usedRam)}GB / ${toGB(totalRam)}GB (${ramPct}%)\n` +
        `⚡ CPU: ${cpuPct}% (${cpuCount} cores, load: ${cpuLoad.toFixed(2)})\n` +
        (diskPct > 0 ? `💾 Disco: ${diskUsedGB}GB / ${diskTotalGB}GB (${diskPct}%)\n` : "") +
        `⏱️ Uptime: ${uptimeHours}h\n` +
        `━━━━━━━━━━━━━━━━\n` +
        tipsText;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: Number(chatId), text: alertMsg, parse_mode: "Markdown" }),
        signal: AbortSignal.timeout(10000),
      });

      console.log(`[CRON] vps_monitor: ALERTA enviado — RAM ${ramPct}%, CPU ${cpuPct}%, Disco ${diskPct}%`);
    } else {
      console.log(`[CRON] vps_monitor: OK — RAM ${ramPct}%, CPU ${cpuPct}%, Disco ${diskPct}%, Uptime ${uptimeHours}h`);
    }
  } catch (error) {
    console.error("[CRON] vps_monitor error:", error);
  }
}

/**
 * Resumo financeiro pessoal semanal — toda segunda às 8h
 */
async function sendWeeklyPersonalFinanceSummary() {
  const botToken = process.env.OPENCLAW_TELEGRAM_TOKEN;
  const chatId = process.env.OPENCLAW_CHAT_ID;
  const userId = process.env.OPENCLAW_USER_ID; // ID do usuário dono do OpenClaw

  if (!botToken || !chatId || !userId) {
    console.log("[CRON] personal_finance_weekly: env vars não configuradas — pulando");
    return;
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const transactions = await db
      .select()
      .from(personalFinance)
      .where(
        and(
          eq(personalFinance.userId, userId),
          sql`${personalFinance.date} >= ${sevenDaysAgo.toISOString().slice(0, 10)}`
        )
      )
      .limit(100);

    if (transactions.length === 0) {
      console.log("[CRON] personal_finance_weekly: sem transações esta semana");
      return;
    }

    const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const balance = income - expense;

    // Agrupar por categoria
    const byCategory: Record<string, number> = {};
    for (const t of transactions.filter(t => t.type === "expense")) {
      byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount);
    }
    const topCategories = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, val]) => `• ${cat}: R$ ${val.toFixed(2)}`);

    const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
    const msg = `📊 *RESUMO FINANCEIRO PESSOAL*\n_Semana passada_\n\n` +
      `💚 Receitas: ${fmtBRL(income)}\n` +
      `🔴 Despesas: ${fmtBRL(expense)}\n` +
      `${balance >= 0 ? "✅" : "⚠️"} Saldo: ${fmtBRL(balance)}\n\n` +
      `📌 *Top categorias de gasto:*\n${topCategories.join("\n")}\n\n` +
      `_${transactions.length} transações no período_`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: Number(chatId), text: msg, parse_mode: "Markdown" }),
      signal: AbortSignal.timeout(10000),
    });

    console.log("[CRON] personal_finance_weekly: resumo enviado");
  } catch (error) {
    console.error("[CRON] personal_finance_weekly error:", error);
  }
}

// ═══════════════════════════════════════════════════════════════
// ALERTAS DE VENCIMENTOS — @lhfex_monitor_bot
// ═══════════════════════════════════════════════════════════════

/** Formata barra de progresso ASCII: makeProgressBar(78) → "████████░░ 78%" */
function makeProgressBar(pct: number, blocks = 10): string {
  const filled = Math.round((Math.min(pct, 100) / 100) * blocks);
  const empty = blocks - filled;
  return "█".repeat(filled) + "░".repeat(empty) + ` ${pct}%`;
}

/**
 * Envia alertas de vencimentos próximos via @lhfex_monitor_bot
 * Roda todo dia às 8h — só envia se houver vencimentos no horizonte
 */
async function sendBillsAlert() {
  const botToken = process.env.MONITOR_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.MONITOR_BOT_CHAT_ID || process.env.OPENCLAW_CHAT_ID;
  const userId = process.env.OPENCLAW_USER_ID;

  if (!botToken || !chatId || !userId) {
    console.log("[CRON] bills_alert: env vars não configuradas — pulando");
    return;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0]!;

    // Busca todos os bills ativos do usuário
    const activeBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.status, "active"),
          isNull(bills.deletedAt),
        )
      );

    type AlertBill = {
      id: string;
      name: string;
      amount: string;
      nextDueDate: string;
      isAutoDebit: boolean | null;
      alertDaysBefore: number | null;
      alertOneDayBefore: boolean | null;
      daysUntil: number;
    };

    // Filtra bills que devem ser alertados hoje
    const toAlert: AlertBill[] = [];
    for (const bill of activeBills) {
      const dueDate = new Date(bill.nextDueDate + "T00:00:00");
      const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const alertDays = bill.alertDaysBefore ?? 3;

      const shouldAlert =
        daysUntil < 0 || // Atrasado
        (daysUntil <= alertDays) || // Dentro do horizonte configurado
        (daysUntil === 1 && (bill.alertOneDayBefore ?? true)); // Amanhã com 1d-before

      if (shouldAlert) {
        toAlert.push({ ...bill, daysUntil });
      }
    }

    if (toAlert.length === 0) {
      console.log("[CRON] bills_alert: sem vencimentos próximos hoje");
      return;
    }

    // Ordena por urgência
    toAlert.sort((a, b) => a.daysUntil - b.daysUntil);

    const fmtBRL = (v: string) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v));

    const formatDay = (days: number) => {
      if (days < 0) return `🔴 ${Math.abs(days)}d ATRASADO`;
      if (days === 0) return "🔴 HOJE";
      if (days === 1) return "🟡 AMANHÃ";
      if (days <= 3) return `🟠 Em ${days} dias`;
      return `⚪ Em ${days} dias`;
    };

    const lines = toAlert.map(b => {
      const auto = b.isAutoDebit ? " ✅ auto" : "";
      return `${formatDay(b.daysUntil)}: *${b.name}* — ${fmtBRL(b.amount)}${auto}`;
    });

    const totalAmount = toAlert.reduce((s, b) => s + parseFloat(b.amount), 0);
    const dateFormatted = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const msg =
      `🔔 *ALERTAS DE VENCIMENTO — ${dateFormatted}*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      lines.join("\n") + "\n" +
      `━━━━━━━━━━━━━━━━\n` +
      `💳 Total no período: ${fmtBRL(totalAmount.toString())}`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: msg,
        parse_mode: "Markdown",
      }),
      signal: AbortSignal.timeout(10000),
    });

    console.log(`[CRON] bills_alert: ${toAlert.length} vencimentos alertados`);
  } catch (error) {
    console.error("[CRON] bills_alert error:", error);
  }
}

/**
 * Relatório semanal completo da VPS — todo domingo às 9h
 * SEMPRE envia (não só quando há alertas)
 */
async function sendVpsWeeklyReport() {
  const botToken = process.env.MONITOR_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.MONITOR_BOT_CHAT_ID || process.env.OPENCLAW_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("[CRON] vps_weekly_report: env vars não configuradas — pulando");
    return;
  }

  try {
    // ── Coleta de métricas ──
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const ramPct = Math.round((usedRam / totalRam) * 100);

    const cpuLoad = os.loadavg()[0]; // média 1 min
    const cpuCount = os.cpus().length;
    const cpuPct = Math.min(Math.round((cpuLoad / cpuCount) * 100), 100);

    const uptimeSecs = os.uptime();
    const uptimeDays = Math.floor(uptimeSecs / 86400);
    const uptimeHours = Math.floor((uptimeSecs % 86400) / 3600);

    const toGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(1);

    let diskPct = 0;
    let diskUsedGB = "?";
    let diskTotalGB = "?";
    try {
      const { execSync } = await import("node:child_process");
      const dfOutput = execSync("df / --output=pcent,used,size -B G 2>/dev/null | tail -1", { timeout: 3000 }).toString().trim();
      const parts = dfOutput.split(/\s+/);
      if (parts.length >= 3) {
        diskPct = parseInt(parts[0]!.replace("%", ""), 10);
        diskUsedGB = parts[1]!.replace("G", "");
        diskTotalGB = parts[2]!.replace("G", "");
      }
    } catch {
      // df não disponível
    }

    // ── Monta mensagem com barras de progresso ──
    const WARN = 80;
    const ramWarn = ramPct >= WARN ? " ⚠️" : "";
    const cpuWarn = cpuPct >= WARN ? " ⚠️" : "";
    const diskWarn = diskPct >= WARN ? " ⚠️" : "";

    const dateFormatted = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const hasIssue = ramPct >= WARN || cpuPct >= WARN || diskPct >= WARN;
    const statusLine = hasIssue
      ? "⚠️ *Atenção: algum recurso está próximo do limite!*"
      : "✅ *Tudo dentro do normal.*";

    const msg =
      `📊 *RELATÓRIO SEMANAL VPS — ${dateFormatted}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🧠 RAM:   ${makeProgressBar(ramPct)}${ramWarn}\n` +
      `       ${toGB(usedRam)}GB / ${toGB(totalRam)}GB\n` +
      (diskPct > 0
        ? `💾 Disco: ${makeProgressBar(diskPct)}${diskWarn}\n` +
          `       ${diskUsedGB}GB / ${diskTotalGB}GB\n`
        : `💾 Disco: (não disponível)\n`) +
      `⚡ CPU:   ${makeProgressBar(cpuPct)}${cpuWarn}\n` +
      `       load: ${cpuLoad.toFixed(2)} | ${cpuCount} core(s)\n` +
      `⏱️ Uptime: ${uptimeDays} dias ${uptimeHours}h\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      statusLine;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: msg,
        parse_mode: "Markdown",
      }),
      signal: AbortSignal.timeout(10000),
    });

    console.log(`[CRON] vps_weekly_report: enviado — RAM ${ramPct}%, CPU ${cpuPct}%, Disco ${diskPct}%`);
  } catch (error) {
    console.error("[CRON] vps_weekly_report error:", error);
  }
}

/**
 * Manually trigger a cron job (for testing/API calls)
 */
export async function triggerCronJob(jobName: string): Promise<void> {
  const job = jobs.find((j) => j.name === jobName);
  if (!job) throw new Error(`Cron job "${jobName}" not found`);
  
  console.log(`[CRON] Manually triggering job: ${jobName}`);
  await job.handler();
}

/**
 * Get list of all registered cron jobs
 */
export function listCronJobs() {
  return jobs.map((j) => ({ name: j.name, expression: j.cronExpression }));
}
