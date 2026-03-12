import { db } from "~/lib/db.server";
import { companyProfile } from "drizzle/schema";

export async function getOrCreatePrimaryCompanyProfile() {
  const [existing] = await db.select().from(companyProfile).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(companyProfile)
    .values({
      nomeFantasia: "LHFEX",
      razaoSocial: "LHFEX",
      country: "Brasil",
      updatedAt: new Date(),
    })
    .returning();

  if (!created) throw new Error("Failed to create company profile");
  return created;
}
