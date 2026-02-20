import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/financial-cashflow-new";
import { requireAuth } from "~/lib/auth.server";
import { cashMovementSchema } from "~/lib/validators";
import { getUserLocale } from "~/lib/i18n.server";
import { t } from "~/i18n";
import { db } from "~/lib/db.server";
import { cashMovements } from "../../drizzle/schema";
import { parseBrazilianCurrency } from "~/lib/cashflow.server";
import { data } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const locale = await getUserLocale(request, user);

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  return { locale, today };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  const formData = await request.formData();
  const raw = {
    date: String(formData.get("date") || ""),
    type: String(formData.get("type") || ""),
    category: String(formData.get("category") || ""),
    description: String(formData.get("description") || ""),
    amount: String(formData.get("amount") || ""),
    paymentMethod: String(formData.get("paymentMethod") || ""),
    costCenter: String(formData.get("costCenter") || ""),
  };

  // Normalize empty strings to undefined
  const normalized = {
    ...raw,
    description: raw.description.trim() || undefined,
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

  const { date, type, category, description, amount, paymentMethod, costCenter } = result.data;

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
    description: description || null,
    amount: String(parsedAmount.toFixed(2)),
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
  const { locale, today } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);

  const errors = actionData?.errors || {};
  const fields = actionData?.fields || {};

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
                defaultValue={fields.type || "income"}
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
              <input
                type="text"
                name="category"
                required
                placeholder="Ex: Vendas, Salários, Marketing..."
                defaultValue={fields.category}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category[0]}</p>}
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
