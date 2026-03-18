import { and, eq } from "drizzle-orm";
import type { Route } from "./+types/api.company-profile";
import { requireAuth } from "~/lib/auth.server";
import { enrichCNPJ } from "~/lib/ai.server";
import { getOrCreatePrimaryCompanyProfile } from "~/lib/company-profile.server";
import { db } from "~/lib/db.server";
import { companyBankAccounts, companyProfile } from "../../drizzle/schema";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const profile = await db.select().from(companyProfile).limit(1);
  return Response.json(profile[0] || null);
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);

  if (request.method !== "POST" && request.method !== "PUT") {
    return Response.json({ error: "Metodo nao permitido" }, { status: 405 });
  }

  const formData = await request.formData();
  const profile = await getOrCreatePrimaryCompanyProfile();
  const cnpj = String(formData.get("cnpj") || "").trim() || null;
  const enriched = cnpj ? await enrichCNPJ(cnpj) : null;

  const values = {
    cnpj,
    razaoSocial: String(formData.get("razaoSocial") || "").trim() || enriched?.razaoSocial || null,
    nomeFantasia: String(formData.get("nomeFantasia") || "").trim() || enriched?.nomeFantasia || null,
    address: String(formData.get("address") || "").trim() || enriched?.address || null,
    city: String(formData.get("city") || "").trim() || enriched?.city || null,
    state: String(formData.get("state") || "").trim() || enriched?.state || null,
    zipCode: String(formData.get("zipCode") || "").trim() || enriched?.zipCode || null,
    country: String(formData.get("country") || "Brasil").trim() || "Brasil",
    contactName: String(formData.get("contactName") || "").trim() || null,
    contactRole: String(formData.get("contactRole") || "").trim() || null,
    contactRegistration: String(formData.get("contactRegistration") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    website: String(formData.get("website") || "").trim() || null,
    ie: String(formData.get("ie") || "").trim() || null,
    im: String(formData.get("im") || "").trim() || null,
    cnae: String(formData.get("cnae") || "").trim() || enriched?.cnaeCode || null,
    cnaeDescription: String(formData.get("cnaeDescription") || "").trim() || enriched?.cnaeDescription || null,
    bankName: String(formData.get("bankName") || "").trim() || null,
    bankHolder: String(formData.get("bankHolder") || "").trim() || null,
    bankAgency: String(formData.get("bankAgency") || "").trim() || null,
    bankAccount: String(formData.get("bankAccount") || "").trim() || null,
    bankPix: String(formData.get("bankPix") || "").trim() || null,
    updatedAt: new Date(),
  };

  await db.update(companyProfile).set(values).where(eq(companyProfile.id, profile.id));

  if (values.bankName && values.bankAgency && values.bankAccount) {
    const [defaultBank] = await db
      .select()
      .from(companyBankAccounts)
      .where(and(eq(companyBankAccounts.companyId, profile.id), eq(companyBankAccounts.isDefault, true)))
      .limit(1);

    const defaultBankValues = {
      companyId: profile.id,
      bankName: values.bankName,
      accountHolder: values.bankHolder,
      bankAgency: values.bankAgency,
      bankAccount: values.bankAccount,
      bankPix: values.bankPix,
      isDefault: true,
      updatedAt: new Date(),
    };

    if (defaultBank) {
      await db.update(companyBankAccounts).set(defaultBankValues).where(eq(companyBankAccounts.id, defaultBank.id));
    } else {
      await db.insert(companyBankAccounts).values(defaultBankValues);
    }
  }

  return Response.json({ success: true });
}
