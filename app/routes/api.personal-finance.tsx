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
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const month = url.searchParams.get("month"); // "2026-02"
  const type = url.searchParams.get("type"); // "income" | "expense" | "all"
  const status = url.searchParams.get("status"); // "planned" | "settled" | "cancelled" | "all"

  const filters = [eq(personalFinance.userId, user.id), isNull(personalFinance.deletedAt)];

  if (month) {
    const [year, monthNum] = month.split("-");
    const startDate = `${year}-${monthNum}-01`;
    const endDate = `${year}-${monthNum}-31`;
    filters.push(gte(personalFinance.date, startDate), lte(personalFinance.date, endDate));
  }

  if (type && type !== "all") {
    filters.push(eq(personalFinance.type, type));
  }

  if (status && status !== "all") {
    filters.push(eq(personalFinance.status, status));
  }

  const records = await db
    .select()
    .from(personalFinance)
    .where(and(...filters))
    .orderBy(desc(personalFinance.date));

  const normalizedRecords = records.map((record) => ({
    ...record,
    amountNumber: Number.parseFloat(String(record.amount)),
  }));

  const totalIncome = normalizedRecords
    .filter((r) => r.type === "income" && r.status === "settled")
    .reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);

  const totalExpense = normalizedRecords
    .filter((r) => r.type === "expense" && r.status === "settled")
    .reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);

  return Response.json({
    records: normalizedRecords,
    summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
  });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
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
      const status = String(formData.get("status") || "planned");
      const notes = String(formData.get("notes") || "").trim();
      const isFixed = String(formData.get("isFixed") || "false") === "true";

      const record = await db
        .insert(personalFinance)
        .values({
          userId: user.id,
          date: String(date),
          type: String(type),
          category: String(category),
          description: String(description),
          amount: String(amount),
          paymentMethod: paymentMethod ? String(paymentMethod) : undefined,
          status,
          isFixed,
          settledAt: status === "settled" ? String(date) : null,
          notes: notes || null,
          updatedAt: new Date(),
        })
        .returning();

      return Response.json({ success: true, record: record[0] }, { status: 201 });
    }

    if (intent === "update") {
      const id = formData.get("id");
      const amount = formData.get("amount");
      const category = formData.get("category");
      const description = formData.get("description");
      const paymentMethod = formData.get("paymentMethod");
      const status = formData.get("status");
      const settledAt = formData.get("settledAt");

      const updated = await db
        .update(personalFinance)
        .set({
          ...(amount && { amount: String(amount) }),
          ...(category && { category: String(category) }),
          ...(description && { description: String(description) }),
          ...(paymentMethod && { paymentMethod: String(paymentMethod) }),
          ...(status && { status: String(status) }),
          ...(settledAt && { settledAt: String(settledAt) }),
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

  return Response.json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
