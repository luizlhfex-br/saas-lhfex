import { redirect } from "react-router";
import type { Route } from "./+types/financial-new";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients } from "drizzle/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { invoiceSchema } from "~/lib/validators";
import { logAudit } from "~/lib/audit.server";
import { Button } from "~/components/ui/button";
import { OperationalHero, OperationalPanel, OperationalStat } from "~/components/ui/operational-page";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { getPrimaryCompanyId } from "~/lib/company-context.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const clientList = await db
    .select({ id: clients.id, razaoSocial: clients.razaoSocial })
    .from(clients)
    .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)));

  return { locale, clients: clientList };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData);
  const parsed = invoiceSchema.safeParse(raw);

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Generate invoice number
  const year = new Date().getFullYear();
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt)));
  const seq = (countResult[0].count + 1).toString().padStart(4, "0");
  const number = `FAT-${year}-${seq}`;

  await db.insert(invoices).values({
    companyId,
    number,
    clientId: data.clientId,
    processId: data.processId || null,
    type: data.type,
    category: data.category || null,
    status: data.status || "draft",
    currency: data.currency || "BRL",
    exchangeRate: data.exchangeRate || null,
    subtotal: data.subtotal,
    taxes: data.taxes || "0",
    total: data.total,
    dueDate: data.dueDate,
    description: data.description || null,
    notes: data.notes || null,
    createdBy: user.id,
  });

  await logAudit({
    userId: user.id,
    action: "create",
    entity: "invoice",
    changes: { number, ...data },
    request,
  });

  return redirect("/financial");
}

export default function FinancialNewPage({ loaderData, actionData }: Route.ComponentProps) {
  const { locale, clients: clientList } = loaderData;
  const i18n = t(locale);
  const errors = (actionData as { errors?: Record<string, string[]> })?.errors;
  const labelClassName = "mb-1.5 block text-sm font-medium text-[var(--app-text)]";
  const fieldClassName = "block h-12 w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10";
  const textareaClassName = "block min-h-[112px] w-full rounded-[22px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10";

  return (
    <div className="space-y-6">
      <OperationalHero
        eyebrow="Financeiro"
        title={i18n.financial.newInvoice}
        description="Emissao guiada de fatura com cliente, tipo, moeda, valores, vencimento e contexto da cobranca."
        actions={
          <>
            <Link
              to="/financial"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao financeiro
            </Link>
            <Button type="submit" form="financial-new-form">
              {i18n.common.save}
            </Button>
          </>
        }
        aside={
          <>
            <OperationalStat
              label="Cliente"
              value="Selecionar"
              description="Empresa que recebe ou paga a fatura."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Tipo"
              value="receivable"
              description="Conta a receber por padrao."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Moeda"
              value="BRL"
              description="Padrao inicial de faturamento."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Status"
              value="draft"
              description="Estado inicial ao salvar."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
          </>
        }
      />

      <form id="financial-new-form" method="post" className="space-y-6">
        <OperationalPanel
          title="Dados da fatura"
          description="Configure cliente, valores, moeda, vencimento e contexto da cobranca."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Client */}
            <div>
              <label className={labelClassName}>{i18n.processes.client} *</label>
              <select name="clientId" required className={fieldClassName}>
                <option value="">Selecionar...</option>
                {clientList.map((c) => (
                  <option key={c.id} value={c.id}>{c.razaoSocial}</option>
                ))}
              </select>
              {errors?.clientId && <p className="mt-1 text-xs text-red-500">{errors.clientId[0]}</p>}
            </div>

            {/* Type */}
            <div>
              <label className={labelClassName}>{i18n.processes.type} *</label>
              <select name="type" required className={fieldClassName}>
                <option value="receivable">{i18n.financial.receivable}</option>
                <option value="payable">{i18n.financial.payable}</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className={labelClassName}>Categoria</label>
              <select name="category" className={fieldClassName}>
                <option value="">Sem categoria</option>
                <option value="frete_aereo">Frete Aéreo</option>
                <option value="frete_maritimo_lcl">Frete Marítimo (LCL)</option>
                <option value="frete_maritimo_fcl">Frete Marítimo (FCL)</option>
                <option value="despachante">Despachante</option>
                <option value="impostos">Impostos</option>
                <option value="armazenagem">Armazenagem</option>
                <option value="seguro">Seguro</option>
                <option value="honorarios">Honorários</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            {/* Currency */}
            <div>
              <label className={labelClassName}>{i18n.processes.currency}</label>
              <select name="currency" defaultValue="BRL" className={fieldClassName}>
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Exchange Rate */}
            <div>
              <label className={labelClassName}>{i18n.financial.exchangeRate}</label>
              <input type="text" name="exchangeRate" className={fieldClassName} />
            </div>

            {/* Subtotal */}
            <div>
              <label className={labelClassName}>{i18n.financial.subtotal} *</label>
              <input type="text" name="subtotal" required className={fieldClassName} />
              {errors?.subtotal && <p className="mt-1 text-xs text-red-500">{errors.subtotal[0]}</p>}
            </div>

            {/* Taxes */}
            <div>
              <label className={labelClassName}>{i18n.financial.taxes}</label>
              <input type="text" name="taxes" defaultValue="0" className={fieldClassName} />
            </div>

            {/* Total */}
            <div>
              <label className={labelClassName}>{i18n.financial.total} *</label>
              <input type="text" name="total" required className={fieldClassName} />
              {errors?.total && <p className="mt-1 text-xs text-red-500">{errors.total[0]}</p>}
            </div>

            {/* Due Date */}
            <div>
              <label className={labelClassName}>{i18n.financial.dueDate} *</label>
              <input type="date" name="dueDate" required className={fieldClassName} />
              {errors?.dueDate && <p className="mt-1 text-xs text-red-500">{errors.dueDate[0]}</p>}
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className={labelClassName}>{i18n.processes.description}</label>
              <textarea name="description" rows={3} className={textareaClassName} />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className={labelClassName}>{i18n.crm.notes}</label>
              <textarea name="notes" rows={2} className={textareaClassName} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Link to="/financial">
              <Button type="button" variant="outline">{i18n.common.cancel}</Button>
            </Link>
            <Button type="submit">{i18n.common.save}</Button>
          </div>
        </OperationalPanel>
      </form>
    </div>
  );
}
