import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/financial-detail";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients, contacts, invoiceItems, companyProfile, companyBankAccounts } from "drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { ArrowLeft, FileText, DollarSign, Printer, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { OperationalHero, OperationalPanel, OperationalStat } from "~/components/ui/operational-page";
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
      <OperationalHero
        eyebrow="Financeiro"
        title={invoice.number}
        description={`${clientName} · leitura consolidada de cobranca, status, valores e itens da fatura.`}
        actions={
          <>
            <Link
              to="/financial"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao financeiro
            </Link>
            <Link
              to={`/financial/fatura-print?invoiceId=${invoice.id}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <Printer className="h-4 w-4" />
              Visualizar fatura
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
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/12 px-4 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/18"
              >
                <FileText className="h-4 w-4" />
                Ver recibo
              </Link>
            )}
          </>
        }
        aside={
          <>
            <OperationalStat
              label="Status"
              value={statusLabel[invoice.status] || invoice.status}
              description="Estado atual da fatura."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Tipo"
              value={typeLabel[invoice.type] || invoice.type}
              description="Conta a receber ou a pagar."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Total"
              value={`${invoice.currency || "BRL"} ${fmt(parseFloat(invoice.total))}`}
              description="Valor consolidado da fatura."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Vencimento"
              value={invoice.dueDate || "—"}
              description="Data limite de pagamento."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
          </>
        }
      />

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
        <OperationalPanel
          title={i18n.financial.invoices}
          icon={<FileText className="h-5 w-5" />}
          description="Metadados, cliente e contexto da cobranca."
        >
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
        </OperationalPanel>

        {/* Financial Summary */}
        <OperationalPanel
          title={i18n.financial.total}
          icon={<DollarSign className="h-5 w-5" />}
          description="Resumo de subtotal, impostos e total consolidado."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--app-muted)]">{i18n.financial.subtotal}</span>
              <span className="font-medium text-[var(--app-text)]">R$ {fmt(parseFloat(invoice.subtotal))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--app-muted)]">{i18n.financial.taxes}</span>
              <span className="font-medium text-[var(--app-text)]">R$ {fmt(parseFloat(invoice.taxes || "0"))}</span>
            </div>
            <div className="border-t border-[var(--app-border)] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-[var(--app-text)]">{i18n.financial.total}</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">R$ {fmt(parseFloat(invoice.total))}</span>
              </div>
            </div>
            {invoice.paidAmount && (
              <div className="flex items-center justify-between rounded-[18px] border border-emerald-300/30 bg-emerald-500/10 p-3">
                <span className="font-medium text-green-700 dark:text-green-400">{i18n.financial.paidAmount}</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">R$ {fmt(parseFloat(invoice.paidAmount))}</span>
              </div>
            )}
          </div>
        </OperationalPanel>
      </div>

      {/* Invoice Items */}
      {items.length > 0 && (
        <OperationalPanel
          title={i18n.financial.items}
          icon={<FileText className="h-5 w-5" />}
          description="Itens que compoem a fatura e o valor total."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--app-border)]">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">{i18n.financial.itemDescription}</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">{i18n.financial.quantity}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">{i18n.financial.unitPrice}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">{i18n.financial.total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm text-[var(--app-text)]">{item.description}</td>
                    <td className="px-4 py-2 text-center text-sm text-[var(--app-muted)]">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-sm text-[var(--app-muted)]">R$ {fmt(parseFloat(item.unitPrice))}</td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-[var(--app-text)]">R$ {fmt(parseFloat(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OperationalPanel>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm">
      <span className="text-[var(--app-muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--app-text)]">{value}</span>
    </div>
  );
}
