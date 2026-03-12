import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/financial-detail";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients, contacts, invoiceItems, companyProfile, companyBankAccounts } from "drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { ArrowLeft, FileText, DollarSign, Printer, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { data } from "react-router";
import { getPrimaryCompanyId } from "~/lib/company-context.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const invoiceResult = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, params.id), eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
    .limit(1);

  if (invoiceResult.length === 0) {
    throw new Response("Not Found", { status: 404 });
  }

  const invoice = invoiceResult[0];

  const [clientResult, items] = await Promise.all([
    db
      .select({ razaoSocial: clients.razaoSocial, email: contacts.email })
      .from(clients)
      .leftJoin(
        contacts,
        and(eq(contacts.clientId, clients.id), eq(contacts.isPrimary, true), isNull(contacts.deletedAt))
      )
      .where(and(eq(clients.id, invoice.clientId), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .limit(1),
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id)),
  ]);

  return {
    invoice,
    clientName: clientResult[0]?.razaoSocial || "—",
    clientEmail: clientResult[0]?.email || null,
    items,
    locale,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "send_email") {
    const { sendInvoiceEmail } = await import("~/lib/email.server");

    // Fetch invoice, client, company, and bank data
    const [invoiceResult, companyResult, bankAccounts] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, params.id), eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
        .limit(1),
      db.select().from(companyProfile).where(eq(companyProfile.id, companyId)).limit(1),
      db.select().from(companyBankAccounts).where(eq(companyBankAccounts.companyId, companyId)).limit(3),
    ]);

    if (invoiceResult.length === 0) {
      return data({ error: "Fatura não encontrada." }, { status: 404 });
    }

    const invoice = invoiceResult[0];
    const company = companyResult[0] || null;

    const [clientResult, items] = await Promise.all([
      db
        .select({ razaoSocial: clients.razaoSocial, email: contacts.email })
        .from(clients)
        .leftJoin(
          contacts,
          and(eq(contacts.clientId, clients.id), eq(contacts.isPrimary, true), isNull(contacts.deletedAt))
        )
        .where(and(eq(clients.id, invoice.clientId), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
        .limit(1),
      db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id)),
    ]);

    const client = clientResult[0];
    if (!client?.email) {
      return data({ error: "Cliente sem e-mail cadastrado. Atualize o cadastro do cliente primeiro." }, { status: 400 });
    }

    // Find Inter bank or first bank
    const interBank = bankAccounts.find((b) => b.bankName?.toLowerCase().includes("inter")) || bankAccounts[0];

    // Format due date
    const fmtDateForEmail = (iso: string | null) => {
      if (!iso) return "—";
      const [y, m, d] = iso.split("-");
      return d ? `${d}/${m}/${y}` : iso;
    };
    const fmtAmount = (v: string | number) =>
      Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const ok = await sendInvoiceEmail({
      to: client.email,
      clientName: client.razaoSocial || "Cliente",
      invoiceNumber: invoice.number,
      invoiceId: invoice.id,
      total: fmtAmount(invoice.total),
      currency: invoice.currency || "BRL",
      dueDate: fmtDateForEmail(invoice.dueDate),
      items: items.map((it) => ({ description: it.description, total: fmtAmount(it.total) })),
      companyName: company?.razaoSocial || undefined,
      companyCnpj: company?.cnpj || undefined,
      bankName: interBank?.bankName || undefined,
      bankAgency: interBank?.bankAgency || undefined,
      bankAccount: interBank?.bankAccount || undefined,
      pixKey: interBank?.bankPix || undefined,
    });

    if (ok) {
      // Update status to "sent" if draft
      if (invoice.status === "draft") {
        await db.update(invoices).set({ status: "sent", updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
      }
      return data({ success: `Email enviado para ${client.email}` });
    } else {
      return data({ error: "Falha ao enviar email. Verifique as configurações SMTP." }, { status: 500 });
    }
  }

  return data({ error: "Intent inválido" }, { status: 400 });
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
  const { invoice, clientName, clientEmail, items, locale } = loaderData;
  const i18n = t(locale);
  const fetcher = useFetcher<{ success?: string; error?: string }>();
  const isSending = fetcher.state !== "idle";
  const sendResult = fetcher.data;

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

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/financial/fatura-print?invoiceId=${invoice.id}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Printer className="h-4 w-4" />
            Visualizar Fatura
          </Link>

          {invoice.type === "receivable" && invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="send_email" />
              <Button
                type="submit"
                disabled={isSending || !clientEmail}
                title={!clientEmail ? "Cliente sem e-mail cadastrado" : undefined}
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {isSending ? "Enviando..." : "Enviar por Email"}
              </Button>
            </fetcher.Form>
          )}

          {invoice.status === "paid" && (
            <Link
              to={`/financial/receipt?invoiceId=${invoice.id}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <FileText className="h-4 w-4" />
              Ver Recibo
            </Link>
          )}
        </div>
      </div>

      {/* Email feedback */}
      {sendResult?.success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {sendResult.success}
        </div>
      )}
      {sendResult?.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {sendResult.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Invoice Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <FileText className="h-5 w-5 text-blue-600" /> {i18n.financial.invoices}
          </h2>
          <div className="space-y-3">
            <InfoRow label={i18n.processes.type} value={typeLabel[invoice.type] || invoice.type} />
            <InfoRow label={i18n.processes.client} value={clientName} />
            {clientEmail && <InfoRow label="E-mail do cliente" value={clientEmail} />}
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
