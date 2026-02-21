/**
 * POST /api/personal-goals
 * GET /api/personal-goals?category=health&status=in_progress
 */

import type { Route } from "./+types/api.personal-goals";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { personalGoals } from "drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");

  let query = db
    .select()
    .from(personalGoals)
    .where(eq(personalGoals.userId, user.id))
    .$dynamic();

  if (category) {
    query = query.where(eq(personalGoals.category, category));
  }

  if (status) {
    query = query.where(eq(personalGoals.status, status));
  }

  const goals = await query.orderBy(desc(personalGoals.deadline));

  // Calculate progress
  const goalsWithProgress = goals.map((g) => ({
    ...g,
    progress:
      g.targetValue && g.currentValue
        ? Math.min(100, (parseFloat(String(g.currentValue)) / parseFloat(String(g.targetValue))) * 100)
        : 0,
  }));

  return Response.json({ goals: goalsWithProgress });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
      const title = formData.get("title");
      const category = formData.get("category");
      const targetValue = formData.get("targetValue");
      const unit = formData.get("unit");
      const deadline = formData.get("deadline");
      const priority = formData.get("priority") ?? "medium";
      const description = formData.get("description");

      const goal = await db
        .insert(personalGoals)
        .values({
          userId: user.id,
          title: String(title),
          category: String(category),
          targetValue: targetValue ? String(targetValue) : undefined,
          currentValue: "0",
          unit: unit ? String(unit) : undefined,
          deadline: deadline ? String(deadline) : undefined,
          priority: String(priority),
          status: "in_progress",
          description: description ? String(description) : undefined,
          startDate: new Date().toISOString().slice(0, 10),
        })
        .returning();

      return Response.json({ success: true, goal: goal[0] }, { status: 201 });
    }

    if (intent === "update-progress") {
      const goalId = formData.get("goalId");
      const currentValue = formData.get("currentValue");

      const updated = await db
        .update(personalGoals)
        .set({
          currentValue: String(currentValue),
          updatedAt: new Date(),
        })
        .where(and(eq(personalGoals.id, String(goalId)), eq(personalGoals.userId, user.id)))
        .returning();

      return Response.json({ success: true, goal: updated[0] });
    }

    if (intent === "complete") {
      const goalId = formData.get("goalId");

      const updated = await db
        .update(personalGoals)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(and(eq(personalGoals.id, String(goalId)), eq(personalGoals.userId, user.id)))
        .returning();

      return Response.json({ success: true, goal: updated[0] });
    }
  }

  return Response.json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
