import { Link } from "react-router";
import type { Route } from "./+types/financial-detail";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients, invoiceItems } from "drizzle/schema";
import { eq } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { ArrowLeft, FileText, DollarSign } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const invoiceResult = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, params.id))
    .limit(1);

  if (invoiceResult.length === 0) {
    throw new Response("Not Found", { status: 404 });
  }

  const invoice = invoiceResult[0];

  const clientResult = await db
    .select({ razaoSocial: clients.razaoSocial })
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .limit(1);

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoice.id));

  return {
    invoice,
    clientName: clientResult[0]?.razaoSocial || "—",
    items,
    locale,
  };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

export default function FinancialDetailPage({ loaderData }: Route.ComponentProps) {
  const { invoice, clientName, items, locale } = loaderData;
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/financial" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{invoice.number}</h1>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[invoice.status] || ""}`}>
                {statusLabel[invoice.status] || invoice.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{clientName}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Invoice Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <FileText className="h-5 w-5 text-blue-600" /> {i18n.financial.invoices}
          </h2>
          <div className="space-y-3">
            <InfoRow label={i18n.processes.type} value={typeLabel[invoice.type] || invoice.type} />
            <InfoRow label={i18n.processes.client} value={clientName} />
            <InfoRow label={i18n.processes.currency} value={invoice.currency || "BRL"} />
            {invoice.exchangeRate && <InfoRow label={i18n.financial.exchangeRate} value={invoice.exchangeRate} />}
            <InfoRow label={i18n.financial.dueDate} value={invoice.dueDate} />
            {invoice.paidDate && <InfoRow label={i18n.financial.paidDate} value={invoice.paidDate} />}
            {invoice.description && <InfoRow label={i18n.processes.description} value={invoice.description} />}
            {invoice.notes && <InfoRow label={i18n.crm.notes} value={invoice.notes} />}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <DollarSign className="h-5 w-5 text-green-600" /> {i18n.financial.total}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{i18n.financial.subtotal}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">R$ {fmt(parseFloat(invoice.subtotal))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{i18n.financial.taxes}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">R$ {fmt(parseFloat(invoice.taxes || "0"))}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{i18n.financial.total}</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">R$ {fmt(parseFloat(invoice.total))}</span>
              </div>
            </div>
            {invoice.paidAmount && (
              <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                <span className="font-medium text-green-700 dark:text-green-400">{i18n.financial.paidAmount}</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">R$ {fmt(parseFloat(invoice.paidAmount))}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Items */}
      {items.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{i18n.financial.items}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">{i18n.financial.itemDescription}</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-gray-500">{i18n.financial.quantity}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">{i18n.financial.unitPrice}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">{i18n.financial.total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{item.description}</td>
                    <td className="px-4 py-2 text-center text-sm text-gray-600 dark:text-gray-400">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">R$ {fmt(parseFloat(item.unitPrice))}</td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-gray-100">R$ {fmt(parseFloat(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}
