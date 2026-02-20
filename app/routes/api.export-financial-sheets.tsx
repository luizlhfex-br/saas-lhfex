import { redirect } from "react-router";
import type { Route } from "./+types/api.export-financial-sheets";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients } from "~/drizzle/schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { getValidGoogleToken, createGoogleSheet, getAuthenticatedSheetsClient } from "~/lib/google.server";
import { toast } from "sonner";
import { data } from "react-router";

/**
 * POST /api/export-financial-sheets
 * Gera relatório financeiro em Google Sheets
 */
export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. Check if user has Google connected
    const googleToken = await getValidGoogleToken(user.id);
    if (!googleToken) {
      return data({ error: "Google não conectado. Conecte na página de Configurações." }, { status: 400 });
    }

    // 2. Fetch financial data
    const invoiceData = await db
      .select({
        number: invoices.number,
        clientName: clients.razaoSocial,
        type: invoices.type,
        status: invoices.status,
        currency: invoices.currency,
        total: invoices.total,
        dueDate: invoices.dueDate,
        paidDate: invoices.paidDate,
        description: invoices.description,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(isNull(invoices.deletedAt))
      .orderBy(desc(invoices.createdAt))
      .limit(1000);

    if (invoiceData.length === 0) {
      return data({ error: "Nenhuma fatura para exportar" }, { status: 400 });
    }

    // 3. Create Google Sheet
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    const sheetTitle = `Relatório Financeiro - ${dateStr}`;
    
    const sheet = await createGoogleSheet(user.id, sheetTitle, process.env.GOOGLE_DRIVE_FOLDER_ID || "");
    
    if (!sheet) {
      return data({ error: "Erro ao criar Google Sheet" }, { status: 500 });
    }

    // 4. Populate sheet with data
    const sheetClient = await getAuthenticatedSheetsClient(user.id);
    if (!sheetClient) {
      return data({ error: "Erro ao conectar ao Google Sheets" }, { status: 500 });
    }

    // Prepare rows for Sheet (header + data)
    const rows: (string | number)[][] = [
      [
        "Número",
        "Cliente",
        "Tipo",
        "Status",
        "Moeda",
        "Total",
        "Vencimento",
        "Data Pagamento",
        "Descrição",
      ],
      ...invoiceData.map((inv) => [
        inv.number || "",
        inv.clientName || "",
        inv.type === "receivable" ? "A Receber" : "A Pagar",
        inv.status === "paid" ? "Pago" : inv.status === "overdue" ? "Atrasado" : inv.status === "draft" ? "Rascunho" : inv.status === "sent" ? "Enviado" : "Cancelado",
        inv.currency || "BRL",
        Number(inv.total) || 0,
        inv.dueDate || "",
        inv.paidDate || "",
        inv.description || "",
      ]),
    ];

    // Write to sheet
    await sheetClient.spreadsheets.values.update({
      spreadsheetId: sheet.spreadsheetId,
      range: "Sheet1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });

    console.log(`✅ Financial report exported to Sheet: ${sheet.shareLink}`);

    return data({
      success: true,
      sheetUrl: sheet.shareLink,
      message: `Relatório criado com sucesso: ${sheetTitle}`,
    });
  } catch (error) {
    console.error("❌ Error exporting financial report:", error);
    return data(
      { error: error instanceof Error ? error.message : "Erro ao gerar relatório" },
      { status: 500 }
    );
  }
}
