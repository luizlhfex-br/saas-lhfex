import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/processes-new";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, processTimeline, auditLogs, clients } from "../../drizzle/schema";
import { processSchema } from "~/lib/validators";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { OperationalHero, OperationalStat } from "~/components/ui/operational-page";
import { ArrowLeft, Save } from "lucide-react";
import { data } from "react-router";
import { and, isNull, eq, sql } from "drizzle-orm";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { getCSRFFormState, requireValidCSRF } from "~/lib/csrf.server";
import { syncProcessEmbedding } from "~/lib/embedding-sync.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const { csrfToken, csrfCookieHeader } = await getCSRFFormState(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const clientList = await db
    .select({ id: clients.id, razaoSocial: clients.razaoSocial, nomeFantasia: clients.nomeFantasia })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(clients.razaoSocial);

  return data(
    { locale, clients: clientList, csrfToken },
    {
      headers: {
        "Set-Cookie": csrfCookieHeader,
      },
    }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  try {
    await requireValidCSRF(request, formData);
  } catch {
    return data({ error: "Sessao do formulario expirou. Atualize a pagina e tente novamente." }, { status: 403 });
  }

  const normalizeNumericInput = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;
    return String(parsed);
  };

  const normalizeIntegerInput = (raw: unknown): number | null => {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    raw[key] = value === "" ? undefined : value;
  }
  if (!raw.processType) raw.processType = "import";

  const result = processSchema.safeParse(raw);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      errors[issue.path.join(".")] = issue.message;
    }
    return data({ errors, fields: raw as Record<string, string> }, { status: 400 });
  }

  try {
    const values = result.data;
    const companyId = await getPrimaryCompanyId(user.id);
    const modalReference = (formData.get("referenceModal") as string | null) ?? "sea";
    const modalPrefixMap: Record<string, string> = {
      air: "A",
      sea: "M",
      other: "C",
    };
    const modalPrefix = modalPrefixMap[modalReference] ?? "C";
    const yearShort = String(new Date().getFullYear()).slice(-2);

    // Sequência independente por modal: A26-001, M26-001, C26-001
    // Filtra processos do mesmo prefixo (ex: 'A') e ano (ex: '26')
    const prefixPattern = `${modalPrefix}${yearShort}%`;
    const sequenceResult = await db.execute(sql`
      SELECT COALESCE(
        MAX(
          CASE
            WHEN reference ~ ${`^${modalPrefix}${yearShort}-[0-9]+$`}
              THEN substring(reference from '-([0-9]+)$')::int
            ELSE 0
          END
        ),
        0
      ) AS last_seq
      FROM processes
      WHERE reference LIKE ${prefixPattern}
    `);
    const nextSequence = Number(sequenceResult[0]?.last_seq || 0) + 1;
    const reference = `${modalPrefix}${yearShort}-${String(nextSequence).padStart(3, "0")}`;

    const initialStatus = "draft";
    const costControlEnabled = formData.get("costControlEnabled") === "true";

    const totalValue = normalizeNumericInput(values.totalValue);
    const totalWeight = normalizeNumericInput(values.totalWeight);
    const estimatedCost = normalizeNumericInput(values.estimatedCost);
    const actualCost = normalizeNumericInput(values.actualCost);
    const containerCount = normalizeIntegerInput(values.containerCount);
    const [selectedClient] = await db
      .select({ id: clients.id, razaoSocial: clients.razaoSocial })
      .from(clients)
      .where(and(eq(clients.id, values.clientId), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .limit(1);

    if (!selectedClient) {
      return data({ errors: { clientId: "Cliente nao encontrado para sua empresa." }, fields: raw as Record<string, string> }, { status: 400 });
    }

    const [newProcess] = await db.insert(processes).values({
      companyId,
      reference,
      processType: values.processType,
      status: initialStatus,
      requiresApproval: false,
      clientId: values.clientId,
      description: values.description || null,
      hsCode: values.hsCode || null,
      hsDescription: values.hsDescription || null,
      incoterm: values.incoterm || null,
      originCountry: values.originCountry || null,
      destinationCountry: values.destinationCountry || "Brasil",
      currency: values.currency || "USD",
      totalValue,
      totalWeight,
      containerCount,
      containerType: values.containerType || null,
      vessel: values.vessel || null,
      bl: values.bl || null,
      etd: values.etd ? new Date(values.etd) : null,
      eta: values.eta ? new Date(values.eta) : null,
      portOfOrigin: values.portOfOrigin || null,
      portOfDestination: values.portOfDestination || null,
      customsBroker: values.customsBroker || null,
      diNumber: values.diNumber || null,
      googleDriveUrl: values.googleDriveUrl || null,
      costControlEnabled,
      estimatedCost: costControlEnabled ? estimatedCost : null,
      actualCost: costControlEnabled ? actualCost : null,
      costNotes: costControlEnabled ? values.costNotes || null : null,
      notes: values.notes || null,
      createdBy: user.id,
    }).returning({ id: processes.id });

    try {
      await syncProcessEmbedding({
        companyId,
        userId: user.id,
        processId: newProcess.id,
        reference,
        clientName: selectedClient.razaoSocial,
        processType: values.processType,
        status: initialStatus,
        description: values.description || null,
        hsCode: values.hsCode || null,
        incoterm: values.incoterm || null,
        originCountry: values.originCountry || null,
        destinationCountry: values.destinationCountry || "Brasil",
        portOfOrigin: values.portOfOrigin || null,
        portOfDestination: values.portOfDestination || null,
        vessel: values.vessel || null,
        bl: values.bl || null,
        customsBroker: values.customsBroker || null,
        currency: values.currency || "USD",
        totalValue,
        totalWeight,
        containerCount,
        containerType: values.containerType || null,
        costNotes: costControlEnabled ? values.costNotes || null : null,
        notes: values.notes || null,
      });
    } catch (error) {
      console.error("[EMBEDDINGS] Failed to index new process:", error);
    }

    await db.insert(processTimeline).values({
      processId: newProcess.id,
      status: initialStatus,
      title: "Processo criado",
      description: `Referência: ${reference}`,
      createdBy: user.id,
    });

    await db.insert(auditLogs).values({
      userId: user.id, action: "create", entity: "process", entityId: newProcess.id,
      changes: { reference, ...values },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return redirect(`/processes/${newProcess.id}`);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("[processes-new.action] failed to create process", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return data(
      { error: `Não foi possível salvar o processo: ${msg}`, fields: raw as Record<string, string> },
      { status: 500 }
    );
  }
}

export default function ProcessesNewPage({ loaderData }: Route.ComponentProps) {
  const { locale, clients: clientList, csrfToken } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);
  const errors = actionData && "errors" in actionData ? actionData.errors : {};
  const fields = actionData && "fields" in actionData ? actionData.fields : {};
  const genericError = actionData && "error" in actionData ? actionData.error : null;

  return (
    <div className="space-y-6">
      <OperationalHero
        eyebrow="Processos"
        title={i18n.processes.newProcess}
        description="Abertura guiada de embarque com referencia por modal, cliente, logistica, datas, custos e pasta do Drive."
        actions={
          <>
            <Link
              to="/processes"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para processos
            </Link>
            <Button type="submit" form="process-new-form" loading={isSubmitting}>
              <Save className="h-4 w-4" />
              {i18n.common.save}
            </Button>
          </>
        }
        aside={
          <>
            <OperationalStat
              label="Cliente"
              value={fields.clientId ? "Selecionado" : "Pendente"}
              description="Empresa vinculada ao processo."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Tipo"
              value={String(fields.processType || "import")}
              description="Modalidade de negocio inicial."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Referencia"
              value={String(fields.referenceModal || "sea")}
              description="Prefixo usado para gerar o numero."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
            <OperationalStat
              label="Custos"
              value={fields.costControlEnabled === "true" ? "Ativo" : "Opcional"}
              description="Controle por processo."
              className="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] text-white"
            />
          </>
        }
      />

      <Form id="process-new-form" method="post" className="space-y-8">
        <input type="hidden" name="csrf" value={csrfToken} />
        {genericError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {genericError}
          </div>
        )}
        <Section title="Dados Gerais">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.type}</label>
              <select name="processType" defaultValue={fields.processType || "import"} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="import">{i18n.processes.import}</option>
                <option value="export">{i18n.processes.export}</option>
                <option value="services">{i18n.processes.services}</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Referência</label>
              <select name="referenceModal" defaultValue={fields.referenceModal || "sea"} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="air">Aéreo (A)</option>
                <option value="sea">Marítimo (M)</option>
                <option value="other">Outro (C)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.client} <span className="text-red-500">*</span></label>
              <select name="clientId" defaultValue={fields.clientId} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="">Selecione...</option>
                {clientList.map((c) => <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>)}
              </select>
              {errors.clientId && <p className="mt-1 text-xs text-red-500">{errors.clientId}</p>}
            </div>
            <InputField label={i18n.processes.incoterm} name="incoterm" placeholder="FOB, CIF, EXW" defaultValue={fields.incoterm} />
            <InputField label={i18n.processes.hsCode} name="hsCode" placeholder="8471.30.12" defaultValue={fields.hsCode} className="sm:col-span-2 lg:col-span-1" />
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.description}</label>
              <textarea name="description" rows={2} defaultValue={fields.description} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>
          </div>
        </Section>

        <Section title="Logística">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField label={i18n.processes.originCountry} name="originCountry" defaultValue={fields.originCountry} />
            <InputField label={i18n.processes.destinationCountry} name="destinationCountry" defaultValue={fields.destinationCountry || "Brasil"} />
            <InputField label={i18n.processes.portOfOrigin} name="portOfOrigin" defaultValue={fields.portOfOrigin} />
            <InputField label={i18n.processes.portOfDestination} name="portOfDestination" defaultValue={fields.portOfDestination} />
            <InputField label={i18n.processes.vessel} name="vessel" defaultValue={fields.vessel} />
            <InputField label={i18n.processes.bl} name="bl" defaultValue={fields.bl} />
            <InputField label={i18n.processes.containerCount} name="containerCount" type="number" defaultValue={fields.containerCount} />
            <InputField label={i18n.processes.containerType} name="containerType" placeholder="20', 40', 40'HC, LCL" defaultValue={fields.containerType} />
            <InputField label={i18n.processes.customsBroker} name="customsBroker" defaultValue={fields.customsBroker} />
          </div>
        </Section>

        <Section title="Valores e Datas">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InputField label={i18n.processes.currency} name="currency" defaultValue={fields.currency || "USD"} maxLength={3} />
            <InputField label={i18n.processes.totalValue} name="totalValue" type="number" placeholder="0.00" defaultValue={fields.totalValue} />
            <InputField label={i18n.processes.totalWeight} name="totalWeight" type="number" placeholder="0.000" defaultValue={fields.totalWeight} />
            <InputField label={i18n.processes.etd} name="etd" type="date" defaultValue={fields.etd} />
            <InputField label={i18n.processes.eta} name="eta" type="date" defaultValue={fields.eta} />
          </div>
        </Section>

        <Section title="Google Drive">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Link da Pasta no Google Drive</label>
              <input
                type="url"
                name="googleDriveUrl"
                placeholder="https://drive.google.com/drive/folders/..."
                defaultValue={fields.googleDriveUrl}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-400">Cole o link da pasta do Google Drive onde os documentos do processo estão salvos</p>
        </Section>

        <Section title="Custos por Processo">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="costControlEnabled"
              value="true"
              defaultChecked={fields.costControlEnabled === "true"}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Habilitar controle de custos neste processo</span>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Permite registrar custo estimado, custo real e observações financeiras.</p>
            </div>
          </label>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField label="Custo Estimado" name="estimatedCost" type="number" placeholder="0.00" defaultValue={fields.estimatedCost} />
            <InputField label="Custo Real" name="actualCost" type="number" placeholder="0.00" defaultValue={fields.actualCost} />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Observações de custos</label>
            <textarea name="costNotes" rows={3} defaultValue={fields.costNotes} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          </div>
        </Section>

        <Section title="Observações">
          <textarea name="notes" rows={3} defaultValue={fields.notes} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </Section>

        <div className="flex items-center justify-end gap-3">
          <Link to="/processes"><Button type="button" variant="outline">{i18n.common.cancel}</Button></Link>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" />{i18n.common.save}</Button>
        </div>
      </Form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-6 shadow-[var(--app-card-shadow)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--app-text)]">{title}</h2>
      {children}
    </div>
  );
}

function InputField({ label, name, type = "text", placeholder, maxLength, defaultValue, className, error }: {
  label: string; name: string; type?: string; placeholder?: string; maxLength?: number; defaultValue?: string; className?: string; error?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-[var(--app-text)]">{label}</label>
      <input type={type} name={name} placeholder={placeholder} maxLength={maxLength} defaultValue={defaultValue} step={type === "number" ? "any" : undefined}
        className="block h-12 w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10" />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
