/**
 * POST /api/personal-routines
 * GET /api/personal-routines?type=exercise
 * POST /api/personal-routines (tracking)
 */

import type { Route } from "./+types/api.personal-routines";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { personalRoutines, routineTracking } from "drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const includeTracking = url.searchParams.get("tracking") === "true";

  let query = db
    .select()
    .from(personalRoutines)
    .where(and(eq(personalRoutines.userId, user.id), eq(personalRoutines.isActive, true)))
    .$dynamic();

  if (type) {
    query = query.where(eq(personalRoutines.routineType, type));
  }

  const routines = await query.orderBy(desc(personalRoutines.createdAt));

  // Fetch tracking data if requested
  let tracking: any[] = [];
  if (includeTracking) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    tracking = await db
      .select()
      .from(routineTracking)
      .where(
        and(
          eq(routineTracking.userId, user.id),
          // Add date range if needed
        )
      )
      .orderBy(desc(routineTracking.date));
  }

  return Response.json({ routines, tracking });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create-routine") {
      const routineType = formData.get("routineType");
      const name = formData.get("name");
      const frequency = formData.get("frequency");
      const targetValue = formData.get("targetValue");
      const unit = formData.get("unit");
      const description = formData.get("description");

      const routine = await db
        .insert(personalRoutines)
        .values({
          userId: user.id,
          routineType: String(routineType),
          name: String(name),
          frequency: String(frequency),
          targetValue: targetValue ? String(targetValue) : undefined,
          unit: unit ? String(unit) : undefined,
          description: description ? String(description) : undefined,
          isActive: true,
          startDate: new Date(),
        })
        .returning();

      return Response.json({ success: true, routine: routine[0] }, { status: 201 });
    }

    if (intent === "log-tracking") {
      const routineId = formData.get("routineId");
      const date = formData.get("date");
      const completed = formData.get("completed") === "true";
      const value = formData.get("value");

      const track = await db
        .insert(routineTracking)
        .values({
          routineId: String(routineId),
          userId: user.id,
          date: new Date(String(date)),
          completed,
          value: value ? String(value) : undefined,
        })
        .returning();

      return Response.json({ success: true, tracking: track[0] }, { status: 201 });
    }

    if (intent === "deactivate") {
      const routineId = formData.get("routineId");

      await db
        .update(personalRoutines)
        .set({ isActive: false })
        .where(and(eq(personalRoutines.id, String(routineId)), eq(personalRoutines.userId, user.id)));

      return Response.json({ success: true });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
