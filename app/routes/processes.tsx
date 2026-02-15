import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/processes";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, clients } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Plus, Eye, Edit, FileText } from "lucide-react";
import { eq, isNull, desc } from "drizzle-orm";

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default",
  in_progress: "info",
  awaiting_docs: "warning",
  customs_clearance: "warning",
  in_transit: "info",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const processList = await db
    .select({
      id: processes.id,
      reference: processes.reference,
      processType: processes.processType,
      status: processes.status,
      clientName: clients.razaoSocial,
      totalValue: processes.totalValue,
      currency: processes.currency,
      eta: processes.eta,
      createdAt: processes.createdAt,
    })
    .from(processes)
    .leftJoin(clients, eq(processes.clientId, clients.id))
    .where(isNull(processes.deletedAt))
    .orderBy(desc(processes.createdAt));

  return { locale, processes: processList };
}

export default function ProcessesPage({ loaderData }: Route.ComponentProps) {
  const { locale, processes: processList } = loaderData;
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.processes.title}</h1>
        </div>
        <Link to="/processes/new">
          <Button><Plus className="h-4 w-4" />{i18n.processes.newProcess}</Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {processList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <FileText className="mb-4 h-12 w-12" />
            <p>{i18n.processes.noProcesses}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{i18n.processes.reference}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{i18n.processes.client}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{i18n.processes.type}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{i18n.common.status}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{i18n.processes.totalValue}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{i18n.processes.eta}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">{i18n.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {processList.map((proc) => (
                  <tr key={proc.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                      <Link to={`/processes/${proc.id}`}>{proc.reference}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{proc.clientName}</td>
                    <td className="px-4 py-3">
                      <Badge variant={proc.processType === "import" ? "info" : "success"}>
                        {proc.processType === "import" ? i18n.processes.import : i18n.processes.export}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusColors[proc.status] || "default"}>
                        {statusLabels[proc.status] || proc.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {proc.totalValue ? `${proc.currency} ${Number(proc.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {proc.eta ? new Date(proc.eta).toLocaleDateString("pt-BR") : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/processes/${proc.id}`} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link to={`/processes/${proc.id}/edit`} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Edit className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
