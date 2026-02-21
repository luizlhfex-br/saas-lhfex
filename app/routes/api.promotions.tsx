/**
 * POST /api/promotions
 * GET /api/promotions?status=pending&sort=endDate
 */

import type { Route } from "./+types/api.promotions";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { promotions } from "../../drizzle/schema";
import { eq, and, desc, isNull, lte, gte } from "drizzle-orm";
import { fireTrigger } from "~/lib/automation-engine.server";
import { jsonApiError } from "~/lib/api-error";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");

  let query = db
    .select()
    .from(promotions)
    .where(and(eq(promotions.userId, user.id), isNull(promotions.deletedAt)))
    .$dynamic();

  if (status) {
    query = query.where(eq(promotions.participationStatus, status));
  }

  if (type) {
    query = query.where(eq(promotions.type, type));
  }

  const promos = await query.orderBy(desc(promotions.endDate));

  // Count by status
  const countByStatus = {
    pending: promos.filter((p) => p.participationStatus === "pending").length,
    participated: promos.filter((p) => p.participationStatus === "participated").length,
    won: promos.filter((p) => p.participationStatus === "won").length,
    lost: promos.filter((p) => p.participationStatus === "lost").length,
  };

  return Response.json({ promotions: promos, countByStatus });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const name = formData.get("name");
      const company = formData.get("company");
      const type = formData.get("type");
      const startDate = formData.get("startDate");
      const endDate = formData.get("endDate");
      const prize = formData.get("prize");
      const link = formData.get("link");

      const promo = await db
        .insert(promotions)
        .values({
          userId: user.id,
          name: String(name),
          company: String(company),
          type: String(type),
          startDate: String(startDate),
          endDate: String(endDate),
          prize: prize ? String(prize) : undefined,
          link: link ? String(link) : undefined,
          participationStatus: "pending",
        })
        .returning();

      // Trigger para nova promoção
      await fireTrigger({
        type: "promotion_created",
        userId: user.id,
        data: {
          promotionId: promo[0].id,
          name: String(name),
          endDate: String(endDate),
        },
      });

      return Response.json({ success: true, promotion: promo[0] }, { status: 201 });
    }

    if (intent === "update-status") {
      const promotionId = formData.get("promotionId");
      const newStatus = formData.get("status");
      const proofOfParticipation = formData.get("proofOfParticipation");

      const updated = await db
        .update(promotions)
        .set({
          participationStatus: String(newStatus),
          ...(proofOfParticipation && { proofOfParticipation: String(proofOfParticipation) }),
          updatedAt: new Date(),
        })
        .where(and(eq(promotions.id, String(promotionId)), eq(promotions.userId, user.id)))
        .returning();

      if (newStatus === "won") {
        await fireTrigger({
          type: "promotion_won",
          userId: user.id,
          data: {
            promotionId,
            prize: updated[0].prize,
          },
        });
      }

      return Response.json({ success: true, promotion: updated[0] });
    }

    if (intent === "delete") {
      const promotionId = formData.get("promotionId");

      await db
        .update(promotions)
        .set({ deletedAt: new Date() })
        .where(and(eq(promotions.id, String(promotionId)), eq(promotions.userId, user.id)));

      return Response.json({ success: true });
    }
  }

  return jsonApiError("METHOD_NOT_ALLOWED", "Method not allowed", { status: 405 });
}
