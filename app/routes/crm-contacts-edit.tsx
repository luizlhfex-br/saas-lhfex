import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/crm-contacts-edit";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { db } from "~/lib/db.server";
import { clients, contacts } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Save, User } from "lucide-react";
import { data } from "react-router";
import { and, eq, isNull } from "drizzle-orm";
import { logAudit } from "~/lib/audit.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : "pt-BR") as Locale;

  const [row] = await db
    .select({
      contact: contacts,
      client: {
        id: clients.id,
        razaoSocial: clients.razaoSocial,
        nomeFantasia: clients.nomeFantasia,
      },
    })
    .from(contacts)
    .innerJoin(clients, eq(contacts.clientId, clients.id))
    .where(
      and(
        eq(contacts.id, params.contactId),
        eq(clients.id, params.id),
        eq(clients.companyId, companyId),
        isNull(contacts.deletedAt),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    throw new Response("Contato nao encontrado", { status: 404 });
  }

  return { locale, client: row.client, contact: row.contact };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const role = (formData.get("role") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const whatsapp = (formData.get("whatsapp") as string)?.trim() || null;
  const linkedin = (formData.get("linkedin") as string)?.trim() || null;
  const isPrimary = formData.get("isPrimary") === "true";

  if (!name || name.length < 2) {
    return data({ error: "Nome deve ter pelo menos 2 caracteres" }, { status: 400 });
  }

  const [existingContact] = await db
    .select({ id: contacts.id, clientId: contacts.clientId })
    .from(contacts)
    .innerJoin(clients, eq(contacts.clientId, clients.id))
    .where(
      and(
        eq(contacts.id, params.contactId),
        eq(clients.id, params.id),
        eq(clients.companyId, companyId),
        isNull(contacts.deletedAt),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);

  if (!existingContact) {
    return data({ error: "Contato nao encontrado" }, { status: 404 });
  }

  await db
    .update(contacts)
    .set({
      name,
      role,
      email,
      phone,
      whatsapp,
      linkedin,
      isPrimary,
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, params.contactId), eq(contacts.clientId, existingContact.clientId)));

  await logAudit({
    userId: user.id,
    action: "update",
    entity: "contact",
    entityId: params.contactId,
    changes: { name, role, email, phone, whatsapp, linkedin, isPrimary },
    request,
  });

  throw redirect(`/crm/${existingContact.clientId}`);
}

export default function CrmContactsEditPage({ loaderData }: Route.ComponentProps) {
  const { locale, client, contact } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);
  const clientName = client.nomeFantasia || client.razaoSocial;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to={`/crm/${client.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Editar Contato</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{clientName}</p>
        </div>
      </div>

      <Form method="post" className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dados do Contato</h2>
          </div>

          {actionData?.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {actionData.error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.contactName} <span className="text-red-500">*</span>
              </label>
              <input type="text" name="name" required maxLength={200} defaultValue={contact.name} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.crm.role}</label>
              <input type="text" name="role" maxLength={200} defaultValue={contact.role ?? ""} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.crm.email}</label>
              <input type="email" name="email" maxLength={200} defaultValue={contact.email ?? ""} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.crm.phone}</label>
              <input type="tel" name="phone" maxLength={50} defaultValue={contact.phone ?? ""} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.crm.whatsapp}</label>
              <input type="tel" name="whatsapp" maxLength={50} defaultValue={contact.whatsapp ?? ""} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.crm.linkedin}</label>
              <input type="url" name="linkedin" maxLength={500} defaultValue={contact.linkedin ?? ""} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" name="isPrimary" value="true" defaultChecked={contact.isPrimary} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{i18n.crm.primaryContact}</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to={`/crm/${client.id}`}>
            <Button type="button" variant="outline">{i18n.common.cancel}</Button>
          </Link>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            {i18n.common.save}
          </Button>
        </div>
      </Form>
    </div>
  );
}
