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

  try {
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
  } catch {
    return jsonApiError("INTERNAL_ERROR", "Nao foi possivel carregar promocoes.", { status: 500 });
  }
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method !== "POST") {
    return jsonApiError("METHOD_NOT_ALLOWED", "Method not allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const name = String(formData.get("name") || "").trim();
      const company = String(formData.get("company") || "").trim();
      const type = String(formData.get("type") || "").trim();
      const startDate = String(formData.get("startDate") || "").trim();
      const endDate = String(formData.get("endDate") || "").trim();
      const prize = String(formData.get("prize") || "").trim();
      const link = String(formData.get("link") || "").trim();

      if (!name || !company || !type || !startDate || !endDate) {
        return jsonApiError("INVALID_INPUT", "Campos obrigatorios ausentes.", { status: 400 });
      }

      const promo = await db
        .insert(promotions)
        .values({
          userId: user.id,
          name,
          company,
          type,
          startDate,
          endDate,
          prize: prize || undefined,
          link: link || undefined,
          participationStatus: "pending",
        })
        .returning();

      // Trigger para nova promoção
      await fireTrigger({
        type: "promotion_created",
        userId: user.id,
        data: {
          promotionId: promo[0].id,
          name,
          endDate,
        },
      });

      return Response.json({ success: true, promotion: promo[0] }, { status: 201 });
    }

    if (intent === "update-status") {
      const promotionId = String(formData.get("promotionId") || "").trim();
      const newStatus = String(formData.get("status") || "").trim();
      const proofOfParticipation = String(formData.get("proofOfParticipation") || "").trim();

      if (!promotionId || !newStatus) {
        return jsonApiError("INVALID_INPUT", "promotionId e status sao obrigatorios.", { status: 400 });
      }

      const updated = await db
        .update(promotions)
        .set({
          participationStatus: newStatus,
          ...(proofOfParticipation && { proofOfParticipation }),
          updatedAt: new Date(),
        })
        .where(and(eq(promotions.id, promotionId), eq(promotions.userId, user.id)))
        .returning();

      if (updated.length === 0) {
        return jsonApiError("INVALID_INPUT", "Promocao nao encontrada.", { status: 404 });
      }

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
      const promotionId = String(formData.get("promotionId") || "").trim();
      if (!promotionId) {
        return jsonApiError("INVALID_INPUT", "promotionId e obrigatorio.", { status: 400 });
      }

      await db
        .update(promotions)
        .set({ deletedAt: new Date() })
        .where(and(eq(promotions.id, promotionId), eq(promotions.userId, user.id)));

      return Response.json({ success: true });
    }

    return jsonApiError("INVALID_INPUT", "Intent invalido.", { status: 400 });
  } catch {
    return jsonApiError("INTERNAL_ERROR", "Falha ao processar promocoes.", { status: 500 });
  }
}
