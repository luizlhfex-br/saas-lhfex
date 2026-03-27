import { and, eq } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  LayoutDashboard,
  ReceiptText,
  RefreshCcw,
  Upload,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/financial-cashflow";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { getUserLocale } from "~/lib/i18n.server";
import { db } from "~/lib/db.server";
import { cashMovements } from "../../drizzle/schema";

const panelClass =
  "rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] shadow-[var(--app-card-shadow)]";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function getStatusLabel(status: "planned" | "settled" | "cancelled") {
  if (status === "settled") return "Liquidado";
  if (status === "cancelled") return "Cancelado";
  return "Previsto";
}

function getStatusClass(status: "planned" | "settled" | "cancelled", isOverdue: boolean) {
  if (status === "cancelled") {
    return "border-slate-300/20 bg-slate-500/10 text-slate-600 dark:text-slate-300";
  }
  if (status === "settled") {
    return "border-emerald-300/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }
  if (isOverdue) {
    return "border-rose-300/20 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  }
  return "border-amber-300/20 bg-amber-500/10 text-amber-700 dark:text-amber-200";
}

export async function loader({ request }: Route.LoaderArgs) {
  const { getCashFlowForMonth } = await import("~/lib/cashflow.server");
  const { user } = await requireAuth(request);
  await getUserLocale(request, user);

  const url = new URL(request.url);
  const now = new Date();
  const year = Math.max(2020, parseInt(url.searchParams.get("year") || String(now.getFullYear()), 10));
  const month = Math.min(12, Math.max(1, parseInt(url.searchParams.get("month") || String(now.getMonth() + 1), 10)));
  const period = url.searchParams.get("period") || "this_month";
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const companyId = await getPrimaryCompanyId(user.id);

  const cashflow = await getCashFlowForMonth(year, month, {
    companyId,
    userId: user.id,
    period: period as "this_month" | "last_month" | "this_year" | "custom",
    startDate,
    endDate,
  });

  return {
    cashflow,
    year,
    month,
    period,
    startDate,
    endDate,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const id = String(formData.get("id") || "");
  const returnTo = String(formData.get("returnTo") || "/financial/cashflow");

  if (!id) {
    return redirect(returnTo);
  }

  if (intent === "toggle_status") {
    const currentStatus = String(formData.get("currentStatus") || "planned");
    const plannedDate = String(formData.get("plannedDate") || "");
    const nextStatus = currentStatus === "settled" ? "planned" : "settled";

    await db
      .update(cashMovements)
      .set({
        status: nextStatus,
        settlementDate: nextStatus === "settled" ? new Date().toISOString().split("T")[0] || plannedDate : null,
        updatedAt: new Date(),
      })
      .where(and(eq(cashMovements.id, id), eq(cashMovements.companyId, companyId)));
  }

  if (intent === "cancel_movement") {
    await db
      .update(cashMovements)
      .set({
        status: "cancelled",
        settlementDate: null,
        updatedAt: new Date(),
      })
      .where(and(eq(cashMovements.id, id), eq(cashMovements.companyId, companyId)));
  }

  return redirect(returnTo);
}

export default function FinancialCashflowPage({ loaderData }: Route.ComponentProps) {
  const { cashflow, year, month, period, startDate, endDate } = loaderData;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const returnTo = `/financial/cashflow?year=${year}&month=${month}&period=${period}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`;

  const topCategories = cashflow.byCategory.slice(0, 6);
  const upcomingMovements = cashflow.pendingMovements.slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,#081322_0%,#15263e_55%,#1f3649_100%)] px-6 py-6 text-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.16)] lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.14),transparent_30%)]" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
          <div>
            <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-100">
              Fluxo de caixa LHFEX
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
              Caixa forte com previsto, realizado e saldo projetado.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              A tela segue a logica do fluxo de caixa: data prevista, baixa financeira, acumulado e pressao de caixa sem virar um ERP burocratico.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/financial/cashflow/new?type=income">
                <Button className="rounded-full border border-white/12 bg-white/10 text-white hover:bg-white/15">
                  <ArrowDownCircle className="h-4 w-4" />
                  Nova receita
                </Button>
              </Link>
              <Link to="/financial/cashflow/new?type=expense">
                <Button className="rounded-full border border-white/12 bg-white/5 text-white hover:bg-white/10">
                  <ArrowUpCircle className="h-4 w-4" />
                  Nova despesa
                </Button>
              </Link>
              <Link to="/financial/cashflow/import" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10">
                <Upload className="h-4 w-4" />
                Importar CSV
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Saldo hoje</p>
              <p className="mt-2 text-3xl font-semibold text-white">R$ {formatBRL(cashflow.currentBalance)}</p>
              <p className="mt-1 text-sm text-slate-300">Caixa real considerando baixas ja confirmadas.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Fechamento projetado</p>
              <p className="mt-2 text-3xl font-semibold text-white">R$ {formatBRL(cashflow.projectedClosingBalance)}</p>
              <p className="mt-1 text-sm text-slate-300">Saldo esperado ao final do periodo.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${panelClass} p-3 lg:p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/financial" className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-2)]">
            <ReceiptText className="h-4 w-4" />
            Faturas
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/12 px-4 py-2 text-sm font-semibold text-sky-700 dark:text-sky-200">
            <LayoutDashboard className="h-4 w-4" />
            Controle de Caixa
          </span>
          <Link to="/financial/report" className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-2)]">
            <Wallet className="h-4 w-4" />
            Relatorio
          </Link>
          <Link to="/financial/categories" className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-2)]">
            <DollarSign className="h-4 w-4" />
            Categorias
          </Link>
        </div>
      </section>

      <section className={`${panelClass} p-5 lg:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/financial/cashflow?year=${prevYear}&month=${prevMonth}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h2 className="text-xl font-semibold capitalize text-[var(--app-text)]">{monthName}</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/financial/cashflow?year=${nextYear}&month=${nextMonth}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to="/financial/cashflow?period=this_month" className={`rounded-full px-3 py-1.5 text-sm ${period === "this_month" ? "bg-sky-600 text-white" : "bg-[var(--app-surface-2)] text-[var(--app-muted)]"}`}>
              Este mes
            </Link>
            <Link to="/financial/cashflow?period=last_month" className={`rounded-full px-3 py-1.5 text-sm ${period === "last_month" ? "bg-sky-600 text-white" : "bg-[var(--app-surface-2)] text-[var(--app-muted)]"}`}>
              Mes passado
            </Link>
            <Link to="/financial/cashflow?period=this_year" className={`rounded-full px-3 py-1.5 text-sm ${period === "this_year" ? "bg-sky-600 text-white" : "bg-[var(--app-surface-2)] text-[var(--app-muted)]"}`}>
              Este ano
            </Link>
            <Link
              to={`/financial/cashflow?period=custom&startDate=${startDate || `${year}-01-01`}&endDate=${endDate || `${year}-12-31`}`}
              className={`rounded-full px-3 py-1.5 text-sm ${period === "custom" ? "bg-sky-600 text-white" : "bg-[var(--app-surface-2)] text-[var(--app-muted)]"}`}
            >
              Personalizado
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Saldo de abertura</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--app-text)]">R$ {formatBRL(cashflow.openingBalance)}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Saldo vindo das baixas anteriores ao periodo.</p>
        </div>
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Entradas liquidadas</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-300">R$ {formatBRL(cashflow.settledIncome)}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Recebimentos ja confirmados no periodo.</p>
        </div>
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Saidas liquidadas</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600 dark:text-rose-300">R$ {formatBRL(cashflow.settledExpense)}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Pagamentos ja baixados no caixa.</p>
        </div>
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Pendencias</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-300">R$ {formatBRL(cashflow.pendingAmount)}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">{cashflow.pendingMovements.length} lancamentos ainda previstos.</p>
        </div>
        <div className={`${panelClass} p-5`}>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--app-muted)]">Itens em atraso</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--app-text)]">{cashflow.overdueCount}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">R$ {formatBRL(cashflow.overdueAmount)} com vencimento estourado.</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <div className={`${panelClass} p-5 lg:p-6`}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--app-text)]">Evolucao mensal</h3>
              <p className="text-sm text-[var(--app-muted)]">Leitura rapida de entradas e saidas liquidadas por mes.</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflow.monthlySeries} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `R$ ${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number | string | undefined) => [`R$ ${formatBRL(Number(value || 0))}`, ""]}
                  contentStyle={{
                    borderRadius: 18,
                    border: "1px solid rgba(148,163,184,0.18)",
                    background: "rgba(15,23,42,0.94)",
                    color: "#e2e8f0",
                  }}
                />
                <Bar dataKey="settledIncome" fill="#22c55e" radius={[12, 12, 0, 0]} name="Entradas" />
                <Bar dataKey="settledExpense" fill="#ef4444" radius={[12, 12, 0, 0]} name="Saidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${panelClass} p-5 lg:p-6`}>
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-[var(--app-text)]">Categorias com mais impacto</h3>
            <p className="text-sm text-[var(--app-muted)]">Top categorias do periodo considerando previsto e realizado.</p>
          </div>
          <div className="space-y-3">
            {topCategories.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-muted)]">
                Nenhum lancamento no periodo para compor ranking de categorias.
              </div>
            ) : (
              topCategories.map((category) => (
                <div key={category.category} className="rounded-[22px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--app-text)]">{category.category}</p>
                      <p className="mt-1 text-sm text-[var(--app-muted)]">
                        Entradas R$ {formatBRL(category.income)} · Saidas R$ {formatBRL(category.expense)}
                      </p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${category.net >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "bg-rose-500/10 text-rose-700 dark:text-rose-200"}`}>
                      {category.net >= 0 ? "+" : "-"}R$ {formatBRL(Math.abs(category.net))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className={`${panelClass} p-5 lg:p-6`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--app-text)]">Pendencias do periodo</h3>
            <p className="text-sm text-[var(--app-muted)]">Itens previstos que ainda aguardam baixa financeira.</p>
          </div>
          <div className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-xs font-semibold text-[var(--app-text)]">
            {cashflow.pendingMovements.length} em aberto
          </div>
        </div>

        {upcomingMovements.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-muted)]">
            Nenhuma pendencia aberta neste periodo.
          </div>
        ) : (
          <div className="grid gap-3">
            {upcomingMovements.map((movement) => (
              <div key={movement.id} className="rounded-[22px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(movement.status, movement.isOverdue)}`}>
                        {movement.isOverdue ? "Atrasado" : getStatusLabel(movement.status)}
                      </span>
                      <span className="inline-flex rounded-full bg-[var(--app-surface-2)] px-3 py-1 text-xs font-medium text-[var(--app-muted)]">
                        {movement.type === "income" ? "Receita" : "Despesa"}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--app-text)]">{movement.description || movement.category}</p>
                      <p className="text-sm text-[var(--app-muted)]">
                        {movement.category}
                        {movement.subcategory ? ` · ${movement.subcategory}` : ""}
                        {movement.paymentMethod ? ` · ${movement.paymentMethod}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--app-muted)]">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Previsto em {formatDate(movement.date)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Saldo projetado: R$ {formatBRL(movement.projectedBalance)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`rounded-[18px] px-4 py-3 text-right ${movement.type === "income" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "bg-rose-500/10 text-rose-700 dark:text-rose-200"}`}>
                      <p className="text-[11px] uppercase tracking-[0.24em]">Valor</p>
                      <p className="mt-1 text-lg font-semibold">R$ {formatBRL(movement.amount)}</p>
                    </div>
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle_status" />
                      <input type="hidden" name="id" value={movement.id} />
                      <input type="hidden" name="currentStatus" value={movement.status} />
                      <input type="hidden" name="plannedDate" value={movement.date} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Button type="submit" className="rounded-full">
                        Liquidar agora
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="cancel_movement" />
                      <input type="hidden" name="id" value={movement.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Button type="submit" variant="outline" className="rounded-full">
                        Cancelar
                      </Button>
                    </Form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="border-b border-[var(--app-border)] px-5 py-5 lg:px-6">
          <h3 className="text-lg font-semibold text-[var(--app-text)]">Lancamentos do periodo</h3>
          <p className="text-sm text-[var(--app-muted)]">Cada linha mostra previsao, baixa financeira e acumulado projetado no caixa.</p>
        </div>

        {cashflow.movements.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--app-muted)]">
            Nenhum lancamento encontrado neste periodo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--app-surface-2)]">
                <tr className="border-b border-[var(--app-border)]">
                  <th className="px-5 py-3 font-medium text-[var(--app-muted)]">Data</th>
                  <th className="px-5 py-3 font-medium text-[var(--app-muted)]">Status</th>
                  <th className="px-5 py-3 font-medium text-[var(--app-muted)]">Categoria</th>
                  <th className="px-5 py-3 font-medium text-[var(--app-muted)]">Descricao</th>
                  <th className="px-5 py-3 font-medium text-[var(--app-muted)]">Baixa</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--app-muted)]">Valor</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--app-muted)]">Acumulado</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--app-muted)]">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {cashflow.movements.map((movement) => (
                  <tr key={movement.id} className="border-b border-[var(--app-border)] last:border-b-0">
                    <td className="px-5 py-4 text-[var(--app-text)]">{formatDate(movement.date)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(movement.status, movement.isOverdue)}`}>
                        {movement.isOverdue ? "Atrasado" : getStatusLabel(movement.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-[var(--app-text)]">{movement.category}</div>
                      <div className="text-xs text-[var(--app-muted)]">
                        {movement.type === "income" ? "Receita" : "Despesa"}
                        {movement.subcategory ? ` · ${movement.subcategory}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--app-muted)]">
                      {movement.description || "-"}
                      <div className="mt-1 text-xs">
                        {movement.hasInvoice === "S" ? "Com NF" : "Sem NF"}
                        {movement.paymentMethod ? ` · ${movement.paymentMethod}` : ""}
                        {movement.costCenter ? ` · ${movement.costCenter}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--app-muted)]">{formatDate(movement.settlementDate)}</td>
                    <td className={`px-5 py-4 text-right font-semibold ${movement.type === "income" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                      R$ {formatBRL(movement.amount)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-[var(--app-text)]">R$ {formatBRL(movement.projectedBalance)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {movement.status !== "cancelled" && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="toggle_status" />
                            <input type="hidden" name="id" value={movement.id} />
                            <input type="hidden" name="currentStatus" value={movement.status} />
                            <input type="hidden" name="plannedDate" value={movement.date} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <Button type="submit" variant="outline" size="sm" className="rounded-full">
                              {movement.status === "settled" ? (
                                <>
                                  <RefreshCcw className="h-3.5 w-3.5" />
                                  Reabrir
                                </>
                              ) : (
                                <>
                                  <Wallet className="h-3.5 w-3.5" />
                                  Liquidar
                                </>
                              )}
                            </Button>
                          </Form>
                        )}
                        {movement.status !== "cancelled" && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="cancel_movement" />
                            <input type="hidden" name="id" value={movement.id} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <Button type="submit" variant="ghost" size="sm" className="rounded-full text-rose-600 hover:text-rose-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Cancelar
                            </Button>
                          </Form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
