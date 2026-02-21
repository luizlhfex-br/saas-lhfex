import { redirect } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients } from "../../drizzle/schema";
import { eq, desc, sql, and, isNull, gte, lte, inArray } from "drizzle-orm";
import { getValidGoogleToken, createGoogleSheet, getAuthenticatedSheetsClient } from "~/lib/google.server";
import { toast } from "sonner";
import { data } from "react-router";

/**
 * POST /api/export-financial-sheets
 * Gera relatório financeiro em Google Sheets com filtros opcionais
 * Query params: startDate, endDate, status, type
 */
export async function action({ request }: { request: Request }) {
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

    // 2. Parse filters from form data
    const formData = await request.formData();
    const startDate = formData.get("startDate") as string | null;
    const endDate = formData.get("endDate") as string | null;
    const statusFilter = (formData.get("status") as string | null)?.split(",").filter(Boolean) || [];
    const typeFilter = (formData.get("type") as string | null)?.split(",").filter(Boolean) || ["receivable", "payable"];

    // 3. Build query conditions
    const conditions = [isNull(invoices.deletedAt)];
    
    if (startDate) {
      conditions.push(gte(invoices.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(invoices.createdAt, endOfDay));
    }
    if (statusFilter.length > 0) {
      conditions.push(inArray(invoices.status, statusFilter as any));
    }
    if (typeFilter.length > 0) {
      conditions.push(inArray(invoices.type, typeFilter as any));
    }

    // 4. Fetch filtered financial data
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
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(1000);

    if (invoiceData.length === 0) {
      return data({ error: "Nenhuma fatura encontrada com os filtros aplicados" }, { status: 400 });
    }

    // 5. Create Google Sheet
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    const filterStr = [startDate && `de${startDate.slice(5)}`, endDate && `até${endDate.slice(5)}`, statusFilter.length > 0 && statusFilter.join("-")].filter(Boolean).join("_");
    const sheetTitle = `Relatório Financeiro${filterStr ? " - " + filterStr : ""} - ${dateStr}`;
    
    const sheet = await createGoogleSheet(user.id, sheetTitle, process.env.GOOGLE_DRIVE_FOLDER_ID || "");
    
    if (!sheet) {
      return data({ error: "Erro ao criar Google Sheet" }, { status: 500 });
    }

    // 6. Populate sheet with data
    const sheetClient = await getAuthenticatedSheetsClient(user.id);
    if (!sheetClient) {
      return data({ error: "Erro ao conectar ao Google Sheets" }, { status: 500 });
    }

    // Prepare rows for Sheet (header + data + totals)
    const formattedInvoices = invoiceData.map((inv) => [
      inv.number || "",
      inv.clientName || "",
      inv.type === "receivable" ? "A Receber" : "A Pagar",
      inv.status === "paid" ? "Pago" : inv.status === "overdue" ? "Atrasado" : inv.status === "draft" ? "Rascunho" : inv.status === "sent" ? "Enviado" : "Cancelado",
      inv.currency || "BRL",
      Number(inv.total) || 0,
      inv.dueDate || "",
      inv.paidDate || "",
      inv.description || "",
    ]);

    const totalValue = formattedInvoices.reduce((sum, row) => sum + (typeof row[5] === 'number' ? row[5] : 0), 0);

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
      ...formattedInvoices,
      [
        "",
        "",
        "",
        "TOTAL",
        "",
        `=SUM(F2:F${formattedInvoices.length + 1})`,
        "",
        "",
        "",
      ],
    ];

    // Write to sheet
    await sheetClient.spreadsheets.values.update({
      spreadsheetId: sheet.spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });

    // Format header row (bold + background color)
    await sheetClient.spreadsheets.batchUpdate({
      spreadsheetId: sheet.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              fields: "gridProperties",
              properties: {
                sheetId: 0,
                gridProperties: {
                  frozenRowCount: 1, // Freeze header row
                },
              },
            },
          },
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.2,
                    green: 0.2,
                    blue: 0.2,
                  },
                  textFormat: {
                    bold: true,
                    foregroundColor: {
                      red: 1,
                      green: 1,
                      blue: 1,
                    },
                  },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            },
          },
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: formattedInvoices.length + 1,
                endRowIndex: formattedInvoices.length + 2,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.9,
                    green: 0.9,
                    blue: 0.9,
                  },
                  textFormat: {
                    bold: true,
                  },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [
                  {
                    sheetId: 0,
                    startRowIndex: 1,
                    endRowIndex: formattedInvoices.length + 1,
                    startColumnIndex: 3,
                    endColumnIndex: 4,
                  },
                ],
                booleanRule: {
                  condition: {
                    type: "TEXT_CONTAINS",
                    values: [
                      {
                        userEnteredValue: "Atrasado",
                      },
                    ],
                  },
                  format: {
                    backgroundColor: {
                      red: 1,
                      green: 0.9,
                      blue: 0.9,
                    },
                    textFormat: {
                      foregroundColor: {
                        red: 0.8,
                        green: 0,
                        blue: 0,
                      },
                    },
                  },
                },
              },
            },
          },
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [
                  {
                    sheetId: 0,
                    startRowIndex: 1,
                    endRowIndex: formattedInvoices.length + 1,
                    startColumnIndex: 3,
                    endColumnIndex: 4,
                  },
                ],
                booleanRule: {
                  condition: {
                    type: "TEXT_CONTAINS",
                    values: [
                      {
                        userEnteredValue: "Pago",
                      },
                    ],
                  },
                  format: {
                    backgroundColor: {
                      red: 0.9,
                      green: 1,
                      blue: 0.9,
                    },
                    textFormat: {
                      foregroundColor: {
                        red: 0,
                        green: 0.6,
                        blue: 0,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
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
