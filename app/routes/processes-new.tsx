import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/processes-new";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, processTimeline, auditLogs, clients } from "../../drizzle/schema";
import { processSchema } from "~/lib/validators";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { data } from "react-router";
import { isNull, eq, sql } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const clientList = await db
    .select({ id: clients.id, razaoSocial: clients.razaoSocial, nomeFantasia: clients.nomeFantasia })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(clients.razaoSocial);

  return { locale, clients: clientList };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();

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

  const values = result.data;
  const year = new Date().getFullYear();
  const prefix = values.processType === "import" ? "IMP" : values.processType === "export" ? "EXP" : "SRV";

  const countResult = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM processes WHERE reference LIKE ${prefix + "-" + year + "-%"}`
  );
  const count = Number(countResult[0]?.cnt || 0) + 1;
  const reference = `${prefix}-${year}-${String(count).padStart(4, "0")}`;

  const [newProcess] = await db.insert(processes).values({
    reference,
    processType: values.processType,
    status: "draft",
    clientId: values.clientId,
    description: values.description || null,
    hsCode: values.hsCode || null,
    hsDescription: values.hsDescription || null,
    incoterm: values.incoterm || null,
    originCountry: values.originCountry || null,
    destinationCountry: values.destinationCountry || "Brasil",
    currency: values.currency || "USD",
    totalValue: values.totalValue || null,
    totalWeight: values.totalWeight || null,
    containerCount: values.containerCount ? parseInt(values.containerCount) : null,
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
    notes: values.notes || null,
    createdBy: user.id,
  }).returning({ id: processes.id });

  await db.insert(processTimeline).values({
    processId: newProcess.id,
    status: "draft",
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

  throw redirect(`/processes/${newProcess.id}`);
}

export default function ProcessesNewPage({ loaderData }: Route.ComponentProps) {
  const { locale, clients: clientList } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);
  const errors = actionData?.errors || {};
  const fields = actionData?.fields || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/processes" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.processes.newProcess}</h1>
      </div>

      <Form method="post" className="space-y-8">
        <Section title="Dados Gerais">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.type}</label>
              <select name="processType" defaultValue={fields.processType || "import"} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="import">{i18n.processes.import}</option>
                <option value="export">{i18n.processes.export}</option>
                <option value="services">Outros Serviços</option>
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
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </div>
  );
}

function InputField({ label, name, type = "text", placeholder, maxLength, defaultValue, className, error }: {
  label: string; name: string; type?: string; placeholder?: string; maxLength?: number; defaultValue?: string; className?: string; error?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input type={type} name={name} placeholder={placeholder} maxLength={maxLength} defaultValue={defaultValue} step={type === "number" ? "any" : undefined}
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500" />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
