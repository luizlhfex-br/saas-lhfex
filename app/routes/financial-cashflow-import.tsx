import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/financial-cashflow-import";
import { requireAuth } from "~/lib/auth.server";
import { getUserLocale } from "~/lib/i18n.server";
import { t } from "~/i18n";
import { db } from "~/lib/db.server";
import { cashMovements } from "~/drizzle/schema";
import { parseBrazilianCurrency } from "~/lib/cashflow.server";
import { data } from "react-router";
import { ChevronLeft, Upload, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const locale = await getUserLocale(request, user);
  return { locale };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return data({ errors: ["Nenhum arquivo foi enviado"] }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return data({ errors: ["Arquivo vazio ou sem dados"] }, { status: 400 });
  }

  // Detect separator (semicolon or comma)
  const separator = lines[0].includes(";") ? ";" : ",";

  const headers = lines[0]
    .split(separator)
    .map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));

  // Map column indices (case-insensitive, flexible names)
  const colIndex = {
    date: headers.findIndex((h) => ["data", "date"].includes(h)),
    type: headers.findIndex((h) => ["tipo", "type"].includes(h)),
    category: headers.findIndex((h) => ["categoria", "category"].includes(h)),
    description: headers.findIndex((h) => ["descricao", "descrição", "description"].includes(h)),
    amount: headers.findIndex((h) => ["valor", "amount"].includes(h)),
    paymentMethod: headers.findIndex((h) => ["forma_pagamento", "formapagamento", "paymentmethod", "payment_method"].includes(h)),
    costCenter: headers.findIndex((h) => ["centro_custo", "centrocusto", "costcenter", "cost_center"].includes(h)),
  };

  // Validate required columns
  if (colIndex.date === -1 || colIndex.type === -1 || colIndex.category === -1 || colIndex.amount === -1) {
    return data(
      {
        errors: [
          "Colunas obrigatórias não encontradas. Certifique-se de ter: data, tipo, categoria, valor",
          `Colunas detectadas: ${headers.join(", ")}`,
        ],
      },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  const validMovements: Array<{
    date: string;
    type: string;
    category: string;
    description: string | null;
    amount: string;
    paymentMethod: string | null;
    costCenter: string | null;
    createdBy: string;
  }> = [];

  // Process data lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(separator).map((c) => c.trim());

    const date = cols[colIndex.date] || "";
    const typeRaw = cols[colIndex.type]?.toLowerCase() || "";
    const category = cols[colIndex.category] || "";
    const description = colIndex.description !== -1 ? (cols[colIndex.description] || null) : null;
    const amountRaw = cols[colIndex.amount] || "";
    const paymentMethod = colIndex.paymentMethod !== -1 ? (cols[colIndex.paymentMethod] || null) : null;
    const costCenter = colIndex.costCenter !== -1 ? (cols[colIndex.costCenter] || null) : null;

    // Validate required fields
    if (!date || !typeRaw || !category || !amountRaw) {
      errors.push(`Linha ${i + 1}: Campos obrigatórios faltando (data, tipo, categoria, valor)`);
      if (errors.length >= 5) break; // Limit error messages
      continue;
    }

    // Parse type (flexible: receita/income/r → income, despesa/expense/d → expense)
    let type: "income" | "expense";
    if (["receita", "income", "r", "entrada"].includes(typeRaw)) {
      type = "income";
    } else if (["despesa", "expense", "d", "saida", "saída"].includes(typeRaw)) {
      type = "expense";
    } else {
      errors.push(`Linha ${i + 1}: Tipo inválido "${typeRaw}". Use "Receita" ou "Despesa"`);
      if (errors.length >= 5) break;
      continue;
    }

    // Parse amount
    let amount: number;
    try {
      amount = parseBrazilianCurrency(amountRaw);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
    } catch (error) {
      errors.push(`Linha ${i + 1}: Valor inválido "${amountRaw}". Use formato: 1234,56`);
      if (errors.length >= 5) break;
      continue;
    }

    // Validate date format (YYYY-MM-DD or DD/MM/YYYY)
    let normalizedDate: string = date;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      // Convert DD/MM/YYYY → YYYY-MM-DD
      const [day, month, year] = date.split("/");
      normalizedDate = `${year}-${month}-${day}`;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      errors.push(`Linha ${i + 1}: Data inválida "${date}". Use formato: YYYY-MM-DD ou DD/MM/YYYY`);
      if (errors.length >= 5) break;
      continue;
    }

    validMovements.push({
      date: normalizedDate,
      type,
      category,
      description,
      amount: String(amount.toFixed(2)),
      paymentMethod,
      costCenter,
      createdBy: user.id,
    });
  }

  // If no valid movements, return errors
  if (validMovements.length === 0) {
    return data({ errors: errors.length > 0 ? errors : ["Nenhum lançamento válido encontrado"] }, { status: 400 });
  }

  // Insert valid movements
  await db.insert(cashMovements).values(validMovements);

  // Redirect with success message
  throw redirect(`/financial/cashflow?imported=${validMovements.length}`);
}

export default function FinancialCashflowImportPage({ loaderData }: Route.ComponentProps) {
  const { locale } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);

  const errors = actionData?.errors || [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/financial/cashflow">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Importar Lançamentos (CSV)
        </h1>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Erros na importação</h3>
              <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-400">
                {errors.slice(0, 5).map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
              {errors.length > 5 && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  + {errors.length - 5} erro(s) adicional(is)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <Form method="post" encType="multipart/form-data" className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Arquivo CSV <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              name="file"
              accept=".csv"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">Arquivo CSV com separador ; ou ,</p>
          </div>

          {/* Help */}
          <div className="mt-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Formato esperado</h3>
            <div className="mt-2 space-y-2 text-xs text-blue-800 dark:text-blue-400">
              <p><strong>Cabeçalho:</strong></p>
              <pre className="rounded bg-blue-100 p-2 dark:bg-blue-900/40">
data;tipo;categoria;descricao;valor;forma_pagamento;centro_custo
              </pre>
              <p><strong>Tipos aceitos:</strong></p>
              <ul className="ml-4 list-disc">
                <li><code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">Receita</code>, <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">income</code>, <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">r</code></li>
                <li><code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">Despesa</code>, <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">expense</code>, <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">d</code></li>
              </ul>
              <p><strong>Data:</strong> <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">2026-02-20</code> ou <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">20/02/2026</code></p>
              <p><strong>Valor:</strong> <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">1.234,56</code> ou <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">1234.56</code></p>
              <p className="mt-2"><strong>Exemplo de linha:</strong></p>
              <pre className="rounded bg-blue-100 p-2 dark:bg-blue-900/40">
2026-02-20;Receita;Vendas;Venda produto X;5.000,00;PIX;Comercial
              </pre>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to="/financial/cashflow">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Upload className="mr-2 h-4 w-4" />
            {isSubmitting ? "Importando..." : "Importar CSV"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
