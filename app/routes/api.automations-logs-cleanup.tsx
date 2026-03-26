import { data } from "react-router";
import type { Route } from "./+types/api.automations-logs-cleanup";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automationLogs, automations } from "../../drizzle/schema";
import { and, eq, inArray, lt } from "drizzle-orm";
import { logAudit } from "~/lib/audit.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";

const CONFIRM_TEXT = "LIMPAR LOGS";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();

  const confirmation = String(formData.get("confirmation") || "").trim().toUpperCase();
  const retentionDaysRaw = parseInt(String(formData.get("retentionDays") || "90"), 10);
  const retentionDays = Number.isFinite(retentionDaysRaw) ? Math.min(Math.max(retentionDaysRaw, 1), 3650) : 90;

  if (confirmation !== CONFIRM_TEXT) {
    return data({ error: `Confirmação inválida. Digite \"${CONFIRM_TEXT}\".` }, { status: 400 });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const candidates = await db
    .select({ id: automationLogs.id })
    .from(automationLogs)
    .innerJoin(automations, eq(automationLogs.automationId, automations.id))
    .where(and(lt(automationLogs.executedAt, cutoffDate), eq(automations.companyId, companyId)));

  const deletedCount = candidates.length;

  if (deletedCount > 0) {
    await db.delete(automationLogs).where(inArray(automationLogs.id, candidates.map((candidate) => candidate.id)));
  }

  await logAudit({
    userId: user.id,
    action: "cleanup",
    entity: "automation_log",
    changes: {
      companyId,
      deletedCount,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    },
    request,
  });

  return data({
    ok: true,
    deletedCount,
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  });
}
