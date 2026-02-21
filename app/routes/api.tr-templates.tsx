/**
 * POST /api/tr-templates
 * GET /api/tr-templates?category=TI
 */

import type { Route } from "./+types/api.tr-templates";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { trTemplates } from "drizzle/schema";
import { eq, and, ilike, desc, sql } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("q");

  let query = db
    .select()
    .from(trTemplates)
    .where(and(eq(trTemplates.userId, user.id), eq(trTemplates.isActive, true)))
    .$dynamic();

  if (category) query = query.where(eq(trTemplates.category, category));
  if (search) query = query.where(ilike(trTemplates.name, `%${search}%`));

  const templates = await query.orderBy(desc(trTemplates.createdAt));
  return Response.json({ templates });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const name = formData.get("name");
      const category = formData.get("category");
      const content = formData.get("content");
      const description = formData.get("description");
      const tags = formData.get("tags");

      const newTemplate = await db
        .insert(trTemplates)
        .values({
          userId: user.id,
          name: String(name),
          category: String(category),
          content: String(content),
          description: description ? String(description) : undefined,
          tags: tags ? String(tags) : undefined,
          version: 1,
          isActive: true,
        })
        .returning();

      return Response.json({ success: true, template: newTemplate[0] }, { status: 201 });
    }

    if (intent === "update") {
      const templateId = formData.get("templateId");
      const content = formData.get("content");
      const name = formData.get("name");

      const updated = await db
        .update(trTemplates)
        .set({
          ...(content && { content: String(content), version: (sql`version + 1`) }),
          ...(name && { name: String(name) }),
          updatedAt: new Date(),
        })
        .where(and(eq(trTemplates.id, String(templateId)), eq(trTemplates.userId, user.id)))
        .returning();

      return Response.json({ success: true, template: updated[0] });
    }

    if (intent === "delete") {
      const templateId = formData.get("templateId");

      await db
        .update(trTemplates)
        .set({ isActive: false })
        .where(and(eq(trTemplates.id, String(templateId)), eq(trTemplates.userId, user.id)));

      return Response.json({ success: true });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
