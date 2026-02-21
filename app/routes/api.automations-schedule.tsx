import { data } from "react-router";
import type { Route } from "./+types/api.automations-schedule";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "~/lib/audit.server";
import { buildApiError } from "~/lib/api-error";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const automationId = formData.get("automationId") as string;
  const cronExpression = formData.get("cronExpression") as string;
  const scheduleName = formData.get("scheduleName") as string;

  if (!automationId || !cronExpression) {
    return data(buildApiError("INVALID_INPUT", "automationId and cronExpression are required"), { status: 400 });
  }

  const parts = cronExpression.split(" ");
  if (parts.length !== 5) {
    return data(
      buildApiError("INVALID_INPUT", "Invalid cron format. Expected: minute hour day month dayofweek"),
      { status: 400 },
    );
  }

  const [automation] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, automationId))
    .limit(1);

  if (!automation) {
    return data(buildApiError("INVALID_INPUT", "Automation not found"), { status: 404 });
  }

  const newConfig = {
    ...(automation.triggerConfig as Record<string, unknown>),
    scheduledCron: cronExpression,
    scheduledName: scheduleName || "Execução agendada",
    scheduledEnabled: true,
  };

  await db
    .update(automations)
    .set({
      triggerConfig: newConfig,
      updatedAt: new Date(),
    })
    .where(eq(automations.id, automationId));

  await logAudit({
    userId: user.id,
    action: "update",
    entity: "automation_log",
    entityId: automationId,
    changes: {
      scheduledCron: cronExpression,
      scheduleName,
    },
    request,
  });

  return data({
    ok: true,
    automationId,
    cronExpression,
    scheduleName,
    message: "Schedule configured",
    timestamp: new Date().toISOString(),
  });
}
