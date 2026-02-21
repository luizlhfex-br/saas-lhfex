/**
 * POST /api/public-procurement-notices
 * GET /api/public-procurement-notices?page=1&status=published
 */

import type { Route } from "./+types/api.public-procurement-notices";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { publicProcurementNotices } from "drizzle/schema";
import { eq, and, isNull, desc, ilike } from "drizzle-orm";
import { fireTrigger } from "~/lib/automation-engine.server";
import { jsonApiError } from "~/lib/api-error";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q");
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  let query = db
    .select()
    .from(publicProcurementNotices)
    .where(and(eq(publicProcurementNotices.userId, user.id), isNull(publicProcurementNotices.deletedAt)))
    .$dynamic();

  if (status) query = query.where(eq(publicProcurementNotices.status, status));
  if (search) query = query.where(ilike(publicProcurementNotices.title, `%${search}%`));

  const allNotices = await query.orderBy(desc(publicProcurementNotices.createdAt));
  const notices = await query
    .limit(pageSize)
    .offset(offset)
    .then((rows) => rows);

  return Response.json({
    notices,
    pagination: { page, pageSize, total: allNotices.length, pages: Math.ceil(allNotices.length / pageSize) },
  });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const title = formData.get("title");
      const organizationName = formData.get("organizationName");
      const modalityCode = formData.get("modalityCode");
      const modalityLabel = formData.get("modalityLabel");
      const status = formData.get("status") ?? "draft";
      const budgetEstimate = formData.get("budgetEstimate");
      const closureDate = formData.get("closureDate");
      const description = formData.get("description");

      // Auto-generate process number
      const today = new Date();
      const year = today.getFullYear();
      const allNotices = await db
        .select({ processNumber: publicProcurementNotices.processNumber })
        .from(publicProcurementNotices)
        .where(eq(publicProcurementNotices.userId, user.id));
      const nextNum = allNotices.length + 1;
      const processNumber = `UPA-${year}-${String(nextNum).padStart(3, "0")}`;

      const newNotice = await db
        .insert(publicProcurementNotices)
        .values({
          userId: user.id,
          title: String(title),
          organizationName: String(organizationName),
          modalityCode: String(modalityCode),
          modalityLabel: String(modalityLabel),
          processNumber,
          status: String(status),
          budgetEstimate: budgetEstimate ? String(budgetEstimate) : undefined,
          description: description ? String(description) : undefined,
          createdBy: user.id,
        })
        .returning();

      // Trigger para nova compra pública
      await fireTrigger({
        type: "public_procurement_created",
        userId: user.id,
        data: {
          noticeId: newNotice[0].id,
          title: String(title),
          processNumber,
          closureDate: String(closureDate),
        },
      });

      return Response.json({ success: true, notice: newNotice[0] }, { status: 201 });
    }

    if (intent === "update") {
      const id = formData.get("noticeId");
      const status = formData.get("status");
      const closureDate = formData.get("closureDate");
      const contractedValue = formData.get("contractedValue");

      const updated = await db
        .update(publicProcurementNotices)
        .set({
          ...(status && { status: String(status) }),
          ...(closureDate && { closureDate: String(closureDate) }),
          ...(contractedValue && { contractedValue: String(contractedValue) }),
          updatedAt: new Date(),
        })
        .where(and(eq(publicProcurementNotices.id, String(id)), eq(publicProcurementNotices.userId, user.id)))
        .returning();

      return Response.json({ success: true, notice: updated[0] });
    }

    if (intent === "delete") {
      const id = formData.get("noticeId");
      const reason = formData.get("reason") ?? "Exclusão solicitada pelo usuário";

      // Soft delete
      await db
        .update(publicProcurementNotices)
        .set({ deletedAt: new Date() })
        .where(and(eq(publicProcurementNotices.id, String(id)), eq(publicProcurementNotices.userId, user.id)));

      // Trigger para cancelamento
      await fireTrigger({
        type: "public_procurement_cancelled",
        userId: user.id,
        data: {
          noticeId: id,
          reason,
        },
      });

      return Response.json({ success: true });
    }
  }

  return jsonApiError("METHOD_NOT_ALLOWED", "Method not allowed", { status: 405 });
}
