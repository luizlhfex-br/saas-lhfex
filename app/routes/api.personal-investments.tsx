/**
 * POST /api/personal-investments
 * GET /api/personal-investments?assetType=stock
 */

import type { Route } from "./+types/api.personal-investments";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { personalInvestments } from "drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const assetType = url.searchParams.get("assetType");

  let query = db
    .select()
    .from(personalInvestments)
    .where(and(eq(personalInvestments.userId, user.id), isNull(personalInvestments.deletedAt)))
    .$dynamic();

  if (assetType) {
    query = query.where(eq(personalInvestments.assetType, assetType));
  }

  const investments = await query.orderBy(desc(personalInvestments.purchaseDate));

  // Calculate portfolio summary
  const totalInvested = investments.reduce(
    (sum, inv) => sum + parseFloat(String(inv.purchasePrice)) * parseFloat(String(inv.quantity)),
    0
  );
  const totalValue = investments.reduce(
    (sum, inv) => sum + parseFloat(String(inv.currentValue || 0)),
    0
  );
  const totalGainLoss = investments.reduce((sum, inv) => sum + parseFloat(String(inv.gainLoss || 0)), 0);

  return Response.json({
    investments,
    portfolio: { totalInvested, totalValue, totalGainLoss, gainLossPercent: totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0 },
  });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const assetType = formData.get("assetType");
      const assetName = formData.get("assetName");
      const ticker = formData.get("ticker");
      const quantity = formData.get("quantity");
      const purchasePrice = formData.get("purchasePrice");
      const purchaseDate = formData.get("purchaseDate");
      const currentPrice = formData.get("currentPrice");
      const broker = formData.get("broker");

      const investment = await db
        .insert(personalInvestments)
        .values({
          userId: user.id,
          assetType: String(assetType),
          assetName: String(assetName),
          ticker: ticker ? String(ticker) : undefined,
          quantity: String(quantity),
          purchasePrice: String(purchasePrice),
          purchaseDate: String(purchaseDate),
          currentPrice: currentPrice ? String(currentPrice) : String(purchasePrice),
          currentValue:
            currentPrice
              ? String(parseFloat(String(quantity)) * parseFloat(String(currentPrice)))
              : String(parseFloat(String(quantity)) * parseFloat(String(purchasePrice))),
          broker: broker ? String(broker) : undefined,
        })
        .returning();

      return Response.json({ success: true, investment: investment[0] }, { status: 201 });
    }

    if (intent === "update-price") {
      const id = formData.get("id");
      const currentPrice = formData.get("currentPrice");

      const inv = await db
        .select({ quantity: personalInvestments.quantity, purchasePrice: personalInvestments.purchasePrice })
        .from(personalInvestments)
        .where(eq(personalInvestments.id, String(id)))
        .limit(1);

      if (!inv.length) return Response.json({ error: "Investment not found" }, { status: 404 });

      const currentValue = parseFloat(String(inv[0].quantity)) * parseFloat(String(currentPrice));
      const investedAmount = parseFloat(String(inv[0].quantity)) * parseFloat(String(inv[0].purchasePrice));
      const gainLoss = currentValue - investedAmount;
      const gainLossPercent = (gainLoss / investedAmount) * 100;

      const updated = await db
        .update(personalInvestments)
        .set({
          currentPrice: String(currentPrice),
          currentValue: String(currentValue),
          gainLoss: String(gainLoss),
          gainLossPercent: String(gainLossPercent),
          updatedAt: new Date(),
        })
        .where(and(eq(personalInvestments.id, String(id)), eq(personalInvestments.userId, user.id)))
        .returning();

      return Response.json({ success: true, investment: updated[0] });
    }
  }

  return Response.json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
