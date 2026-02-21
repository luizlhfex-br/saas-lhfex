/**
 * POST /api/personal-finance
 * GET /api/personal-finance?month=2026-02&type=all
 */

import type { Route } from "./+types/api.personal-finance";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { personalFinance } from "drizzle/schema";
import { eq, and, gte, lte, desc, isNull } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const month = url.searchParams.get("month"); // "2026-02"
  const type = url.searchParams.get("type"); // "income" | "expense" | "all"

  let query = db
    .select()
    .from(personalFinance)
    .where(and(eq(personalFinance.userId, user.id), isNull(personalFinance.deletedAt)))
    .$dynamic();

  if (month) {
    const [year, monthNum] = month.split("-");
    const startDate = new Date(`${year}-${monthNum}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    query = query.where(
      and(
        gte(personalFinance.date, startDate),
        lte(personalFinance.date, endDate)
      )
    );
  }

  if (type && type !== "all") {
    query = query.where(eq(personalFinance.type, type));
  }

  const records = await query.orderBy(desc(personalFinance.date));

  // Calculate totals
  const totalIncome = records
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);

  const totalExpense = records
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);

  return Response.json({
    records,
    summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
  });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const date = formData.get("date");
      const type = formData.get("type");
      const category = formData.get("category");
      const description = formData.get("description");
      const amount = formData.get("amount");
      const paymentMethod = formData.get("paymentMethod");

      const record = await db
        .insert(personalFinance)
        .values({
          userId: user.id,
          date: new Date(String(date)),
          type: String(type),
          category: String(category),
          description: String(description),
          amount: String(amount),
          paymentMethod: paymentMethod ? String(paymentMethod) : undefined,
        })
        .returning();

      return Response.json({ success: true, record: record[0] }, { status: 201 });
    }

    if (intent === "update") {
      const id = formData.get("id");
      const amount = formData.get("amount");
      const category = formData.get("category");

      const updated = await db
        .update(personalFinance)
        .set({
          ...(amount && { amount: String(amount) }),
          ...(category && { category: String(category) }),
          updatedAt: new Date(),
        })
        .where(and(eq(personalFinance.id, String(id)), eq(personalFinance.userId, user.id)))
        .returning();

      return Response.json({ success: true, record: updated[0] });
    }

    if (intent === "delete") {
      const id = formData.get("id");
      await db
        .update(personalFinance)
        .set({ deletedAt: new Date() })
        .where(and(eq(personalFinance.id, String(id)), eq(personalFinance.userId, user.id)));

      return Response.json({ success: true });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
