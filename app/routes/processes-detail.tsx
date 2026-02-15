import { Link } from "react-router";
import type { Route } from "./+types/processes-detail";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, clients, processTimeline, processDocuments } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Edit, Clock, FileText, Ship, DollarSign } from "lucide-react";
import { eq, isNull, desc } from "drizzle-orm";

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default", in_progress: "info", awaiting_docs: "warning", customs_clearance: "warning",
  in_transit: "info", delivered: "success", completed: "success", cancelled: "danger",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const [process] = await db.select().from(processes).where(eq(processes.id, params.id)).limit(1);
  if (!process || process.deletedAt) throw new Response("Not found", { status: 404 });

  const [client] = await db.select().from(clients).where(eq(clients.id, process.clientId)).limit(1);
  const timeline = await db.select().from(processTimeline).where(eq(processTimeline.processId, params.id)).orderBy(desc(processTimeline.createdAt));
  const docs = await db.select().from(processDocuments).where(eq(processDocuments.processId, params.id)).orderBy(desc(processDocuments.createdAt));

  return { locale, process, client, timeline, documents: docs };
}

export default function ProcessesDetailPage({ loaderData }: Route.ComponentProps) {
  const { locale, process: proc, client, timeline, documents } = loaderData;
  const i18n = t(locale);
  const statusLabels: Record<string, string> = {
    draft: i18n.processes.draft, in_progress: i18n.processes.inProgress,
    awaiting_docs: i18n.processes.awaitingDocs, customs_clearance: i18n.processes.customsClearance,
    in_transit: i18n.processes.inTransit, delivered: i18n.processes.delivered,
    completed: i18n.processes.completed, cancelled: i18n.processes.cancelled,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/processes" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{proc.reference}</h1>
              <Badge variant={statusColors[proc.status]}>{statusLabels[proc.status]}</Badge>
              <Badge variant={proc.processType === "import" ? "info" : "success"}>
                {proc.processType === "import" ? i18n.processes.import : i18n.processes.export}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{client?.razaoSocial}</p>
          </div>
        </div>
        <Link to={`/processes/${proc.id}/edit`}>
          <Button variant="outline"><Edit className="h-4 w-4" />{i18n.common.edit}</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* General Info */}
        <Card title="Informações Gerais" icon={<FileText className="h-5 w-5" />}>
          <InfoRow label={i18n.processes.client} value={client?.nomeFantasia || client?.razaoSocial || "-"} />
          <InfoRow label={i18n.processes.description} value={proc.description || "-"} />
          <InfoRow label={i18n.processes.hsCode} value={proc.hsCode || "-"} />
          <InfoRow label={i18n.processes.incoterm} value={proc.incoterm || "-"} />
          <InfoRow label={i18n.processes.customsBroker} value={proc.customsBroker || "-"} />
          <InfoRow label={i18n.processes.diNumber} value={proc.diNumber || "-"} />
        </Card>

        {/* Logistics */}
        <Card title="Logística" icon={<Ship className="h-5 w-5" />}>
          <InfoRow label={i18n.processes.originCountry} value={proc.originCountry || "-"} />
          <InfoRow label={i18n.processes.destinationCountry} value={proc.destinationCountry || "-"} />
          <InfoRow label={i18n.processes.portOfOrigin} value={proc.portOfOrigin || "-"} />
          <InfoRow label={i18n.processes.portOfDestination} value={proc.portOfDestination || "-"} />
          <InfoRow label={i18n.processes.vessel} value={proc.vessel || "-"} />
          <InfoRow label={i18n.processes.bl} value={proc.bl || "-"} />
          <InfoRow label={i18n.processes.containerType} value={proc.containerType ? `${proc.containerCount || 1}x ${proc.containerType}` : "-"} />
        </Card>

        {/* Values */}
        <Card title="Valores" icon={<DollarSign className="h-5 w-5" />}>
          <InfoRow label={i18n.processes.totalValue} value={proc.totalValue ? `${proc.currency} ${Number(proc.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"} />
          <InfoRow label={i18n.processes.totalWeight} value={proc.totalWeight ? `${Number(proc.totalWeight).toLocaleString("pt-BR")} kg` : "-"} />
          <InfoRow label={i18n.processes.etd} value={proc.etd ? new Date(proc.etd).toLocaleDateString("pt-BR") : "-"} />
          <InfoRow label={i18n.processes.eta} value={proc.eta ? new Date(proc.eta).toLocaleDateString("pt-BR") : "-"} />
          <InfoRow label={i18n.processes.actualDeparture} value={proc.actualDeparture ? new Date(proc.actualDeparture).toLocaleDateString("pt-BR") : "-"} />
          <InfoRow label={i18n.processes.actualArrival} value={proc.actualArrival ? new Date(proc.actualArrival).toLocaleDateString("pt-BR") : "-"} />
        </Card>

        {/* Timeline */}
        <Card title={i18n.processes.timeline} icon={<Clock className="h-5 w-5" />}>
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum evento registrado</p>
          ) : (
            <div className="space-y-4">
              {timeline.map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.title}</p>
                    {entry.description && <p className="text-xs text-gray-500 dark:text-gray-400">{entry.description}</p>}
                    <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(entry.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {proc.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Observações</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{proc.notes}</p>
        </div>
      )}
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-2 text-gray-500"><span>{icon}</span><h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3></div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}
