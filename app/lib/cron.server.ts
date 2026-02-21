/**
 * Cron Engine — Scheduled background jobs
 * Runs on server start and executes registered cron tasks periodically
 */

import { db } from "./db.server";
import { invoices, processes, clients, automationLogs, auditLogs } from "../../drizzle/schema";
import { eq, lt, isNull, and, sql } from "drizzle-orm";
import { fireTrigger } from "./automation-engine.server";
import { enrichCNPJ } from "./ai.server";

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
