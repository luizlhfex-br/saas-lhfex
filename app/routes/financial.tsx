import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/financial";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients } from "drizzle/schema";
import { and, desc, eq, isNull, like, sql } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Pagination } from "~/components/ui/pagination";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  DollarSign,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;
const validStatuses = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
type InvoiceStatus = typeof validStatuses[number];
const isValidStatus = (value: string): value is InvoiceStatus => (validStatuses as readonly string[]).includes(value);

const validTypes = ["receivable", "payable"] as const;
type InvoiceType = typeof validTypes[number];
const isValidType = (value: string): value is InvoiceType => (validTypes as readonly string[]).includes(value);

const panelClass =
  "rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] shadow-[var(--app-card-shadow)]";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const search = url.searchParams.get("search") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const typeFilter = url.searchParams.get("type") || "";
  const companyId = await getPrimaryCompanyId(user.id);

  const [summary] = await db
    .select({
      totalReceivable: sql<number>`COALESCE(SUM(CASE WHEN type = 'receivable' AND status NOT IN ('cancelled', 'paid') THEN total::numeric ELSE 0 END), 0)`,
      totalPayable: sql<number>`COALESCE(SUM(CASE WHEN type = 'payable' AND status NOT IN ('cancelled', 'paid') THEN total::numeric ELSE 0 END), 0)`,
      overdueCount: sql<number>`COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END)::int, 0)`,
    })
    .from(invoices)
    .where(and(isNull(invoices.deletedAt), eq(invoices.companyId, companyId)));

  const conditions = [isNull(invoices.deletedAt), eq(invoices.companyId, companyId)];
  if (search) conditions.push(like(invoices.number, `%${search}%`));
  if (statusFilter && isValidStatus(statusFilter)) conditions.push(eq(invoices.status, statusFilter));
  if (typeFilter && isValidType(typeFilter)) conditions.push(eq(invoices.type, typeFilter));

  const whereClause = and(...conditions);

  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(whereClause);

  const invoiceList = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientName: clients.razaoSocial,
      type: invoices.type,
      status: invoices.status,
      currency: invoices.currency,
      total: invoices.total,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(whereClause)
    .orderBy(desc(invoices.createdAt))
    .limit(ITEMS_PER_PAGE)
    .offset((page - 1) * ITEMS_PER_PAGE);

  return {
    invoices: invoiceList,
    totalReceivable: Number(summary.totalReceivable),
    totalPayable: Number(summary.totalPayable),
    overdueCount: Number(summary.overdueCount),
    totalCount,
    page,
    locale,
  };
}

const fmt = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinancialPage({ loaderData }: Route.ComponentProps) {
  const { invoices: invoiceList, totalReceivable, totalPayable, overdueCount, totalCount, page, locale } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const i18n = t(locale);

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentType = searchParams.get("type") || "";
  const hasFilters = currentSearch || currentStatus || currentType;

  const statusLabel: Record<string, string> = {
    draft: i18n.financial.draft,
    sent: i18n.financial.sent,
    paid: i18n.financial.paid,
    overdue: i18n.financial.overdue,
    cancelled: i18n.financial.cancelled,
  };

  const typeLabel: Record<string, string> = {
    receivable: i18n.financial.receivable,
    payable: i18n.financial.payable,
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    setSearchParams(params);
  };

  const clearFilters = () => setSearchParams({});

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,#0c162a_0%,#16253c_50%,#2d1a37_100%)] px-6 py-6 text-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.16)] lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_28%)]" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
          <div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-100">
              Fluxo financeiro
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
              Faturas, caixa e sinais de risco em uma leitura de poucos segundos.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              O modulo financeiro precisa destacar presao de caixa, vencimentos e proximas acoes sem virar tabela fria.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/financial/new">
                <Button className="rounded-full border border-white/12 bg-white/10 text-white hover:bg-white/15">
                  <Plus className="h-4 w-4" />
                  {i18n.financial.newInvoice}
                </Button>
              </Link>
              <Link to="/financial/cashflow/new?type=income" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10">
                <ArrowDownCircle className="h-4 w-4" />
                + Receita
              </Link>
              <Link to="/financial/cashflow/new?type=expense" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10">
                <ArrowUpCircle className="h-4 w-4" />
                + Despesa
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">A receber</p>
              <p className="mt-2 text-3xl font-semibold text-white">R$ {fmt(totalReceivable)}</p>
              <p className="mt-1 text-sm text-slate-300">Titulos abertos de entrada.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">A pagar</p>
              <p className="mt-2 text-3xl font-semibold text-white">R$ {fmt(totalPayable)}</p>
              <p className="mt-1 text-sm text-slate-300">Saidas pendentes no radar.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Em atraso</p>
              <p className="mt-2 text-3xl font-semibold text-white">{overdueCount}</p>
              <p className="mt-1 text-sm text-slate-300">Itens que exigem resposta rapida.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${panelClass} p-3 lg:p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/financial" className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/12 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
            <Wallet className="h-4 w-4" />
            {i18n.financial.invoices}
          </Link>
          <Link to="/financial/cashflow" className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-2)]">
            <LayoutDashboard className="h-4 w-4" />
            Controle de Caixa
          </Link>
          <Link to="/financial/report" className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-2)]">
            <TrendingUp className="h-4 w-4" />
            {i18n.nav.financialReport}
          </Link>
          <Link to="/subscriptions" className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-2)]">
            <ReceiptText className="h-4 w-4" />
            Assinaturas
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={`${panelClass} p-5`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-[var(--app-muted)]">{i18n.financial.totalReceivable}</p>
              <p className="text-2xl font-semibold text-[var(--app-text)]">R$ {fmt(totalReceivable)}</p>
            </div>
          </div>
        </div>
        <div className={`${panelClass} p-5`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/18 bg-rose-400/10 text-rose-700 dark:text-rose-200">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-[var(--app-muted)]">{i18n.financial.totalPayable}</p>
              <p className="text-2xl font-semibold text-[var(--app-text)]">R$ {fmt(totalPayable)}</p>
            </div>
          </div>
        </div>
        <div className={`${panelClass} p-5`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/18 bg-amber-400/10 text-amber-700 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-[var(--app-muted)]">{i18n.financial.overdueCount}</p>
              <p className="text-2xl font-semibold text-[var(--app-text)]">{overdueCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${panelClass} p-5 lg:p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Filtro financeiro</h2>
            <p className="text-sm text-[var(--app-muted)]">Busque por numero da fatura e refine por status ou tipo.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
            <input
              type="text"
              placeholder="Buscar numero da fatura..."
              defaultValue={currentSearch}
              onChange={(event) => updateFilter("search", event.target.value)}
              className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] py-3 pl-10 pr-4 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)]"
            />
          </div>
          <select
            value={currentStatus}
            onChange={(event) => updateFilter("status", event.target.value)}
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)]"
          >
            <option value="">Todos os status</option>
            {Object.entries(statusLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={currentType}
            onChange={(event) => updateFilter("type", event.target.value)}
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)]"
          >
            <option value="">Todos os tipos</option>
            <option value="receivable">{i18n.financial.receivable}</option>
            <option value="payable">{i18n.financial.payable}</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--app-border)] px-4 py-3 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)]"
            >
              <X className="h-4 w-4" />
              Limpar
            </button>
          )}
        </div>
      </section>

      <section className={panelClass}>
        {invoiceList.length === 0 ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-16 text-center">
            <DollarSign className="mb-4 h-16 w-16 text-[var(--app-muted)]" />
            <p className="text-lg font-semibold text-[var(--app-text)]">{i18n.financial.noInvoices}</p>
            <p className="mt-2 max-w-md text-sm text-[var(--app-muted)]">
              {hasFilters
                ? "Nenhuma fatura encontrada com esse recorte."
                : "Cadastre uma nova fatura para comecar a consolidar caixa e cobrancas."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4 lg:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Grade financeira</h2>
                <p className="text-sm text-[var(--app-muted)]">
                  {totalCount} {totalCount === 1 ? "fatura encontrada" : "faturas encontradas"}
                </p>
              </div>
              <a
                href="https://app.contabilizei.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-2 rounded-full border border-[var(--app-border)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface)] sm:inline-flex"
              >
                Contabilizei
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {invoiceList.map((invoice) => (
                <div key={invoice.id} className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/financial/${invoice.id}`} className="text-base font-semibold text-[var(--app-text)]">
                        {invoice.number}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--app-muted)]">{invoice.clientName || "Sem cliente"}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${invoice.type === "receivable" ? "border-emerald-300/20 bg-emerald-400/12 text-emerald-700 dark:text-emerald-200" : "border-rose-300/20 bg-rose-400/12 text-rose-700 dark:text-rose-200"}`}>
                      {typeLabel[invoice.type] || invoice.type}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">
                      {statusLabel[invoice.status] || invoice.status}
                    </span>
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">
                      {invoice.currency || "BRL"} {fmt(parseFloat(invoice.total))}
                    </span>
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">
                      Venc. {invoice.dueDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-left">
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Fatura</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Cliente</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Tipo</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Status</th>
                    <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Total</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-[var(--app-border)]/80 transition-colors hover:bg-[var(--app-surface)]">
                      <td className="px-6 py-4">
                        <Link to={`/financial/${invoice.id}`} className="font-semibold text-[var(--app-text)] hover:text-emerald-700 dark:hover:text-emerald-300">
                          {invoice.number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--app-muted)]">{invoice.clientName || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${invoice.type === "receivable" ? "border-emerald-300/20 bg-emerald-400/12 text-emerald-700 dark:text-emerald-200" : "border-rose-300/20 bg-rose-400/12 text-rose-700 dark:text-rose-200"}`}>
                          {typeLabel[invoice.type] || invoice.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                          {statusLabel[invoice.status] || invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-[var(--app-text)]">
                        {invoice.currency || "BRL"} {fmt(parseFloat(invoice.total))}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--app-muted)]">{invoice.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination totalItems={totalCount} itemsPerPage={ITEMS_PER_PAGE} currentPage={page} />
          </>
        )}
      </section>
    </div>
  );
}
