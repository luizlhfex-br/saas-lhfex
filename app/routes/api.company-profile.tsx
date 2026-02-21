import type { Route } from "./+types/api.company-profile";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { companyProfile } from "../../drizzle/schema";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const profile = await db.select().from(companyProfile).limit(1);
  return Response.json(profile[0] || null);
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);

  if (request.method !== "POST" && request.method !== "PUT") {
    return Response.json({ error: "Método não permitido" }, { status: 405 });
  }

  const formData = await request.formData();
  const values = {
    cnpj: String(formData.get("cnpj") || "").trim() || null,
    razaoSocial: String(formData.get("razaoSocial") || "").trim() || null,
    nomeFantasia: String(formData.get("nomeFantasia") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    city: String(formData.get("city") || "").trim() || null,
    state: String(formData.get("state") || "").trim() || null,
    zipCode: String(formData.get("zipCode") || "").trim() || null,
    country: String(formData.get("country") || "Brasil").trim() || "Brasil",
    phone: String(formData.get("phone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    website: String(formData.get("website") || "").trim() || null,
    ie: String(formData.get("ie") || "").trim() || null,
    im: String(formData.get("im") || "").trim() || null,
    cnae: String(formData.get("cnae") || "").trim() || null,
    cnaeDescription: String(formData.get("cnaeDescription") || "").trim() || null,
    bankName: String(formData.get("bankName") || "").trim() || null,
    bankAgency: String(formData.get("bankAgency") || "").trim() || null,
    bankAccount: String(formData.get("bankAccount") || "").trim() || null,
    bankPix: String(formData.get("bankPix") || "").trim() || null,
    updatedAt: new Date(),
  };

  // Upsert: if record exists update it, otherwise insert
  const existing = await db.select({ id: companyProfile.id }).from(companyProfile).limit(1);

  if (existing.length > 0) {
    await db.update(companyProfile).set(values);
  } else {
    await db.insert(companyProfile).values(values);
  }

  return Response.json({ success: true });
}
