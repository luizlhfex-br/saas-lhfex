import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/processes-edit";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, processTimeline, auditLogs, clients } from "../../drizzle/schema";
import { processSchema } from "~/lib/validators";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { data } from "react-router";
import { eq, isNull, and } from "drizzle-orm";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const [process] = await db.select().from(processes).where(and(eq(processes.id, params.id), isNull(processes.deletedAt))).limit(1);
  if (!process) throw new Response("Not found", { status: 404 });

  const clientList = await db.select({ id: clients.id, razaoSocial: clients.razaoSocial, nomeFantasia: clients.nomeFantasia }).from(clients).where(isNull(clients.deletedAt)).orderBy(clients.razaoSocial);

  return { locale, process, clients: clientList };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) { raw[key] = value === "" ? undefined : value; }
  if (!raw.processType) raw.processType = "import";

  const result = processSchema.safeParse(raw);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) { errors[issue.path.join(".")] = issue.message; }
    return data({ errors, fields: raw as Record<string, string> }, { status: 400 });
  }

  const values = result.data;
  const oldStatus = (formData.get("_oldStatus") as string) || "draft";
  const newStatus = values.status || oldStatus;

  await db.update(processes).set({
    processType: values.processType,
    status: newStatus as any,
    clientId: values.clientId,
    description: values.description || null,
    hsCode: values.hsCode || null,
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
    notes: values.notes || null,
    updatedAt: new Date(),
  }).where(eq(processes.id, params.id));

  if (newStatus !== oldStatus) {
    const statusLabels: Record<string, string> = { draft: "Rascunho", in_progress: "Em Andamento", awaiting_docs: "Aguardando Docs", customs_clearance: "Desembaraço", in_transit: "Em Trânsito", delivered: "Entregue", completed: "Concluído", cancelled: "Cancelado" };
    await db.insert(processTimeline).values({
      processId: params.id, status: newStatus as any,
      title: `Status alterado para: ${statusLabels[newStatus] || newStatus}`,
      createdBy: user.id,
    });
  }

  await db.insert(auditLogs).values({ userId: user.id, action: "update", entity: "process", entityId: params.id, changes: values, ipAddress: request.headers.get("x-forwarded-for") || "unknown", userAgent: request.headers.get("user-agent") || "unknown" });

  throw redirect(`/processes/${params.id}`);
}

export default function ProcessesEditPage({ loaderData }: Route.ComponentProps) {
  const { locale, process: proc, clients: clientList } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const i18n = t(locale);
  const errors = actionData?.errors || {};
  const fields = actionData?.fields || {};
  const val = (name: string) => fields[name] ?? (proc as any)[name] ?? "";
  const fmtDate = (d: any) => d ? new Date(d).toISOString().split("T")[0] : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/processes/${proc.id}`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.processes.editProcess}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{proc.reference}</p>
        </div>
      </div>

      <Form method="post" className="space-y-8">
        <input type="hidden" name="_oldStatus" value={proc.status} />
        <Sec title="Dados Gerais">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Sel label={i18n.processes.type} name="processType" value={val("processType")} options={[["import", i18n.processes.import], ["export", i18n.processes.export]]} />
            <Sel label={i18n.processes.client} name="clientId" value={val("clientId")} options={clientList.map(c => [c.id, c.nomeFantasia || c.razaoSocial])} required />
            <Sel label={i18n.common.status} name="status" value={val("status")} options={[["draft", i18n.processes.draft], ["in_progress", i18n.processes.inProgress], ["awaiting_docs", i18n.processes.awaitingDocs], ["customs_clearance", i18n.processes.customsClearance], ["in_transit", i18n.processes.inTransit], ["delivered", i18n.processes.delivered], ["completed", i18n.processes.completed], ["cancelled", i18n.processes.cancelled]]} />
            <Inp label={i18n.processes.incoterm} name="incoterm" value={val("incoterm")} />
            <Inp label={i18n.processes.hsCode} name="hsCode" value={val("hsCode")} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{i18n.processes.description}</label>
              <textarea name="description" rows={2} defaultValue={val("description")} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>
          </div>
        </Sec>
        <Sec title="Logística">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Inp label={i18n.processes.originCountry} name="originCountry" value={val("originCountry")} />
            <Inp label={i18n.processes.destinationCountry} name="destinationCountry" value={val("destinationCountry")} />
            <Inp label={i18n.processes.portOfOrigin} name="portOfOrigin" value={val("portOfOrigin")} />
            <Inp label={i18n.processes.portOfDestination} name="portOfDestination" value={val("portOfDestination")} />
            <Inp label={i18n.processes.vessel} name="vessel" value={val("vessel")} />
            <Inp label={i18n.processes.bl} name="bl" value={val("bl")} />
            <Inp label={i18n.processes.containerCount} name="containerCount" type="number" value={val("containerCount")} />
            <Inp label={i18n.processes.containerType} name="containerType" value={val("containerType")} />
            <Inp label={i18n.processes.customsBroker} name="customsBroker" value={val("customsBroker")} />
            <Inp label={i18n.processes.diNumber} name="diNumber" value={val("diNumber")} />
          </div>
        </Sec>
        <Sec title="Valores e Datas">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Inp label={i18n.processes.currency} name="currency" value={val("currency")} />
            <Inp label={i18n.processes.totalValue} name="totalValue" type="number" value={val("totalValue")} />
            <Inp label={i18n.processes.totalWeight} name="totalWeight" type="number" value={val("totalWeight")} />
            <Inp label={i18n.processes.etd} name="etd" type="date" value={fmtDate(proc.etd)} />
            <Inp label={i18n.processes.eta} name="eta" type="date" value={fmtDate(proc.eta)} />
          </div>
        </Sec>
        <Sec title="Observações">
          <textarea name="notes" rows={3} defaultValue={val("notes")} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </Sec>
        <div className="flex items-center justify-end gap-3">
          <Link to={`/processes/${proc.id}`}><Button type="button" variant="outline">{i18n.common.cancel}</Button></Link>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" />{i18n.common.save}</Button>
        </div>
      </Form>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"><h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>{children}</div>);
}
function Inp({ label, name, type = "text", value, placeholder }: { label: string; name: string; type?: string; value?: string; placeholder?: string }) {
  return (<div><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label><input type={type} name={name} defaultValue={value} placeholder={placeholder} step={type === "number" ? "any" : undefined} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>);
}
function Sel({ label, name, value, options, required }: { label: string; name: string; value?: string; options: [string, string][]; required?: boolean }) {
  return (<div><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}{required && <span className="text-red-500"> *</span>}</label><select name={name} defaultValue={value} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">{!required && <option value="">Selecione...</option>}{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>);
}
