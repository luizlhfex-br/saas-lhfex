import { Fragment, useState } from "react";
import { data, Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/subscriptions";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { db } from "~/lib/db.server";
import { subscriptions } from "drizzle/schema";
import { and, eq, isNull, asc, desc } from "drizzle-orm";
import { getSubscriptionHealth, resolveSubscriptionNextDueDate, summarizeSubscriptionTotals } from "~/lib/subscriptions.server";
import { Button } from "~/components/ui/button";
import { Ban, Calendar, DollarSign, ExternalLink, LayoutDashboard, Pencil, Plus, RefreshCw, TrendingUp } from "lucide-react";
import { getCSRFFormState, requireValidCSRF } from "~/lib/csrf.server";

const recurrenceOptions = [
  { value: "monthly", label: "Mensal" },
  { value: "annual", label: "Anual" },
  { value: "biennial", label: "Bienal" },
  { value: "triennial", label: "Trienal" },
  { value: "one-time", label: "Pontual" },
  { value: "credit", label: "Credito" },
  { value: "other", label: "Outro" },
] as const;

const categoryOptions = [
  { value: "hosting", label: "Hosting" },
  { value: "domain", label: "Dominio" },
  { value: "office", label: "Escritorio" },
  { value: "cloud", label: "Cloud" },
  { value: "api", label: "API" },
  { value: "software", label: "Software" },
  { value: "other", label: "Outro" },
] as const;

const statusOptions = [
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "cancelled", label: "Cancelado" },
] as const;

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

function formatDate(date: string | null) {
  if (!date) return "Sem data";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function parseNullableString(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function parseNullableNumber(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  return normalized ? Number(normalized) : null;
}

function SubscriptionFields({ subscription }: { subscription?: typeof subscriptions.$inferSelect }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="text"
          name="name"
          defaultValue={subscription?.name ?? ""}
          placeholder="Nome do servico"
          required
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <input
          type="url"
          name="url"
          defaultValue={subscription?.url ?? ""}
          placeholder="https://..."
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select
          name="category"
          defaultValue={subscription?.category ?? "other"}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          min="0"
          name="valueAmount"
          defaultValue={subscription?.valueAmount ?? ""}
          placeholder="Valor"
          required
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <select
          name="valueCurrency"
          defaultValue={subscription?.valueCurrency ?? "BRL"}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="BRL">BRL</option>
          <option value="USD">USD</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select
          name="recurrence"
          defaultValue={subscription?.recurrence ?? "monthly"}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {recurrenceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          max="31"
          name="dueDay"
          defaultValue={subscription?.dueDay ?? ""}
          placeholder="Dia do vencimento (1-31)"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <input
          type="date"
          name="dueDate"
          defaultValue={subscription?.dueDate ?? ""}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input
          type="text"
          name="paymentMethod"
          defaultValue={subscription?.paymentMethod ?? ""}
          placeholder="Metodo de pagamento"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <input
          type="text"
          name="loginHint"
          defaultValue={subscription?.loginHint ?? ""}
          placeholder="Dica de login"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <input
          type="number"
          min="0"
          max="60"
          name="alertDaysBefore"
          defaultValue={subscription?.alertDaysBefore ?? 7}
          placeholder="Dias para alertar"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      {subscription ? (
        <select
          name="status"
          defaultValue={subscription.status}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      <textarea
        name="notes"
        defaultValue={subscription?.notes ?? ""}
        placeholder="Observacoes"
        rows={3}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />
    </>
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const { csrfToken, csrfCookieHeader } = await getCSRFFormState(request);
  const companyId = await getPrimaryCompanyId(user.id);

  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.companyId, companyId), isNull(subscriptions.deletedAt)))
    .orderBy(asc(subscriptions.status), asc(subscriptions.dueDate), desc(subscriptions.updatedAt));

  const totals = summarizeSubscriptionTotals(rows);
  const items = rows.map((subscription) => ({
    ...subscription,
    nextDueDate: resolveSubscriptionNextDueDate(subscription),
    health: getSubscriptionHealth(subscription),
  }));

  return data(
    { items, totals, csrfToken },
    {
      headers: {
        "Set-Cookie": csrfCookieHeader,
      },
    }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();
  try {
    await requireValidCSRF(request, formData);
  } catch {
    return data({ error: "Sessao do formulario expirou. Atualize a pagina e tente novamente." }, { status: 403 });
  }
  const intent = String(formData.get("intent") || "");

  if (intent === "create") {
    await db.insert(subscriptions).values({
      companyId,
      name: String(formData.get("name") || "").trim(),
      url: parseNullableString(formData.get("url")),
      category: String(formData.get("category") || "other"),
      valueAmount: String(formData.get("valueAmount") || "0"),
      valueCurrency: String(formData.get("valueCurrency") || "BRL").toUpperCase(),
      dueDay: parseNullableNumber(formData.get("dueDay")),
      dueDate: parseNullableString(formData.get("dueDate")),
      recurrence: String(formData.get("recurrence") || "monthly"),
      paymentMethod: parseNullableString(formData.get("paymentMethod")),
      loginHint: parseNullableString(formData.get("loginHint")),
      notes: parseNullableString(formData.get("notes")),
      status: "active",
      alertDaysBefore: Number(formData.get("alertDaysBefore") || 7),
      updatedAt: new Date(),
    });

    return redirect("/subscriptions");
  }

  if (intent === "update") {
    const subscriptionId = String(formData.get("subscriptionId") || "");

    await db
      .update(subscriptions)
      .set({
        name: String(formData.get("name") || "").trim(),
        url: parseNullableString(formData.get("url")),
        category: String(formData.get("category") || "other"),
        valueAmount: String(formData.get("valueAmount") || "0"),
        valueCurrency: String(formData.get("valueCurrency") || "BRL").toUpperCase(),
        dueDay: parseNullableNumber(formData.get("dueDay")),
        dueDate: parseNullableString(formData.get("dueDate")),
        recurrence: String(formData.get("recurrence") || "monthly"),
        paymentMethod: parseNullableString(formData.get("paymentMethod")),
        loginHint: parseNullableString(formData.get("loginHint")),
        notes: parseNullableString(formData.get("notes")),
        status: String(formData.get("status") || "active"),
        alertDaysBefore: Number(formData.get("alertDaysBefore") || 7),
        updatedAt: new Date(),
      })
      .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.companyId, companyId)));

    return redirect("/subscriptions");
  }

  if (intent === "cancel") {
    const subscriptionId = String(formData.get("subscriptionId") || "");

    await db
      .update(subscriptions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.companyId, companyId)));

    return redirect("/subscriptions");
  }

  if (intent === "reactivate") {
    const subscriptionId = String(formData.get("subscriptionId") || "");

    await db
      .update(subscriptions)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.companyId, companyId)));

    return redirect("/subscriptions");
  }

  return redirect("/subscriptions");
}

export default function SubscriptionsPage({ loaderData }: Route.ComponentProps) {
  const { items, totals, csrfToken } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {actionData?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {actionData.error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Financeiro</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">Assinaturas</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Controle de servicos pagos, renovacoes e alertas da operacao.
          </p>
        </div>

        <div className="flex items-center gap-1 border-b border-gray-200 pb-0 dark:border-gray-800">
          <Link
            to="/financial"
            className="flex items-center gap-1.5 rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <DollarSign className="h-4 w-4" />
            Faturas
          </Link>
          <Link
            to="/financial/cashflow"
            className="flex items-center gap-1.5 rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <LayoutDashboard className="h-4 w-4" />
            Controle de Caixa
          </Link>
          <Link
            to="/financial/report"
            className="flex items-center gap-1.5 rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <TrendingUp className="h-4 w-4" />
            Relatorio
          </Link>
          <Link
            to="/subscriptions"
            className="flex items-center gap-1.5 rounded-t-lg border-b-2 border-violet-600 px-4 py-2.5 text-sm font-medium text-violet-600 dark:border-violet-500 dark:text-violet-400"
          >
            <DollarSign className="h-4 w-4" />
            Assinaturas
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Button onClick={() => setShowCreateForm((current) => !current)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova assinatura
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            Total BRL
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-900 dark:text-emerald-100">
            {formatMoney(totals.brl, "BRL")}
          </div>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900 dark:bg-sky-950/20">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
            Total USD
          </div>
          <div className="mt-3 text-3xl font-bold text-sky-900 dark:text-sky-100">
            {formatMoney(totals.usd, "USD")}
          </div>
        </div>
      </div>

      {showCreateForm ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Nova assinatura</div>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="intent" value="create" />
            <SubscriptionFields />
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>Salvar</Button>
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                Fechar
              </Button>
            </div>
          </Form>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Servico</th>
              <th className="px-4 py-3 font-medium text-gray-500">Valor</th>
              <th className="px-4 py-3 font-medium text-gray-500">Recorrencia</th>
              <th className="px-4 py-3 font-medium text-gray-500">Proximo vencimento</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                  Nenhuma assinatura cadastrada.
                </td>
              </tr>
            ) : (
              items.map((subscription) => {
                const isEditing = editingId === subscription.id;
                const healthTone =
                  subscription.health.level === "overdue"
                    ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                    : subscription.health.level === "warning"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                      : subscription.health.level === "ok"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300";

                return (
                  <Fragment key={subscription.id}>
                    <tr key={subscription.id}>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                            {subscription.category}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{subscription.name}</span>
                              {subscription.url ? (
                                <a
                                  href={subscription.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-600 hover:text-sky-500"
                                  title="Abrir link"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : null}
                            </div>
                            {subscription.paymentMethod ? (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Pagamento: {subscription.paymentMethod}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-gray-900 dark:text-gray-100">
                        {formatMoney(Number(subscription.valueAmount), subscription.valueCurrency)}
                      </td>
                      <td className="px-4 py-4 align-top text-gray-600 dark:text-gray-300">
                        {subscription.recurrence}
                      </td>
                      <td className="px-4 py-4 align-top text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDate(subscription.nextDueDate)}</span>
                        </div>
                        {subscription.dueDay ? (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Dia {subscription.dueDay}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${healthTone}`}>
                          <span>{subscription.health.emoji}</span>
                          <span>{subscription.health.label}</span>
                        </div>
                        {subscription.status !== "active" ? (
                          <div className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-500">
                            {subscription.status}
                          </div>
                        ) : subscription.health.daysUntil !== null ? (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {subscription.health.daysUntil < 0
                              ? `${Math.abs(subscription.health.daysUntil)} dia(s) atrasado(s)`
                              : `${subscription.health.daysUntil} dia(s) para vencer`}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(isEditing ? null : subscription.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {subscription.status === "cancelled" ? (
                            <Form method="post">
                              <input type="hidden" name="csrf" value={csrfToken} />
                              <input type="hidden" name="intent" value="reactivate" />
                              <input type="hidden" name="subscriptionId" value={subscription.id} />
                              <Button type="submit" variant="outline" size="sm" disabled={isSubmitting}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </Form>
                          ) : (
                            <Form method="post" onSubmit={(event) => { if (!confirm(`Cancelar ${subscription.name}?`)) event.preventDefault(); }}>
                              <input type="hidden" name="csrf" value={csrfToken} />
                              <input type="hidden" name="intent" value="cancel" />
                              <input type="hidden" name="subscriptionId" value={subscription.id} />
                              <Button type="submit" variant="outline" size="sm" disabled={isSubmitting}>
                                <Ban className="h-4 w-4" />
                              </Button>
                            </Form>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isEditing ? (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 px-4 py-4 dark:bg-gray-900/60">
                          <Form method="post" className="space-y-3">
                            <input type="hidden" name="csrf" value={csrfToken} />
                            <input type="hidden" name="intent" value="update" />
                            <input type="hidden" name="subscriptionId" value={subscription.id} />
                            <SubscriptionFields subscription={subscription} />
                            <div className="flex gap-2">
                              <Button type="submit" disabled={isSubmitting}>Salvar alteracoes</Button>
                              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                                Fechar
                              </Button>
                            </div>
                          </Form>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
