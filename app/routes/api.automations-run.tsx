import { data } from "react-router";
import type { Route } from "./+types/api.automations-run";
import { requireAuth } from "~/lib/auth.server";
import { runAutomationManually } from "~/lib/automation-engine.server";
import { checkRateLimit } from "~/lib/rate-limit.server";
import { db } from "~/lib/db.server";
import { automationLogs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { buildApiError } from "~/lib/api-error";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  let automationId = formData.get("automationId") as string;
  const logId = formData.get("logId") as string;

  const globalRate = await checkRateLimit(`automations-run:user:${user.id}`, 12, 60 * 1000);
  if (!globalRate.allowed) {
    return data(buildApiError("RATE_LIMITED", "Limite de execuções manuais atingido. Tente novamente em instantes."), {
      status: 429,
    });
  }

  let inputData: Record<string, unknown> = {};

  if (logId) {
    const [sourceLog] = await db
      .select({
        automationId: automationLogs.automationId,
        input: automationLogs.input,
      })
      .from(automationLogs)
      .where(eq(automationLogs.id, logId))
      .limit(1);

    if (!sourceLog) {
      return data(buildApiError("INVALID_INPUT", "Log de origem não encontrado"), { status: 404 });
    }

    automationId = automationId || sourceLog.automationId;
    const sourceInput = (sourceLog.input || {}) as Record<string, unknown>;

    inputData = Object.fromEntries(
      Object.entries(sourceInput).filter(([key]) => !key.startsWith("_manual")),
    );
    inputData._rerunFromLogId = logId;
  }

  if (!automationId) {
    return data(buildApiError("INVALID_INPUT", "automationId is required"), { status: 400 });
  }

  const automationRate = await checkRateLimit(`automations-run:user:${user.id}:automation:${automationId}`, 5, 60 * 1000);
  if (!automationRate.allowed) {
    return data(buildApiError("RATE_LIMITED", "Muitas execuções para esta automação. Aguarde 1 minuto."), {
      status: 429,
    });
  }

  try {
    const result = await runAutomationManually(automationId, {
      userId: user.id,
      email: user.email,
      name: user.name,
    }, inputData);

    return data({
      ok: true,
      automationId,
      mode: logId ? "rerun" : "manual",
      sourceLogId: logId || null,
      logId: result.logId,
      message: "Automation executed manually",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return data(
      buildApiError("INTERNAL_ERROR", error instanceof Error ? error.message : "Manual run failed"),
      { status: 400 },
    );
  }
}
