import { useState } from "react";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/crm-new";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients, auditLogs } from "../../drizzle/schema";
import { clientSchema } from "~/lib/validators";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Save, Bot, Loader2 } from "lucide-react";
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  return { locale };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    raw[key] = value === "" ? undefined : value;
  }
  // Ensure required defaults
  if (!raw.clientType) raw.clientType = "importer";
  if (!raw.status) raw.status = "active";
  if (!raw.preferredCurrency) raw.preferredCurrency = "USD";

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

  const [newClient] = await db
    .insert(clients)
    .values({
      cnpj: values.cnpj,
      razaoSocial: values.razaoSocial,
      nomeFantasia: values.nomeFantasia || null,
      ramoAtividade: values.ramoAtividade || null,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      city: values.city || null,
      state: values.state || null,
      zipCode: values.zipCode || null,
      clientType: values.clientType,
      status: values.status,
      monthlyVolume: values.monthlyVolume || null,
      preferredCurrency: values.preferredCurrency,
      preferredIncoterm: values.preferredIncoterm || null,
      notes: values.notes || null,
      createdBy: user.id,
    })
    .returning({ id: clients.id });

  // Audit log
  await db.insert(auditLogs).values({
    userId: user.id,
    action: "create",
    entity: "client",
    entityId: newClient.id,
    changes: values,
    ipAddress: request.headers.get("x-forwarded-for") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  });

  throw redirect("/crm");
}

export default function CrmNewPage({ loaderData }: Route.ComponentProps) {
  const { locale } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);

  const errors = actionData?.errors || {};
  const fields = actionData?.fields || {};

  // State for AI enrichment
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchCnpjWithRetry = async (cnpj: string, attempts = 2) => {
    let lastError = "Erro ao consultar CNPJ.";

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetch(`/api/enrich-cnpj?cnpj=${encodeURIComponent(cnpj)}`);

        if (!response.ok) {
          let message = "Erro ao consultar CNPJ";
          try {
            const payload = await response.json();
            message = payload.error || message;
          } catch {
            // ignore parse error
          }

          const shouldRetry =
            attempt < attempts && (response.status === 429 || response.status >= 500);
          if (shouldRetry) {
            await wait(500 * attempt);
            continue;
          }

          throw new Error(message);
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Erro ao consultar CNPJ";

        if (attempt < attempts) {
          await wait(500 * attempt);
          continue;
        }

        throw new Error(lastError);
      }
    }

    throw new Error(lastError);
  };

  const handleEnrichCNPJ = async () => {
    const cnpjInput = document.querySelector<HTMLInputElement>('input[name="cnpj"]');
    const cnpj = cnpjInput?.value;
    if (!cnpj || cnpj.replace(/\D/g, "").length < 14) {
      setEnrichError("Digite um CNPJ válido com 14 dígitos para consultar.");
      return;
    }

    setEnrichError(null);
    setEnriching(true);
    try {
      const data = await fetchCnpjWithRetry(cnpj, 2);

      // Fill form fields
      const fillField = (name: string, value: string) => {
        const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
        if (input && value) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          nativeInputValueSetter?.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };

      fillField("razaoSocial", data.razaoSocial);
      fillField("nomeFantasia", data.nomeFantasia);
      fillField("address", data.address);
      fillField("city", data.city);
      fillField("state", data.state);
      fillField("zipCode", data.zipCode);
      fillField("ramoAtividade", data.ramoAtividade);
      fillField("phone", data.phone);
      fillField("email", data.email);

      setEnriched(true);
    } catch (error) {
      setEnriched(false);
      setEnrichError(
        error instanceof Error
          ? error.message
          : "Erro de conexão ao consultar CNPJ. Tente novamente."
      );
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/crm"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {i18n.crm.newClient}
          </h1>
        </div>
      </div>

      {/* Form */}
      <Form method="post" className="space-y-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Company info */}
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Dados da Empresa
          </h2>

          {/* CNPJ + AI Enrich button */}
          <div className="mb-4 flex items-end gap-2">
            <div className="flex-1">
              <InputField
                label={i18n.crm.cnpj}
                name="cnpj"
                required
                placeholder="00.000.000/0000-00"
                error={errors.cnpj}
                defaultValue={fields.cnpj}
              />
            </div>
            <Button
              type="button"
              onClick={handleEnrichCNPJ}
              disabled={enriching}
              variant={enriched ? "outline" : "default"}
              className="shrink-0"
            >
              {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {enriched ? "Preenchido!" : "Preencher com IA"}
            </Button>
          </div>
          {enriched && (
            <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
              ✅ Dados preenchidos automaticamente via consulta CNPJ. Todos os campos são editáveis.
            </div>
          )}
          {enrichError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              {enrichError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField
              label={i18n.crm.razaoSocial}
              name="razaoSocial"
              required
              error={errors.razaoSocial}
              defaultValue={fields.razaoSocial}
            />
            <InputField
              label={i18n.crm.nomeFantasia}
              name="nomeFantasia"
              error={errors.nomeFantasia}
              defaultValue={fields.nomeFantasia}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.crm.clientType}
              </label>
              <select
                name="clientType"
                defaultValue={fields.clientType || "importer"}
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
                defaultValue={fields.status || "active"}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="active">{i18n.common.active}</option>
                <option value="inactive">{i18n.common.inactive}</option>
                <option value="prospect">{i18n.crm.prospect}</option>
              </select>
            </div>
            <InputField
              label={i18n.crm.ramoAtividade}
              name="ramoAtividade"
              error={errors.ramoAtividade}
              defaultValue={fields.ramoAtividade}
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Contact info */}
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Contato e Endereco
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField
              label={i18n.crm.email}
              name="email"
              type="email"
              error={errors.email}
              defaultValue={fields.email}
            />
            <InputField
              label={i18n.crm.phone}
              name="phone"
              type="tel"
              error={errors.phone}
              defaultValue={fields.phone}
            />
            <InputField
              label={i18n.crm.address}
              name="address"
              error={errors.address}
              defaultValue={fields.address}
              className="sm:col-span-2 lg:col-span-1"
            />
            <InputField
              label={i18n.crm.city}
              name="city"
              error={errors.city}
              defaultValue={fields.city}
            />
            <InputField
              label={i18n.crm.state}
              name="state"
              maxLength={2}
              placeholder="SP"
              error={errors.state}
              defaultValue={fields.state}
            />
            <InputField
              label={i18n.crm.zipCode}
              name="zipCode"
              placeholder="00000-000"
              error={errors.zipCode}
              defaultValue={fields.zipCode}
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Trade info */}
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Informacoes Comerciais
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField
              label={i18n.crm.monthlyVolume}
              name="monthlyVolume"
              placeholder="Ex: USD 50.000"
              error={errors.monthlyVolume}
              defaultValue={fields.monthlyVolume}
            />
            <InputField
              label={i18n.crm.preferredCurrency}
              name="preferredCurrency"
              maxLength={3}
              placeholder="USD"
              error={errors.preferredCurrency}
              defaultValue={fields.preferredCurrency || "USD"}
            />
            <InputField
              label={i18n.crm.preferredIncoterm}
              name="preferredIncoterm"
              placeholder="FOB, CIF, etc."
              error={errors.preferredIncoterm}
              defaultValue={fields.preferredIncoterm}
            />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {i18n.crm.notes}
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={fields.notes}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link to="/crm">
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
  label,
  name,
  type = "text",
  required,
  placeholder,
  maxLength,
  error,
  defaultValue,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  error?: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue}
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
