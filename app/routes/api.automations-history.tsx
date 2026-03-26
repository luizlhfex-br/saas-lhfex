import { data } from "react-router";
import type { Route } from "./+types/api.automations-history";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automationVersionHistory, users, automations } from "../../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { buildApiError } from "~/lib/api-error";
import { getPrimaryCompanyId } from "~/lib/company-context.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);

  const url = new URL(request.url);
  const automationId = url.searchParams.get("automationId");

  if (!automationId) {
    return data(buildApiError("INVALID_INPUT", "automationId is required"), { status: 400 });
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
    .innerJoin(automations, eq(automationVersionHistory.automationId, automations.id))
    .leftJoin(users, eq(automationVersionHistory.changedBy, users.id))
    .where(and(eq(automationVersionHistory.automationId, automationId), eq(automations.companyId, companyId)))
    .orderBy(desc(automationVersionHistory.createdAt))
    .limit(100);

  return data({
    history,
    automationId,
  });
}
