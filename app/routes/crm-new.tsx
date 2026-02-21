import { useState } from "react";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/crm-new";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { auditLogs, clients, contacts } from "../../drizzle/schema";
import { clientSchema } from "~/lib/validators";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Bot, Loader2, Plus, Save, Star, Trash2 } from "lucide-react";
import { and, eq, isNull } from "drizzle-orm";
import { data } from "react-router";
import { fireTrigger } from "~/lib/automation-engine.server";

type ContactDraft = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

const emptyContact = (): ContactDraft => ({
  id: crypto.randomUUID(),
  name: "",
  role: "",
  email: "",
  phone: "",
  isPrimary: false,
});

function sanitizeContacts(rawContacts: unknown): ContactDraft[] {
  if (!Array.isArray(rawContacts)) return [];
  return rawContacts
    .map((raw) => {
      const contact = raw as Partial<ContactDraft>;
      return {
        id: typeof contact.id === "string" ? contact.id : crypto.randomUUID(),
        name: (contact.name || "").trim(),
        role: (contact.role || "").trim(),
        email: (contact.email || "").trim(),
        phone: (contact.phone || "").trim(),
        isPrimary: !!contact.isPrimary,
      };
    })
    .filter((contact) => contact.name.length > 0 || contact.email.length > 0 || contact.phone.length > 0);
}

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

  if (!raw.clientType) raw.clientType = "importer";
  if (!raw.status) raw.status = "active";

  const parsedContacts = (() => {
    const payload = formData.get("contactsPayload");
    if (typeof payload !== "string" || payload.trim().length === 0) return [];
    try {
      return sanitizeContacts(JSON.parse(payload));
    } catch {
      return [];
    }
  })();

  const result = clientSchema.safeParse(raw);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      errors[path] = issue.message;
    }
    return data({ errors, fields: raw as Record<string, string>, contacts: parsedContacts }, { status: 400 });
  }

  const values = result.data;
  const cleanCnpj = values.cnpj.replace(/\D/g, "");

  if (parsedContacts.length === 0) {
    return data(
      {
        errors: { contacts: "Adicione pelo menos 1 contato." },
        fields: raw as Record<string, string>,
        contacts: parsedContacts,
      },
      { status: 400 }
    );
  }

  for (const contact of parsedContacts) {
    if (!contact.name) {
      return data(
        {
          errors: { contacts: "Todo contato precisa ter nome." },
          fields: raw as Record<string, string>,
          contacts: parsedContacts,
        },
        { status: 400 }
      );
    }
    if (!contact.phone && !contact.email) {
      return data(
        {
          errors: { contacts: "Cada contato precisa ter telefone ou email." },
          fields: raw as Record<string, string>,
          contacts: parsedContacts,
        },
        { status: 400 }
      );
    }
  }

  const primaryCount = parsedContacts.filter((contact) => contact.isPrimary).length;
  if (primaryCount > 1) {
    return data(
      {
        errors: { contacts: "Marque apenas 1 contato como primário." },
        fields: raw as Record<string, string>,
        contacts: parsedContacts,
      },
      { status: 400 }
    );
  }

  const [existingClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.cnpj, cleanCnpj), isNull(clients.deletedAt)))
    .limit(1);

  if (existingClient) {
    return data(
      {
        errors: { cnpj: "Já existe um cliente com este CNPJ." },
        fields: raw as Record<string, string>,
        contacts: parsedContacts,
      },
      { status: 400 }
    );
  }

  const [newClient] = await db
    .insert(clients)
    .values({
      cnpj: cleanCnpj,
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
      createdBy: user.id,
    })
    .returning({ id: clients.id });

  const contactsToInsert = parsedContacts.map((contact, index) => ({
    clientId: newClient.id,
    name: contact.name,
    role: contact.role || null,
    email: contact.email || null,
    phone: contact.phone || null,
    isPrimary: primaryCount === 0 ? index === 0 : contact.isPrimary,
  }));

  await db.insert(contacts).values(contactsToInsert);

  try {
    await fireTrigger({
      type: "new_client",
      userId: user.id,
      data: {
        clientId: newClient.id,
        razaoSocial: values.razaoSocial,
        nomeFantasia: values.nomeFantasia || "",
        cnpj: cleanCnpj,
        primaryContactName: contactsToInsert[0]?.name || "",
        primaryContactEmail: contactsToInsert[0]?.email || "",
      },
    });
  } catch (error) {
    console.error("[AUTOMATION] Failed to fire new_client trigger:", error);
  }

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "create",
    entity: "client",
    entityId: newClient.id,
    changes: {
      ...values,
      contacts: contactsToInsert.map((contact) => ({
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        isPrimary: contact.isPrimary,
      })),
    },
    ipAddress: request.headers.get("x-forwarded-for") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  });

  throw redirect(`/crm/${newClient.id}`);
}

export default function CrmNewPage({ loaderData }: Route.ComponentProps) {
  const { locale } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);

  const actionPayload = (actionData ?? {}) as {
    errors?: Record<string, string>;
    fields?: Record<string, string>;
    contacts?: ContactDraft[];
  };
  const errors: Record<string, string> = actionPayload.errors || {};
  const fields: Record<string, string> = actionPayload.fields || {};

  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [contactsDraft, setContactsDraft] = useState<ContactDraft[]>(
    actionPayload.contacts && actionPayload.contacts.length > 0
      ? actionPayload.contacts
      : [{ ...emptyContact(), isPrimary: true }]
  );

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
          }

          const shouldRetry = attempt < attempts && (response.status === 429 || response.status >= 500);
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

  const fillField = (name: string, value: string) => {
    const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
    if (input && value) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
      descriptor?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
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
      const response = await fetchCnpjWithRetry(cnpj, 2);

      fillField("razaoSocial", response.razaoSocial || "");
      fillField("nomeFantasia", response.nomeFantasia || "");
      fillField("cnaeCode", response.cnaeCode || "");
      fillField("cnaeDescription", response.cnaeDescription || "");
      fillField("address", response.address || "");
      fillField("city", response.city || "");
      fillField("state", response.state || "");
      fillField("zipCode", response.zipCode || "");

      setEnriched(true);
    } catch (error) {
      setEnriched(false);
      setEnrichError(error instanceof Error ? error.message : "Erro de conexão ao consultar CNPJ. Tente novamente.");
    } finally {
      setEnriching(false);
    }
  };

  const updateContact = (id: string, field: keyof ContactDraft, value: string | boolean) => {
    setContactsDraft((prev) =>
      prev.map((contact) => {
        if (contact.id !== id) return contact;
        if (field === "isPrimary") return { ...contact, isPrimary: value as boolean };
        return { ...contact, [field]: value as string };
      })
    );
  };

  const markPrimary = (id: string) => {
    setContactsDraft((prev) => prev.map((contact) => ({ ...contact, isPrimary: contact.id === id })));
  };

  const addContact = () => setContactsDraft((prev) => [...prev, emptyContact()]);

  const removeContact = (id: string) => {
    setContactsDraft((prev) => {
      const next = prev.filter((contact) => contact.id !== id);
      if (next.length === 0) return [{ ...emptyContact(), isPrimary: true }];
      if (!next.some((contact) => contact.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/crm"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.crm.newClient}</h1>
        </div>
      </div>

      <Form method="post" className="space-y-8">
        <input type="hidden" name="contactsPayload" value={JSON.stringify(contactsDraft)} />

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Identificação da Empresa</h2>

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
            <Button type="button" onClick={handleEnrichCNPJ} disabled={enriching} variant={enriched ? "outline" : "default"}>
              {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {enriched ? "Consultado" : "Consultar CNPJ"}
            </Button>
          </div>

          {enriched && (
            <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
              ✅ Dados preenchidos pela consulta de CNPJ. Você pode editar antes de salvar.
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
            <InputField label={i18n.crm.nomeFantasia} name="nomeFantasia" error={errors.nomeFantasia} defaultValue={fields.nomeFantasia} />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.crm.clientType}</label>
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.common.status}</label>
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
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">CNAE Principal</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              label={i18n.crm.cnaeCode}
              name="cnaeCode"
              placeholder="0000000"
              maxLength={7}
              error={errors.cnaeCode}
              defaultValue={fields.cnaeCode}
            />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.crm.cnaeDescription}</label>
              <textarea
                name="cnaeDescription"
                rows={2}
                defaultValue={fields.cnaeDescription}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Endereço</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InputField label={i18n.crm.address} name="address" error={errors.address} defaultValue={fields.address} className="lg:col-span-2" />
            <InputField label={i18n.crm.city} name="city" error={errors.city} defaultValue={fields.city} />
            <InputField label={i18n.crm.state} name="state" maxLength={2} placeholder="SP" error={errors.state} defaultValue={fields.state} />
            <InputField label={i18n.crm.zipCode} name="zipCode" placeholder="00000-000" error={errors.zipCode} defaultValue={fields.zipCode} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{i18n.crm.contacts}</h2>
            <Button type="button" variant="outline" onClick={addContact}>
              <Plus className="h-4 w-4" />
              {i18n.crm.addContact}
            </Button>
          </div>

          {errors.contacts && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              {errors.contacts}
            </div>
          )}

          <div className="space-y-4">
            {contactsDraft.map((contact, index) => (
              <div key={contact.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Contato {index + 1}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => markPrimary(contact.id)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                        contact.isPrimary
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      <Star className="h-3 w-3" />
                      {i18n.crm.primaryContact}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeContact(contact.id)}
                      className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder={i18n.crm.contactName}
                    value={contact.name}
                    onChange={(event) => updateContact(contact.id, "name", event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    placeholder={i18n.crm.role}
                    value={contact.role}
                    onChange={(event) => updateContact(contact.id, "role", event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <input
                    type="email"
                    placeholder={i18n.crm.email}
                    value={contact.email}
                    onChange={(event) => updateContact(contact.id, "email", event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <input
                    type="tel"
                    placeholder={i18n.crm.phone}
                    value={contact.phone}
                    onChange={(event) => updateContact(contact.id, "phone", event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{i18n.crm.notes}</h2>
          <textarea
            name="notes"
            rows={3}
            defaultValue={fields.notes}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/crm">
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
