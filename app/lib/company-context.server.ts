import { db } from "~/lib/db.server";
import { userCompanies } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * Returns the primary companyId for a given user.
 * Throws a 400 response if the user has no primary company record.
 */
export async function getPrimaryCompanyId(userId: string): Promise<string> {
  const [uc] = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(and(eq(userCompanies.userId, userId), eq(userCompanies.isPrimary, true)))
    .limit(1);

  if (!uc) {
    throw new Response("No company associated with this user", { status: 400 });
  }

  return uc.companyId;
}
