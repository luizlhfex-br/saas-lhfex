/**
 * Automation Engine — Evaluates triggers and executes actions
 * Called from backend when events occur (process status change, etc.)
 */

import { db } from "~/lib/db.server";
import { automations, automationLogs, notifications } from "drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sendProcessStatusUpdate } from "~/lib/email.server";

type TriggerType = "process_status_change" | "invoice_due_soon" | "new_client" | "eta_approaching" | "scheduled";

interface TriggerEvent {
  type: TriggerType;
  data: Record<string, unknown>;
  userId?: string;
}

/**
 * Fire a trigger event — finds matching automations and executes them
 */
export async function fireTrigger(event: TriggerEvent): Promise<void> {
  try {
    const activeAutomations = await db
      .select()
      .from(automations)
      .where(and(eq(automations.enabled, true), eq(automations.triggerType, event.type)));

    for (const automation of activeAutomations) {
      try {
        const shouldRun = evaluateTrigger(automation.triggerConfig as Record<string, unknown>, event);
        if (!shouldRun) {
          await db.insert(automationLogs).values({
            automationId: automation.id,
            status: "skipped",
            input: event.data,
            output: { reason: "Trigger condition not met" },
          });
          continue;
        }

        await executeAction(automation, event);

        await db.insert(automationLogs).values({
          automationId: automation.id,
          status: "success",
          input: event.data,
          output: { action: automation.actionType },
        });
      } catch (error) {
        console.error(`[AUTOMATION] Error executing "${automation.name}":`, error);
        await db.insert(automationLogs).values({
          automationId: automation.id,
          status: "error",
          input: event.data,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    console.error("[AUTOMATION] Failed to process trigger:", error);
  }
}

function evaluateTrigger(config: Record<string, unknown>, event: TriggerEvent): boolean {
  switch (event.type) {
    case "process_status_change": {
      const targetStatus = config.targetStatus as string | undefined;
      if (targetStatus && event.data.newStatus !== targetStatus) return false;
      return true;
    }
    case "invoice_due_soon": {
      const daysBeforeDue = (config.daysBeforeDue as number) || 3;
      const daysLeft = event.data.daysUntilDue as number;
      return daysLeft <= daysBeforeDue;
    }
    case "new_client":
      return true;
    case "eta_approaching": {
      const hoursBeforeEta = (config.hoursBeforeEta as number) || 48;
      const hoursLeft = event.data.hoursUntilEta as number;
      return hoursLeft <= hoursBeforeEta;
    }
    default:
      return true;
  }
}

async function executeAction(
  automation: typeof automations.$inferSelect,
  event: TriggerEvent,
): Promise<void> {
  const config = automation.actionConfig as Record<string, unknown>;

  switch (automation.actionType) {
    case "create_notification": {
      const userId = (config.userId as string) || event.userId || automation.createdBy;
      if (!userId) break;

      const title = interpolate((config.title as string) || automation.name, event.data);
      const message = interpolate((config.message as string) || `Automação "${automation.name}" executada.`, event.data);
      const link = (config.link as string) || undefined;

      await db.insert(notifications).values({
        userId,
        type: "automation",
        title,
        message,
        link,
      });
      break;
    }

    case "send_email": {
      const to = (config.to as string) || (event.data.contactEmail as string);
      if (!to) break;

      await sendProcessStatusUpdate({
        to,
        processRef: (event.data.processRef as string) || "",
        oldStatus: (event.data.oldStatus as string) || "",
        newStatus: (event.data.newStatus as string) || "",
        clientName: (event.data.clientName as string) || "",
      });
      break;
    }

    case "call_agent": {
      // For now, import dynamically to avoid circular deps
      const { askAgent } = await import("~/lib/ai.server");
      const agentId = (config.agentId as string) || "airton";
      const prompt = interpolate((config.prompt as string) || "Analise este evento: {{event}}", {
        ...event.data,
        event: JSON.stringify(event.data),
      });

      const response = await askAgent(agentId, prompt, automation.createdBy || "system");

      // Store AI response as notification if userId available
      const userId = automation.createdBy || event.userId;
      if (userId) {
        await db.insert(notifications).values({
          userId,
          type: "automation",
          title: `IA (${agentId}): ${automation.name}`,
          message: response.content.slice(0, 500),
        });
      }
      break;
    }

    case "webhook": {
      const url = config.url as string;
      if (!url) break;

      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          automation: automation.name,
          trigger: automation.triggerType,
          data: event.data,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      });
      break;
    }
  }
}

/** Replace {{key}} placeholders in templates */
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ""));
}
