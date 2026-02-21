/**
 * POST /api/public-procurement-processes
 * GET /api/public-procurement-processes?noticeId=xxx&status=pending
 */

import type { Route } from "./+types/api.public-procurement-processes";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { publicProcurementProcesses, publicProcurementNotices } from "drizzle/schema";
import { eq, and } from "drizzle-orm";
import { fireTrigger } from "~/lib/automation-engine.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  const url = new URL(request.url);
  const noticeId = url.searchParams.get("noticeId");
  const status = url.searchParams.get("status");

  if (!noticeId) return Response.json({ error: "noticeId required" }, { status: 400 });

  // Verify user owns this notice
  const notice = await db
    .select()
    .from(publicProcurementNotices)
    .where(and(eq(publicProcurementNotices.id, noticeId), eq(publicProcurementNotices.userId, user.id)))
    .limit(1);

  if (!notice.length) return Response.json({ error: "Notice not found" }, { status: 404 });

  let query = db
    .select()
    .from(publicProcurementProcesses)
    .where(eq(publicProcurementProcesses.noticeId, noticeId))
    .$dynamic();

  if (status) query = query.where(eq(publicProcurementProcesses.status, status));

  const processes = await query;
  return Response.json({ processes });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const noticeId = formData.get("noticeId");
      const lotNumber = parseInt(formData.get("lotNumber") as string);
      const itemNumber = parseInt(formData.get("itemNumber") as string);
      const description = formData.get("description");
      const quantity = formData.get("quantity");
      const unit = formData.get("unit");
      const specifications = formData.get("specifications");

      // Verify ownership
      const notice = await db
        .select()
        .from(publicProcurementNotices)
        .where(and(eq(publicProcurementNotices.id, String(noticeId)), eq(publicProcurementNotices.userId, user.id)))
        .limit(1);

      if (!notice.length) return Response.json({ error: "Notice not found" }, { status: 404 });

      const newProcess = await db
        .insert(publicProcurementProcesses)
        .values({
          noticeId: String(noticeId),
          lotNumber,
          itemNumber,
          description: String(description),
          quantity: String(quantity),
          unit: String(unit),
          specifications: specifications ? String(specifications) : undefined,
          status: "pending",
        })
        .returning();

      // Trigger para novo item de compra
      await fireTrigger("procurement_process_created", {
        userId: user.id,
        processId: newProcess[0].id,
        description: String(description),
      });

      return Response.json({ success: true, process: newProcess[0] }, { status: 201 });
    }

    if (intent === "update-status") {
      const processId = formData.get("processId");
      const newStatus = formData.get("status");
      const contractorName = formData.get("contractorName");
      const contractorCnpj = formData.get("contractorCnpj");
      const agreedPrice = formData.get("agreedPrice");

      const updated = await db
        .update(publicProcurementProcesses)
        .set({
          status: String(newStatus),
          ...(contractorName && { contractorName: String(contractorName) }),
          ...(contractorCnpj && { contractorCnpj: String(contractorCnpj) }),
          ...(agreedPrice && { agreedPrice: String(agreedPrice) }),
          updatedAt: new Date(),
        })
        .where(eq(publicProcurementProcesses.id, String(processId)))
        .returning();

      return Response.json({ success: true, process: updated[0] });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
