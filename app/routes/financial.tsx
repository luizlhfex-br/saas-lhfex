import { Link } from "react-router";
import type { Route } from "./+types/financial";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices } from "drizzle/schema";
import { eq, isNull, sql, desc } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Plus, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const allInvoices = await db
    .select()
    .from(invoices)
    .where(isNull(invoices.deletedAt))
    .orderBy(desc(invoices.createdAt));

  const totalReceivable = allInvoices
    .filter((i) => i.type === "receivable" && i.status !== "cancelled" && i.status !== "paid")
    .reduce((sum, i) => sum + parseFloat(i.total), 0);

  const totalPayable = allInvoices
    .filter((i) => i.type === "payable" && i.status !== "cancelled" && i.status !== "paid")
    .reduce((sum, i) => sum + parseFloat(i.total), 0);

  const overdueCount = allInvoices.filter((i) => i.status === "overdue").length;

  return { invoices: allInvoices, totalReceivable, totalPayable, overdueCount, locale };
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
  const { invoices: invoiceList, totalReceivable, totalPayable, overdueCount, locale } = loaderData;
  const i18n = t(locale);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.financial.title}</h1>
        </div>
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

      {/* Invoice Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
              {invoiceList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">{i18n.financial.noInvoices}</td>
                </tr>
              ) : (
                invoiceList.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/financial/${inv.id}`} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">{inv.number}</Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{inv.clientId.slice(0, 8)}...</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
