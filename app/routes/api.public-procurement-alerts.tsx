/**
 * POST /api/public-procurement-alerts
 * GET /api/public-procurement-alerts?noticeId=xxx&severity=critical
 */

import type { Route } from "./+types/api.public-procurement-alerts";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { procurementAlerts, publicProcurementNotices } from "drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { jsonApiError } from "~/lib/api-error";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  const url = new URL(request.url);
  const noticeId = url.searchParams.get("noticeId");
  const severity = url.searchParams.get("severity");

  // Get user's notices for access control
  const userNotices = await db
    .select({ id: publicProcurementNotices.id })
    .from(publicProcurementNotices)
    .where(eq(publicProcurementNotices.userId, user.id));

  const noticeIds = userNotices.map((n) => n.id);

  let query = db.select().from(procurementAlerts).$dynamic();

  if (noticeId) {
    if (!noticeIds.includes(noticeId)) return jsonApiError("FORBIDDEN_MODULE", "Not authorized", { status: 403 });
    query = query.where(eq(procurementAlerts.noticeId, noticeId));
  } else if (noticeIds.length > 0) {
    query = query.where(inArray(procurementAlerts.noticeId, noticeIds));
  } else {
    return Response.json({ alerts: [] });
  }

  if (severity) query = query.where(eq(procurementAlerts.severity, severity));

  const alerts = await query
    .where(eq(procurementAlerts.status, "pending"))
    .orderBy(desc(procurementAlerts.dueDate));

  return Response.json({ alerts });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const noticeId = formData.get("noticeId");
      const alertType = formData.get("alertType");
      const title = formData.get("title");
      const dueDate = formData.get("dueDate");
      const severity = formData.get("severity");
      const description = formData.get("description");

      // Verify ownership
      const notice = await db
        .select()
        .from(publicProcurementNotices)
        .where(and(eq(publicProcurementNotices.id, String(noticeId)), eq(publicProcurementNotices.userId, user.id)))
        .limit(1);

      if (!notice.length) return jsonApiError("INVALID_INPUT", "Notice not found", { status: 404 });

      const newAlert = await db
        .insert(procurementAlerts)
        .values({
          noticeId: String(noticeId),
          alertType: String(alertType),
          title: String(title),
          dueDate: String(dueDate),
          severity: String(severity),
          description: description ? String(description) : undefined,
          status: "pending",
        })
        .returning();

      return Response.json({ success: true, alert: newAlert[0] }, { status: 201 });
    }

    if (intent === "acknowledge") {
      const alertId = formData.get("alertId");

      const updated = await db
        .update(procurementAlerts)
        .set({ status: "acknowledged", updatedAt: new Date() })
        .where(eq(procurementAlerts.id, String(alertId)))
        .returning();

      return Response.json({ success: true, alert: updated[0] });
    }

    if (intent === "resolve") {
      const alertId = formData.get("alertId");

      const updated = await db
        .update(procurementAlerts)
        .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
        .where(eq(procurementAlerts.id, String(alertId)))
        .returning();

      return Response.json({ success: true, alert: updated[0] });
    }
  }

  return jsonApiError("METHOD_NOT_ALLOWED", "Method not allowed", { status: 405 });
}
