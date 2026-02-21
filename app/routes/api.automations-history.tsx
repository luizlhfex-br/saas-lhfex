import { data } from "react-router";
import type { Route } from "./+types/api.automations-history";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automationVersionHistory, users } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const url = new URL(request.url);
  const automationId = url.searchParams.get("automationId");

  if (!automationId) {
    return data({ error: "automationId is required" }, { status: 400 });
  }

  const history = await db
    .select({
      id: automationVersionHistory.id,
      automationId: automationVersionHistory.automationId,
      version: automationVersionHistory.version,
      changes: automationVersionHistory.changes,
      changedByName: users.name,
      changedByEmail: users.email,
      createdAt: automationVersionHistory.createdAt,
    })
    .from(automationVersionHistory)
    .leftJoin(users, eq(automationVersionHistory.changedBy, users.id))
    .where(eq(automationVersionHistory.automationId, automationId))
    .orderBy(desc(automationVersionHistory.createdAt))
    .limit(100);

  return data({
    history,
    automationId,
  });
}
