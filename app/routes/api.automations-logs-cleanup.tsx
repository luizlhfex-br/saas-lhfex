import { data } from "react-router";
import type { Route } from "./+types/api.automations-logs-cleanup";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automationLogs } from "../../drizzle/schema";
import { lt } from "drizzle-orm";
import { logAudit } from "~/lib/audit.server";

const CONFIRM_TEXT = "LIMPAR LOGS";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
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
    .where(lt(automationLogs.executedAt, cutoffDate));

  const deletedCount = candidates.length;

  if (deletedCount > 0) {
    await db.delete(automationLogs).where(lt(automationLogs.executedAt, cutoffDate));
  }

  await logAudit({
    userId: user.id,
    action: "cleanup",
    entity: "automation_log",
    changes: {
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
