import { Form, Link } from "react-router";
import type { Route } from "./+types/financial-report";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients } from "drizzle/schema";
import { eq, desc, sql, and, isNull, gte } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { BarChart3, Download, TrendingUp, TrendingDown, AlertCircle, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";

function generateCSV(
  rows: {
    number: string;
    clientName: string | null;
    type: string;
    status: string;
    currency: string | null;
    total: string;
    dueDate: string;
    paidDate: string | null;
    description: string | null;
  }[]
): string {
  const header = "Numero;Cliente;Tipo;Status;Moeda;Total;Vencimento;Data Pagamento;Descricao";
  const lines = rows.map((r) =>
    [
      r.number,
      `"${(r.clientName || "").replace(/"/g, '""')}"`,
      r.type,
      r.status,
      r.currency || "BRL",
      r.total,
      r.dueDate,
      r.paidDate || "",
      `"${(r.description || "").replace(/"/g, '""')}"`,
    ].join(";")
  );
  return [header, ...lines].join("\n");
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // Summary metrics
  const [summary] = await db
    .select({
      totalReceivable: sql<number>`COALESCE(SUM(CASE WHEN type = 'receivable' AND status NOT IN ('cancelled', 'paid') THEN total::numeric ELSE 0 END), 0)`,
      totalPayable: sql<number>`COALESCE(SUM(CASE WHEN type = 'payable' AND status NOT IN ('cancelled', 'paid') THEN total::numeric ELSE 0 END), 0)`,
      overdueCount: sql<number>`COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END)::int, 0)`,
    })
    .from(invoices)
    .where(isNull(invoices.deletedAt));

  // Paid this month
  const [paidThisMonth] = await db
    .select({
      receivable: sql<number>`COALESCE(SUM(CASE WHEN type = 'receivable' THEN paid_amount::numeric ELSE 0 END), 0)`,
      payable: sql<number>`COALESCE(SUM(CASE WHEN type = 'payable' THEN paid_amount::numeric ELSE 0 END), 0)`,
    })
    .from(invoices)
    .where(
      and(
        isNull(invoices.deletedAt),
        eq(invoices.status, "paid"),
        gte(invoices.paidDate, startOfMonth.toISOString().slice(0, 10))
      )
    );

  // Recent paid invoices (last 10)
  const recentPaid = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientName: clients.razaoSocial,
      type: invoices.type,
      total: invoices.total,
      paidDate: invoices.paidDate,
      paidAmount: invoices.paidAmount,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(isNull(invoices.deletedAt), eq(invoices.status, "paid")))
    .orderBy(desc(invoices.paidDate))
    .limit(10);

  // Cash flow data: group by month (last 6 months)
  const cashFlow = await db
    .select({
      month: sql<string>`to_char(due_date::date, 'YYYY-MM')`,
      receivable: sql<number>`COALESCE(SUM(CASE WHEN type = 'receivable' THEN total::numeric ELSE 0 END), 0)`,
      payable: sql<number>`COALESCE(SUM(CASE WHEN type = 'payable' THEN total::numeric ELSE 0 END), 0)`,
    })
    .from(invoices)
    .where(
      and(
        isNull(invoices.deletedAt),
        gte(invoices.dueDate, sixMonthsAgo.toISOString().slice(0, 10)),
        sql`status != 'cancelled'`
      )
    )
    .groupBy(sql`to_char(due_date::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(due_date::date, 'YYYY-MM')`);

  return {
    totalReceivable: Number(summary.totalReceivable),
    totalPayable: Number(summary.totalPayable),
    overdueCount: Number(summary.overdueCount),
    paidThisMonthReceivable: Number(paidThisMonth.receivable),
    paidThisMonthPayable: Number(paidThisMonth.payable),
    recentPaid,
    cashFlow: cashFlow.map((cf) => ({
      month: cf.month,
      receivable: Number(cf.receivable),
      payable: Number(cf.payable),
    })),
    locale,
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export-csv") {
    const allInvoices = await db
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
      .orderBy(desc(invoices.createdAt));

    const csv = generateCSV(allInvoices);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthLabel = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-");
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${months[parseInt(m, 10) - 1]}/${y}`;
};

export default function FinancialReportPage({ loaderData }: Route.ComponentProps) {
  const {
    totalReceivable,
    totalPayable,
    overdueCount,
    paidThisMonthReceivable,
    paidThisMonthPayable,
    recentPaid,
    cashFlow,
    locale,
  } = loaderData;
  const i18n = t(locale);

  const maxCashFlowValue = Math.max(
    ...cashFlow.map((cf) => Math.max(cf.receivable, cf.payable)),
    1
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {locale === "pt-BR" ? "Relatorio Financeiro" : "Financial Report"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/financial">
            <Button variant="outline" size="sm">
              {i18n.common.back}
            </Button>
          </Link>
          <Form method="post" action="/api/export-financial-sheets">
            <Button type="submit" variant="secondary" size="sm">
              <Zap className="h-4 w-4" />
              {locale === "pt-BR" ? "Exportar Sheets" : "Export Sheets"}
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="export-csv" />
            <Button type="submit" variant="secondary" size="sm">
              <Download className="h-4 w-4" />
              {locale === "pt-BR" ? "Exportar CSV" : "Export CSV"}
            </Button>
          </Form>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-800">
        <Link
          to="/financial"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          {i18n.financial.invoices}
        </Link>
        <Link
          to="/financial/report"
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          {i18n.nav.financialReport}
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Receivable */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{i18n.financial.totalReceivable}</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">R$ {fmt(totalReceivable)}</p>
            </div>
          </div>
        </div>

        {/* Total Payable */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{i18n.financial.totalPayable}</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">R$ {fmt(totalPayable)}</p>
            </div>
          </div>
        </div>

        {/* Paid This Month - Receivable */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {locale === "pt-BR" ? "Recebido no Mes" : "Received This Month"}
              </p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">R$ {fmt(paidThisMonthReceivable)}</p>
            </div>
          </div>
        </div>

        {/* Paid This Month - Payable */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <TrendingDown className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {locale === "pt-BR" ? "Pago no Mes" : "Paid This Month"}
              </p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">R$ {fmt(paidThisMonthPayable)}</p>
            </div>
          </div>
        </div>

        {/* Overdue Count */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{i18n.financial.overdueCount}</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{overdueCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Chart (Bar representation) */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {locale === "pt-BR" ? "Fluxo de Caixa (Ultimos 6 Meses)" : "Cash Flow (Last 6 Months)"}
        </h2>

        {cashFlow.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {locale === "pt-BR" ? "Sem dados para o periodo." : "No data for this period."}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Bar chart */}
            <div className="flex items-end gap-3" style={{ minHeight: 200 }}>
              {cashFlow.map((cf) => (
                <div key={cf.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end justify-center gap-1" style={{ height: 160 }}>
                    {/* Receivable bar */}
                    <div
                      className="w-5 rounded-t bg-green-500 dark:bg-green-400 transition-all"
                      style={{
                        height: `${Math.max((cf.receivable / maxCashFlowValue) * 160, 4)}px`,
                      }}
                      title={`${locale === "pt-BR" ? "A Receber" : "Receivable"}: R$ ${fmt(cf.receivable)}`}
                    />
                    {/* Payable bar */}
                    <div
                      className="w-5 rounded-t bg-red-500 dark:bg-red-400 transition-all"
                      style={{
                        height: `${Math.max((cf.payable / maxCashFlowValue) * 160, 4)}px`,
                      }}
                      title={`${locale === "pt-BR" ? "A Pagar" : "Payable"}: R$ ${fmt(cf.payable)}`}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{monthLabel(cf.month)}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-green-500 dark:bg-green-400" />
                {i18n.financial.receivable}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-500 dark:bg-red-400" />
                {i18n.financial.payable}
              </div>
            </div>

            {/* Table view */}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {locale === "pt-BR" ? "Mes" : "Month"}
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {i18n.financial.receivable}
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {i18n.financial.payable}
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {locale === "pt-BR" ? "Saldo" : "Balance"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {cashFlow.map((cf) => {
                    const balance = cf.receivable - cf.payable;
                    return (
                      <tr key={cf.month} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {monthLabel(cf.month)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-green-600 dark:text-green-400">
                          R$ {fmt(cf.receivable)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-red-600 dark:text-red-400">
                          R$ {fmt(cf.payable)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-2 text-right text-sm font-medium ${
                            balance >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          R$ {fmt(balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Recent Paid Invoices */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {locale === "pt-BR" ? "Ultimos Pagamentos" : "Recent Payments"}
        </h2>

        {recentPaid.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {locale === "pt-BR" ? "Nenhum pagamento registrado." : "No payments recorded."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {i18n.financial.invoiceNumber}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {i18n.processes.client}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {i18n.processes.type}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {i18n.financial.total}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {i18n.financial.paidDate}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {recentPaid.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-4 py-2">
                      <Link
                        to={`/financial/${inv.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {inv.clientName || "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.type === "receivable"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {inv.type === "receivable" ? i18n.financial.receivable : i18n.financial.payable}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                      R$ {fmt(parseFloat(inv.paidAmount || inv.total))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {inv.paidDate || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
