import { Form, Link, redirect, useActionData, useLoaderData, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/financial-cashflow-new";
import { requireAuth } from "~/lib/auth.server";
import { cashMovementSchema } from "~/lib/validators";
import { getUserLocale } from "~/lib/i18n.server";
import { t } from "~/i18n";
import { db } from "~/lib/db.server";
import { cashMovements, financialCategories } from "../../drizzle/schema";
import { parseBrazilianCurrency } from "~/lib/cashflow.server";
import { data } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { and, eq } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const locale = await getUserLocale(request, user);

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Read ?type= param to pre-select income/expense
  const url = new URL(request.url);
  const preType = url.searchParams.get("type") || "income";

  const categories = await db
    .select({ id: financialCategories.id, type: financialCategories.type, name: financialCategories.name, parentId: financialCategories.parentId })
    .from(financialCategories)
    .where(eq(financialCategories.createdBy, user.id));

  return { locale, today, categories, preType };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  const formData = await request.formData();
  const raw = {
    date: String(formData.get("date") || ""),
    type: String(formData.get("type") || ""),
    category: String(formData.get("category") || ""),
    subcategory: String(formData.get("subcategory") || ""),
    description: String(formData.get("description") || ""),
    amount: String(formData.get("amount") || ""),
    hasInvoice: String(formData.get("hasInvoice") || "N"),
    settlementDate: String(formData.get("settlementDate") || ""),
    paymentMethod: String(formData.get("paymentMethod") || ""),
    costCenter: String(formData.get("costCenter") || ""),
  };

  // Normalize empty strings to undefined
  const normalized = {
    ...raw,
    subcategory: raw.subcategory.trim() || undefined,
    description: raw.description.trim() || undefined,
    settlementDate: raw.settlementDate.trim() || undefined,
    paymentMethod: raw.paymentMethod.trim() || undefined,
    costCenter: raw.costCenter.trim() || undefined,
  };

  const result = cashMovementSchema.safeParse(normalized);

  if (!result.success) {
    return data(
      {
        errors: result.error.flatten().fieldErrors,
        fields: raw,
      },
      { status: 400 }
    );
  }

  const { date, type, category, subcategory, description, amount, hasInvoice, settlementDate, paymentMethod, costCenter } = result.data;

  // Parse amount (Brazilian format: 1.234,56 → 1234.56)
  let parsedAmount: number;
  try {
    parsedAmount = parseBrazilianCurrency(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Invalid amount");
    }
  } catch (error) {
    return data(
      {
        errors: { amount: ["Valor inválido. Use formato: 1234,56"] },
        fields: raw,
      },
      { status: 400 }
    );
  }

  // Insert into DB
  await db.insert(cashMovements).values({
    date,
    type,
    category,
    subcategory: subcategory || null,
    description: description || null,
    amount: String(parsedAmount.toFixed(2)),
    hasInvoice: hasInvoice || "N",
    settlementDate: settlementDate || null,
    paymentMethod: paymentMethod || null,
    costCenter: costCenter || null,
    createdBy: user.id,
  });

  // Redirect to cashflow page with correct month
  const movementDate = new Date(date);
  const year = movementDate.getFullYear();
  const month = movementDate.getMonth() + 1;

  throw redirect(`/financial/cashflow?year=${year}&month=${month}`);
}

export default function FinancialCashflowNewPage({ loaderData }: Route.ComponentProps) {
  const { locale, today, categories, preType } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);

  const actionPayload = (actionData ?? {}) as {
    errors?: Record<string, string[]>;
    fields?: Record<string, string>;
  };

  const errors: Record<string, string[]> = actionPayload.errors || {};
  const fields: Record<string, string> = actionPayload.fields || {};

  // Pre-select type from URL param or action errors
  const selectedType = fields.type || preType || "income";
  const categoryOptions = categories.filter((c) => c.type === selectedType && !c.parentId);
  const subcategoryOptions = categories.filter((c) => c.type === selectedType && !!c.parentId);

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
          Novo Lançamento de Caixa
        </h1>
      </div>

      {/* Form */}
      <Form method="post" className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                required
                defaultValue={fields.date || today}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date[0]}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                required
                defaultValue={fields.type || preType || "income"}
                onChange={(e) => {
                  const form = e.currentTarget.form;
                  if (form) {
                    const categoryEl = form.elements.namedItem("category") as HTMLSelectElement | null;
                    const subcategoryEl = form.elements.namedItem("subcategory") as HTMLSelectElement | null;
                    if (categoryEl) categoryEl.value = "";
                    if (subcategoryEl) subcategoryEl.value = "";
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
              {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type[0]}</p>}
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Categoria <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                required
                defaultValue={fields.category}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Selecione uma categoria</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category[0]}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Subcategoria
              </label>
              <select
                name="subcategory"
                defaultValue={fields.subcategory}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Sem subcategoria</option>
                {subcategoryOptions.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="amount"
                required
                placeholder="1.234,56"
                defaultValue={fields.amount}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount[0]}</p>}
              <p className="mt-1 text-xs text-gray-500">Use vírgula para decimais: 1.234,56</p>
            </div>

            {/* Payment Method */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nota fiscal
              </label>
              <select
                name="hasInvoice"
                defaultValue={fields.hasInvoice || "N"}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="S">Sim</option>
                <option value="N">Não</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data pagamento/recebimento
              </label>
              <input
                type="date"
                name="settlementDate"
                defaultValue={fields.settlementDate || fields.date || today}
                min="2025-01-01"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Forma de Pagamento
              </label>
              <input
                type="text"
                name="paymentMethod"
                placeholder="Ex: PIX, Cartão, Boleto..."
                defaultValue={fields.paymentMethod}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {errors.paymentMethod && <p className="mt-1 text-sm text-red-600">{errors.paymentMethod[0]}</p>}
            </div>

            {/* Cost Center */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Centro de Custo
              </label>
              <input
                type="text"
                name="costCenter"
                placeholder="Ex: Administrativo, Comercial..."
                defaultValue={fields.costCenter}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {errors.costCenter && <p className="mt-1 text-sm text-red-600">{errors.costCenter[0]}</p>}
            </div>
          </div>

          {/* Description */}
          <div className="mt-6">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descrição
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Observações adicionais..."
              defaultValue={fields.description}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description[0]}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to="/financial/cashflow">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar Lançamento"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
