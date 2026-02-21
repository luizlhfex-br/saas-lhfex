import { json } from "react-router";
import type { Route } from "./+types/api.company-banks";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { companyProfile, companyBankAccounts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  // GET /api/company-banks - List all bank accounts
  if (request.method === "GET") {
    const banks = await db
      .select()
      .from(companyBankAccounts)
      .where(
        eq(companyBankAccounts.companyId, user.companyId || "")
      );

    return json({ success: true, data: banks });
  }

  return json({ success: false, error: "Method not allowed" }, { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = user.companyId || "";

  if (!companyId) {
    return json(
      { success: false, error: "Company not found" },
      { status: 400 }
    );
  }

  // POST /api/company-banks - Create new bank account
  if (request.method === "POST") {
    const formData = await request.json();
    const { bankName, bankAgency, bankAccount, bankPix, isDefault } = formData;

    if (!bankName || !bankAgency || !bankAccount) {
      return json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // If marking as default, unmark old default
    if (isDefault) {
      await db
        .update(companyBankAccounts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(companyBankAccounts.companyId, companyId),
            eq(companyBankAccounts.isDefault, true)
          )
        );
    }

    const newBank = await db
      .insert(companyBankAccounts)
      .values({
        companyId,
        bankName,
        bankAgency,
        bankAccount,
        bankPix,
        isDefault: isDefault || false,
      })
      .returning();

    return json({ success: true, data: newBank[0] });
  }

  // PATCH /api/company-banks/:id - Update bank account
  if (request.method === "PATCH") {
    const formData = await request.json();
    const { id, bankName, bankAgency, bankAccount, bankPix, isDefault } =
      formData;

    if (!id) {
      return json(
        { success: false, error: "Bank account ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db
      .select()
      .from(companyBankAccounts)
      .where(
        and(
          eq(companyBankAccounts.id, id),
          eq(companyBankAccounts.companyId, companyId)
        )
      );

    if (!existing[0]) {
      return json(
        { success: false, error: "Bank account not found" },
        { status: 404 }
      );
    }

    // If marking as default, unmark old default
    if (isDefault && !existing[0].isDefault) {
      await db
        .update(companyBankAccounts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(companyBankAccounts.companyId, companyId),
            eq(companyBankAccounts.isDefault, true)
          )
        );
    }

    const updated = await db
      .update(companyBankAccounts)
      .set({
        bankName: bankName || existing[0].bankName,
        bankAgency: bankAgency || existing[0].bankAgency,
        bankAccount: bankAccount || existing[0].bankAccount,
        bankPix: bankPix || existing[0].bankPix,
        isDefault: isDefault !== undefined ? isDefault : existing[0].isDefault,
        updatedAt: new Date(),
      })
      .where(eq(companyBankAccounts.id, id))
      .returning();

    return json({ success: true, data: updated[0] });
  }

  // DELETE /api/company-banks/:id - Delete bank account
  if (request.method === "DELETE") {
    const formData = await request.json();
    const { id } = formData;

    if (!id) {
      return json(
        { success: false, error: "Bank account ID required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db
      .select()
      .from(companyBankAccounts)
      .where(
        and(
          eq(companyBankAccounts.id, id),
          eq(companyBankAccounts.companyId, companyId)
        )
      );

    if (!existing[0]) {
      return json(
        { success: false, error: "Bank account not found" },
        { status: 404 }
      );
    }

    await db
      .delete(companyBankAccounts)
      .where(eq(companyBankAccounts.id, id));

    return json({ success: true, message: "Bank account deleted" });
  }

  return json({ success: false, error: "Method not allowed" }, { status: 405 });
}
