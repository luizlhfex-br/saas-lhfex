import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/crm-edit";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { db } from "~/lib/db.server";
import { clients, contacts, auditLogs } from "../../drizzle/schema";
import { clientSchema } from "~/lib/validators";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { OperationalHero, OperationalPanel, OperationalStat } from "~/components/ui/operational-page";
import { ArrowLeft, Bot, Building2, FileText, Loader2, MapPin, Save } from "lucide-react";
import { data } from "react-router";
import { eq, and, isNull } from "drizzle-orm";
import { syncClientEmbedding } from "~/lib/embedding-sync.server";
import { enrichClientById } from "~/lib/client-enrichment.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, params.id), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  return {
    locale,
    client,
    enriched: url.searchParams.get("enriched") === "1",
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");

  if (intent === "enrich_cnpj") {
    try {
      await enrichClientById({
        clientId: params.id,
        companyId,
        userId: user.id,
        overwriteExisting: true,
        requestMeta: {
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      });
      throw redirect(`/crm/${params.id}/edit?enriched=1`);
    } catch (error) {
      return data(
        {
          enrichError: error instanceof Error ? error.message : "Nao foi possivel enriquecer este CNPJ agora.",
        },
        { status: 400 },
      );
    }
  }

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    raw[key] = value === "" ? undefined : value;
  }
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

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, params.id), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new Response("Not found", { status: 404 });
  }

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
      clientType: "importer",
      status: values.status,
      notes: values.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, params.id), eq(clients.companyId, companyId)));

  const contactRows = await db
    .select({
      name: contacts.name,
      role: contacts.role,
      email: contacts.email,
      phone: contacts.phone,
      isPrimary: contacts.isPrimary,
    })
    .from(contacts)
    .where(and(eq(contacts.clientId, params.id), isNull(contacts.deletedAt)));

  try {
    await syncClientEmbedding({
      companyId,
      userId: user.id,
      clientId: params.id,
      razaoSocial: values.razaoSocial,
      nomeFantasia: values.nomeFantasia || null,
      cnpj: values.cnpj,
      cnaeCode: values.cnaeCode || null,
      cnaeDescription: values.cnaeDescription || null,
      address: values.address || null,
      city: values.city || null,
      state: values.state || null,
      status: values.status,
      notes: values.notes || null,
      contacts: contactRows,
    });
  } catch (error) {
    console.error("[EMBEDDINGS] Failed to reindex client:", error);
  }

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
  const { locale, client, enriched } = loaderData;
  const actionData = (useActionData<typeof action>() ?? {}) as {
    errors?: Record<string, string>;
    fields?: Record<string, string>;
    enrichError?: string;
  };
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const isEnriching = isSubmitting && navigation.formData?.get("intent") === "enrich_cnpj";
  const isSaving = isSubmitting && navigation.formData?.get("intent") !== "enrich_cnpj";
  const i18n = t(locale);

  const errors = actionData.errors || {};
  const fields = actionData.fields || {};
  const enrichError = actionData.enrichError;

  const val = (name: string) => fields[name] ?? (client as Record<string, unknown>)[name] ?? "";

  return (
    <div className="space-y-6">
      <OperationalHero
        eyebrow="CRM"
        title={i18n.crm.editClient}
        description="Ajuste a leitura comercial, classificacao e base operacional do cliente sem sair do fluxo principal."
        actions={
          <>
            <Link
              to={`/crm/${client.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao cliente
            </Link>
            <Form method="post">
              <input type="hidden" name="intent" value="enrich_cnpj" />
              <Button type="submit" variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/10" loading={isEnriching}>
                {isEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                Enriquecer com IA
              </Button>
            </Form>
            <Button type="submit" form="crm-edit-form" loading={isSaving}>
              <Save className="h-4 w-4" />
              {i18n.common.save}
            </Button>
          </>
        }
        aside={
          <>
            <OperationalStat
              label={i18n.crm.cnpj}
              value={String(val("cnpj") || "Pendente")}
              description="Documento principal do cadastro."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Razao"
              value={String(val("razaoSocial") || "Pendente")}
              description="Nome juridico ativo na carteira."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Cidade / UF"
              value={[val("city"), val("state")].filter(Boolean).join(" / ") || "Nao informado"}
              description="Base geografica do cliente."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label={i18n.common.status}
              value={String(val("status") || "active")}
              description="Status comercial em uso."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
          </>
        }
      />

      {enriched ? (
        <div className="rounded-[22px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
          Dados cadastrais atualizados pelo enriquecimento de CNPJ.
        </div>
      ) : null}
      {enrichError ? (
        <div className="rounded-[22px] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {enrichError}
        </div>
      ) : null}

      <Form id="crm-edit-form" method="post" className="space-y-8">
        <input type="hidden" name="intent" value="save" />
        <OperationalPanel
          title="Dados da empresa"
          icon={<Building2 className="h-5 w-5" />}
          description="Nome, documento, status e identificadores principais."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField label={i18n.crm.razaoSocial} name="razaoSocial" required error={errors.razaoSocial} defaultValue={val("razaoSocial") as string} />
            <InputField label={i18n.crm.nomeFantasia} name="nomeFantasia" error={errors.nomeFantasia} defaultValue={val("nomeFantasia") as string} />
            <InputField label={i18n.crm.cnpj} name="cnpj" required placeholder="00.000.000/0000-00" error={errors.cnpj} defaultValue={val("cnpj") as string} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--app-text)]">
                {i18n.common.status}
              </label>
              <select
                name="status"
                defaultValue={val("status") as string}
                className="block h-12 w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm text-[var(--app-text)] outline-none transition focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10"
              >
                <option value="active">{i18n.common.active}</option>
                <option value="inactive">{i18n.common.inactive}</option>
                <option value="prospect">{i18n.crm.prospect}</option>
              </select>
            </div>
            <InputField label={i18n.crm.cnaeCode} name="cnaeCode" placeholder="Ex: 4713100" error={errors.cnaeCode} defaultValue={val("cnaeCode") as string} />
            <InputField label={i18n.crm.cnaeDescription} name="cnaeDescription" error={errors.cnaeDescription} defaultValue={val("cnaeDescription") as string} />
          </div>
        </OperationalPanel>

        <OperationalPanel
          title="Endereco"
          icon={<MapPin className="h-5 w-5" />}
          description="Base geografica e dados de localizacao do cliente."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField label={i18n.crm.address} name="address" error={errors.address} defaultValue={val("address") as string} />
            <InputField label={i18n.crm.city} name="city" error={errors.city} defaultValue={val("city") as string} />
            <InputField label={i18n.crm.state} name="state" maxLength={2} placeholder="SP" error={errors.state} defaultValue={val("state") as string} />
            <InputField label={i18n.crm.zipCode} name="zipCode" placeholder="00000-000" error={errors.zipCode} defaultValue={val("zipCode") as string} />
          </div>
        </OperationalPanel>

        <OperationalPanel
          title="Contexto adicional"
          icon={<FileText className="h-5 w-5" />}
          description="Notas livres para operacao, fiscal e relacionamento."
        >
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-[var(--app-text)]">
              {i18n.crm.notes}
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={val("notes") as string}
              className="block w-full rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10"
            />
          </div>
        </OperationalPanel>

        <div className="flex items-center justify-end gap-3">
          <Link to={`/crm/${client.id}`}>
            <Button type="button" variant="outline">
              {i18n.common.cancel}
            </Button>
          </Link>
          <Button type="submit" loading={isSaving}>
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
      <label className="mb-1.5 block text-sm font-medium text-[var(--app-text)]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type={type} name={name} required={required} placeholder={placeholder}
        maxLength={maxLength} defaultValue={defaultValue}
        className="block h-12 w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
