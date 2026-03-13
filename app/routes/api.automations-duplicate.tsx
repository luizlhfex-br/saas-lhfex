import { data } from "react-router";
import type { Route } from "./+types/api.automations-duplicate";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "~/lib/audit.server";
import { buildApiError } from "~/lib/api-error";
import { getPrimaryCompanyId } from "~/lib/company-context.server";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();
  const automationId = formData.get("automationId") as string;
  const newName = formData.get("newName") as string;

  if (!automationId || !newName) {
    return data(buildApiError("INVALID_INPUT", "automationId and newName are required"), { status: 400 });
  }

  const [source] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, automationId), eq(automations.companyId, companyId)))
    .limit(1);

  if (!source) {
    return data(buildApiError("INVALID_INPUT", "Source automation not found"), { status: 404 });
  }

  const [clone] = await db
    .insert(automations)
    .values({
      companyId,
      name: newName,
      description: source.description,
      triggerType: source.triggerType,
      triggerConfig: source.triggerConfig,
      actionType: source.actionType,
      actionConfig: source.actionConfig,
      enabled: false,
      createdBy: user.id,
    })
    .returning({ id: automations.id });

  await logAudit({
    userId: user.id,
    action: "create",
    entity: "automation_log",
    entityId: clone.id,
    changes: {
      clonedFrom: automationId,
      newName,
    },
    request,
  });

  return data({
    ok: true,
    automationId: clone.id,
    sourceName: source.name,
    newName,
    message: "Automation duplicated successfully",
    timestamp: new Date().toISOString(),
  });
}
