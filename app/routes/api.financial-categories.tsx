import { data } from "react-router";
import type { Route } from "./+types/api.financial-categories";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { financialCategories, cashMovements } from "drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { financialCategorySchema } from "~/lib/validators";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  const query = db
    .select()
    .from(financialCategories)
    .where(and(eq(financialCategories.createdBy, user.id), type ? eq(financialCategories.type, type) : undefined));

  const categories = await query;

  return Response.json({ categories });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "create");

  if (intent === "create") {
    const raw = {
      type: String(formData.get("type") || ""),
      name: String(formData.get("name") || ""),
      parentId: String(formData.get("parentId") || ""),
    };

    const parsed = financialCategorySchema.safeParse(raw);
    if (!parsed.success) {
      return data({ errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const category = await db
      .insert(financialCategories)
      .values({
        type: parsed.data.type,
        name: parsed.data.name,
        parentId: parsed.data.parentId || null,
        createdBy: user.id,
      })
      .returning();

    return Response.json({ success: true, category: category[0] }, { status: 201 });
  }

  if (intent === "rename") {
    const categoryId = String(formData.get("categoryId") || "");
    const name = String(formData.get("name") || "").trim();

    if (!categoryId || name.length < 2) {
      return data({ error: "Dados inválidos" }, { status: 400 });
    }

    const updated = await db
      .update(financialCategories)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(financialCategories.id, categoryId), eq(financialCategories.createdBy, user.id)))
      .returning();

    return Response.json({ success: true, category: updated[0] });
  }

  if (intent === "delete") {
    const categoryId = String(formData.get("categoryId") || "");

    if (!categoryId) {
      return data({ error: "Categoria inválida" }, { status: 400 });
    }

    const [category] = await db
      .select()
      .from(financialCategories)
      .where(and(eq(financialCategories.id, categoryId), eq(financialCategories.createdBy, user.id)))
      .limit(1);

    if (!category) {
      return data({ error: "Categoria não encontrada" }, { status: 404 });
    }

    const usage = await db
      .select({ id: cashMovements.id })
      .from(cashMovements)
      .where(eq(cashMovements.category, category.name))
      .limit(1);

    if (usage.length > 0) {
      return data({ error: "Categoria em uso. Renomeie ou migre os lançamentos antes de excluir." }, { status: 409 });
    }

    await db
      .delete(financialCategories)
      .where(and(eq(financialCategories.id, categoryId), eq(financialCategories.createdBy, user.id)));

    return Response.json({ success: true });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}
