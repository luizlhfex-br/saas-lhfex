import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/financial";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients } from "drizzle/schema";
import { eq, isNull, sql, desc, and, like } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Plus, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Search, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Pagination } from "~/components/ui/pagination";

const ITEMS_PER_PAGE = 20;

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

  // Summary via SQL aggregation (not loading all rows into memory)
  const [summary] = await db
    .select({
      totalReceivable: sql<number>`COALESCE(SUM(CASE WHEN type = 'receivable' AND status NOT IN ('cancelled', 'paid') THEN total::numeric ELSE 0 END), 0)`,
      totalPayable: sql<number>`COALESCE(SUM(CASE WHEN type = 'payable' AND status NOT IN ('cancelled', 'paid') THEN total::numeric ELSE 0 END), 0)`,
      overdueCount: sql<number>`COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END)::int, 0)`,
    })
    .from(invoices)
    .where(isNull(invoices.deletedAt));

  const totalReceivable = Number(summary.totalReceivable);
  const totalPayable = Number(summary.totalPayable);
  const overdueCount = Number(summary.overdueCount);

  // Filtered list
  const conditions = [isNull(invoices.deletedAt)];
  if (search) conditions.push(like(invoices.number, `%${search}%`));
  if (statusFilter) conditions.push(eq(invoices.status, statusFilter as any));
  if (typeFilter) conditions.push(eq(invoices.type, typeFilter as any));

  const whereClause = and(...conditions);

  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(whereClause);

  const invoiceList = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientId: invoices.clientId,
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

  return { invoices: invoiceList, totalReceivable, totalPayable, overdueCount, totalCount, page, locale };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

export default function FinancialPage({ loaderData }: Route.ComponentProps) {
  const { invoices: invoiceList, totalReceivable, totalPayable, overdueCount, totalCount, page, locale } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const i18n = t(locale);

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentType = searchParams.get("type") || "";
  const hasFilters = currentSearch || currentStatus || currentType;

  const statusLabel: Record<string, string> = {
    draft: i18n.financial.draft, sent: i18n.financial.sent,
    paid: i18n.financial.paid, overdue: i18n.financial.overdue,
    cancelled: i18n.financial.cancelled,
  };

  const typeLabel: Record<string, string> = {
    receivable: i18n.financial.receivable, payable: i18n.financial.payable,
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) { params.set(key, value); } else { params.delete(key); }
    params.delete("page");
    setSearchParams(params);
  };

  const clearFilters = () => setSearchParams({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.financial.title}</h1>
        <Link to="/financial/new">
          <Button><Plus className="h-4 w-4" />{i18n.financial.newInvoice}</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.financial.totalReceivable}</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">R$ {fmt(totalReceivable)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.financial.totalPayable}</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">R$ {fmt(totalPayable)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.financial.overdueCount}</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{overdueCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar número da fatura..."
            defaultValue={currentSearch}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select
          value={currentStatus}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusLabel).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={currentType}
          onChange={(e) => updateFilter("type", e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">Todos os tipos</option>
          <option value="receivable">{i18n.financial.receivable}</option>
          <option value="payable">{i18n.financial.payable}</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Invoice Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {invoiceList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <DollarSign className="mb-4 h-12 w-12" />
            <p>{hasFilters ? "Nenhuma fatura encontrada com esses filtros." : i18n.financial.noInvoices}</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.financial.invoiceNumber}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.processes.client}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.processes.type}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.common.status}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.financial.total}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{i18n.financial.dueDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {invoiceList.map((inv) => (
                    <tr key={inv.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link to={`/financial/${inv.id}`} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">{inv.number}</Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{inv.clientName || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${inv.type === "receivable" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {typeLabel[inv.type] || inv.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[inv.status] || ""}`}>
                          {statusLabel[inv.status] || inv.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        {inv.currency || "BRL"} {fmt(parseFloat(inv.total))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{inv.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination totalItems={totalCount} itemsPerPage={ITEMS_PER_PAGE} currentPage={page} />
          </>
        )}
      </div>
    </div>
  );
}
