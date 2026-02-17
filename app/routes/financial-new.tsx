import { redirect } from "react-router";
import type { Route } from "./+types/financial-new";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { invoices, clients } from "drizzle/schema";
import { isNull, sql } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { invoiceSchema } from "~/lib/validators";
import { logAudit } from "~/lib/audit.server";
import { Button } from "~/components/ui/button";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const clientList = await db
    .select({ id: clients.id, razaoSocial: clients.razaoSocial })
    .from(clients)
    .where(isNull(clients.deletedAt));

  return { locale, clients: clientList, userId: user.id };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
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
    .from(invoices);
  const seq = (countResult[0].count + 1).toString().padStart(4, "0");
  const number = `FAT-${year}-${seq}`;

  await db.insert(invoices).values({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/financial" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.financial.newInvoice}</h1>
      </div>

      <form method="post" className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Client */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.client} *</label>
              <select name="clientId" required className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="">Selecionar...</option>
                {clientList.map((c) => (
                  <option key={c.id} value={c.id}>{c.razaoSocial}</option>
                ))}
              </select>
              {errors?.clientId && <p className="mt-1 text-xs text-red-500">{errors.clientId[0]}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.type} *</label>
              <select name="type" required className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="receivable">{i18n.financial.receivable}</option>
                <option value="payable">{i18n.financial.payable}</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
              <select name="category" className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.currency}</label>
              <select name="currency" defaultValue="BRL" className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Exchange Rate */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.financial.exchangeRate}</label>
              <input type="text" name="exchangeRate" className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            {/* Subtotal */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.financial.subtotal} *</label>
              <input type="text" name="subtotal" required className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              {errors?.subtotal && <p className="mt-1 text-xs text-red-500">{errors.subtotal[0]}</p>}
            </div>

            {/* Taxes */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.financial.taxes}</label>
              <input type="text" name="taxes" defaultValue="0" className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            {/* Total */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.financial.total} *</label>
              <input type="text" name="total" required className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              {errors?.total && <p className="mt-1 text-xs text-red-500">{errors.total[0]}</p>}
            </div>

            {/* Due Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.financial.dueDate} *</label>
              <input type="date" name="dueDate" required className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              {errors?.dueDate && <p className="mt-1 text-xs text-red-500">{errors.dueDate[0]}</p>}
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.description}</label>
              <textarea name="description" rows={3} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.crm.notes}</label>
              <textarea name="notes" rows={2} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Link to="/financial">
              <Button type="button" variant="outline">{i18n.common.cancel}</Button>
            </Link>
            <Button type="submit">{i18n.common.save}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
