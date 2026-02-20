import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/crm-edit";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients, auditLogs } from "../../drizzle/schema";
import { clientSchema } from "~/lib/validators";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { data } from "react-router";
import { eq, and, isNull } from "drizzle-orm";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, params.id), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new Response("Not found", { status: 404 });
  }

  return { locale, client };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    raw[key] = value === "" ? undefined : value;
  }
  if (!raw.clientType) raw.clientType = "importer";
  if (!raw.status) raw.status = "active";

  const result = clientSchema.safeParse(raw);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      errors[path] = issue.message;
    }
    return data({ errors, fields: raw as Record<string, string> }, { status: 400 });
  }

  const values = result.data;

  await db
    .update(clients)
    .set({
      cnpj: values.cnpj,
      razaoSocial: values.razaoSocial,
      nomeFantasia: values.nomeFantasia || null,
      cnaeCode: values.cnaeCode || null,
      cnaeDescription: values.cnaeDescription || null,
      address: values.address || null,
      city: values.city || null,
      state: values.state || null,
      zipCode: values.zipCode || null,
      clientType: values.clientType,
      status: values.status,
      notes: values.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, params.id));

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "update",
    entity: "client",
    entityId: params.id,
    changes: values,
    ipAddress: request.headers.get("x-forwarded-for") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  });

  throw redirect(`/crm/${params.id}`);
}

export default function CrmEditPage({ loaderData }: Route.ComponentProps) {
  const { locale, client } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);

  const errors = actionData?.errors || {};
  const fields = actionData?.fields || {};

  const val = (name: string) => fields[name] ?? (client as Record<string, unknown>)[name] ?? "";

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {i18n.crm.editClient}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{client.razaoSocial}</p>
        </div>
      </div>

      <Form method="post" className="space-y-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Dados da Empresa
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField label={i18n.crm.razaoSocial} name="razaoSocial" required error={errors.razaoSocial} defaultValue={val("razaoSocial") as string} />
            <InputField label={i18n.crm.nomeFantasia} name="nomeFantasia" error={errors.nomeFantasia} defaultValue={val("nomeFantasia") as string} />
            <InputField label={i18n.crm.cnpj} name="cnpj" required placeholder="00.000.000/0000-00" error={errors.cnpj} defaultValue={val("cnpj") as string} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.clientType}
              </label>
              <select
                name="clientType"
                defaultValue={val("clientType") as string}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="importer">{i18n.crm.importer}</option>
                <option value="exporter">{i18n.crm.exporter}</option>
                <option value="both">{i18n.crm.both}</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.common.status}
              </label>
              <select
                name="status"
                defaultValue={val("status") as string}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="active">{i18n.common.active}</option>
                <option value="inactive">{i18n.common.inactive}</option>
                <option value="prospect">{i18n.crm.prospect}</option>
              </select>
            </div>
            <InputField label={i18n.crm.cnaeCode} name="cnaeCode" placeholder="Ex: 4713100" error={errors.cnaeCode} defaultValue={val("cnaeCode") as string} />
            <InputField label={i18n.crm.cnaeDescription} name="cnaeDescription" error={errors.cnaeDescription} defaultValue={val("cnaeDescription") as string} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Endereco
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField label={i18n.crm.address} name="address" error={errors.address} defaultValue={val("address") as string} />
            <InputField label={i18n.crm.city} name="city" error={errors.city} defaultValue={val("city") as string} />
            <InputField label={i18n.crm.state} name="state" maxLength={2} placeholder="SP" error={errors.state} defaultValue={val("state") as string} />
            <InputField label={i18n.crm.zipCode} name="zipCode" placeholder="00000-000" error={errors.zipCode} defaultValue={val("zipCode") as string} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Observacoes
          </h2>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {i18n.crm.notes}
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={val("notes") as string}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to={`/crm/${client.id}`}>
            <Button type="button" variant="outline">
              {i18n.common.cancel}
            </Button>
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

function InputField({
  label, name, type = "text", required, placeholder, maxLength, error, defaultValue, className,
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string;
  maxLength?: number; error?: string; defaultValue?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type={type} name={name} required={required} placeholder={placeholder}
        maxLength={maxLength} defaultValue={defaultValue}
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
