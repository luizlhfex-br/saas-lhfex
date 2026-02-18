import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/crm-contacts-new";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients, contacts } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Save, User } from "lucide-react";
import { data } from "react-router";
import { eq, isNull } from "drizzle-orm";
import { logAudit } from "~/lib/audit.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : "pt-BR") as Locale;

  const [client] = await db
    .select({ id: clients.id, razaoSocial: clients.razaoSocial, nomeFantasia: clients.nomeFantasia })
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) throw new Response("Cliente não encontrado", { status: 404 });

  return { locale, client };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
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

  const [newContact] = await db.insert(contacts).values({
    clientId: params.id,
    name,
    role,
    email,
    phone,
    whatsapp,
    linkedin,
    isPrimary,
  }).returning({ id: contacts.id });

  await logAudit({
    userId: user.id,
    action: "create",
    entity: "contact",
    entityId: newContact.id,
    changes: { name, role, email, clientId: params.id },
    request,
  });

  throw redirect(`/crm/${params.id}`);
}

export default function CrmContactsNewPage({ loaderData }: Route.ComponentProps) {
  const { locale, client } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);
  const clientName = client.nomeFantasia || client.razaoSocial;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={`/crm/${client.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {i18n.crm.newContact}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{clientName}</p>
        </div>
      </div>

      <Form method="post" className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Dados do Contato
            </h2>
          </div>

          {actionData?.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {actionData.error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nome */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.contactName} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                maxLength={200}
                placeholder="Nome completo"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* Cargo */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.role}
              </label>
              <input
                type="text"
                name="role"
                maxLength={200}
                placeholder="Gerente de Compras, CEO..."
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.email}
              </label>
              <input
                type="email"
                name="email"
                maxLength={200}
                placeholder="contato@empresa.com"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* Telefone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.phone}
              </label>
              <input
                type="tel"
                name="phone"
                maxLength={50}
                placeholder="+55 31 99999-9999"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.whatsapp}
              </label>
              <input
                type="tel"
                name="whatsapp"
                maxLength={50}
                placeholder="+55 31 99999-9999"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* LinkedIn */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.linkedin}
              </label>
              <input
                type="url"
                name="linkedin"
                maxLength={500}
                placeholder="https://linkedin.com/in/..."
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {/* Contato Principal */}
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="isPrimary"
                  value="true"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {i18n.crm.primaryContact}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Marcar este contato como o principal do cliente
                  </p>
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
