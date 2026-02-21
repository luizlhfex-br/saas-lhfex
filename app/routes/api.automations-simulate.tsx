import { data } from "react-router";
import type { Route } from "./+types/api.automations-simulate";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { buildApiError } from "~/lib/api-error";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const automationId = formData.get("automationId") as string;

  if (!automationId) {
    return data(buildApiError("INVALID_INPUT", "automationId is required"), { status: 400 });
  }

  const [automation] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, automationId))
    .limit(1);

  if (!automation) {
    return data(buildApiError("INVALID_INPUT", "Automation not found"), { status: 404 });
  }

  const simulation: Record<string, unknown> = {
    automationId: automation.id,
    automationName: automation.name,
    triggerType: automation.triggerType,
    triggerConfig: automation.triggerConfig,
    actionType: automation.actionType,
    actionConfig: automation.actionConfig,
    wouldExecute: automation.enabled,
    simulatedAt: new Date().toISOString(),
    expectedOutcome: "",
  };

  switch (automation.actionType) {
    case "create_notification":
      simulation.expectedOutcome = `Criaria notificação para usuário ${(automation.actionConfig as any).userId || "default"}`;
      break;
    case "send_email":
      simulation.expectedOutcome = `Envaria e-mail para ${(automation.actionConfig as any).to || "destinatário configurado"}`;
      break;
    case "call_agent":
      simulation.expectedOutcome = `Chamaria agente IA (${(automation.actionConfig as any).agentId || "default"})`;
      break;
    case "webhook":
      simulation.expectedOutcome = `Faria POST para ${(automation.actionConfig as any).url || "webhook configurado"}`;
      break;
    default:
      simulation.expectedOutcome = `Executaria ação ${automation.actionType}`;
  }

  return data({
    ok: true,
    simulation,
    dryRun: true,
    timestamp: new Date().toISOString(),
  });
}
