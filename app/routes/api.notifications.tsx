import { data } from "react-router";
import type { Route } from "./+types/api.notifications";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { notifications } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// GET — fetch notifications for current user
export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

  const conditions = [eq(notifications.userId, user.id)];
  if (unreadOnly) conditions.push(eq(notifications.read, false));

  const items = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  const [unreadCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));

  return data(
    { notifications: items, unreadCount: unreadCount?.count ?? 0 },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}

// POST — mark as read / mark all as read
export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "mark_read") {
    const id = formData.get("id") as string;
    if (id) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
    }
    return data({ ok: true });
  }

  if (intent === "mark_all_read") {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
    return data({ ok: true });
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}
