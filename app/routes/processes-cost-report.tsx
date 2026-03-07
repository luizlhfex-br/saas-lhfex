import { Link } from "react-router";
import type { Route } from "./+types/processes-cost-report";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, clients } from "../../drizzle/schema";
import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { ArrowLeft, DollarSign } from "lucide-react";
import { Badge } from "~/components/ui/badge";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  try {
    const url = new URL(request.url);
    const onlyEnabled = url.searchParams.get("enabled") !== "false";

    const conditions: SQL[] = [isNull(processes.deletedAt)];
    if (onlyEnabled) {
      conditions.push(eq(processes.costControlEnabled, true));
    } else {
      conditions.push(or(isNotNull(processes.estimatedCost), isNotNull(processes.actualCost)) || isNotNull(processes.updatedAt));
    }

    const rows = await db
      .select({
        id: processes.id,
        reference: processes.reference,
        status: processes.status,
        processType: processes.processType,
        clientName: clients.razaoSocial,
        estimatedCost: processes.estimatedCost,
        actualCost: processes.actualCost,
        currency: processes.currency,
        updatedAt: processes.updatedAt,
      })
      .from(processes)
      .leftJoin(clients, eq(processes.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(processes.updatedAt));

    const totalEstimated = rows.reduce((sum, row) => sum + Number(row.estimatedCost || 0), 0);
    const totalActual = rows.reduce((sum, row) => sum + Number(row.actualCost || 0), 0);
    const totalVariance = totalActual - totalEstimated;

    return {
      rows,
      onlyEnabled,
      loadError: null,
      summary: {
        totalEstimated,
        totalActual,
        totalVariance,
        processCount: rows.length,
      },
    };
  } catch {
    return {
      rows: [],
      onlyEnabled: true,
      loadError: "Nao foi possivel carregar o relatorio de custos no momento.",
      summary: {
        totalEstimated: 0,
        totalActual: 0,
        totalVariance: 0,
        processCount: 0,
      },
    };
  }
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default",
  in_progress: "info",
  awaiting_docs: "warning",
  customs_clearance: "warning",
  in_transit: "info",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
  pending_approval: "warning",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  awaiting_docs: "Aguardando docs",
  customs_clearance: "Desembaraco",
  in_transit: "Em transito",
  delivered: "Entregue",
  completed: "Concluido",
  cancelled: "Cancelado",
  pending_approval: "Aguardando aprovacao",
};

export default function ProcessesCostReportPage({ loaderData }: Route.ComponentProps) {
  const { rows, summary, onlyEnabled, loadError } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/processes" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Relatorio de Custos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Visao consolidada de custo estimado vs custo real por processo</p>
          </div>
        </div>
        <Link
          to={onlyEnabled ? "/processes/cost-report?enabled=false" : "/processes/cost-report"}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {onlyEnabled ? "Mostrar com estimativa" : "Somente custos ativos"}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card title="Processos" value={String(summary.processCount)} />
        <Card title="Custo Estimado" value={money(summary.totalEstimated)} />
        <Card title="Custo Real" value={money(summary.totalActual)} />
        <Card title="Variacao" value={money(summary.totalVariance)} tone={summary.totalVariance > 0 ? "danger" : "success"} />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {loadError && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {loadError}
          </div>
        )}
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum processo com dados de custo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Referencia</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Estimado</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Real</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Variacao</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: {
                  id: string;
                  reference: string;
                  status: string;
                  clientName: string | null;
                  estimatedCost: unknown;
                  actualCost: unknown;
                  currency: string | null;
                }) => {
                  const estimated = Number(row.estimatedCost || 0);
                  const actual = Number(row.actualCost || 0);
                  const variance = actual - estimated;
                  return (
                    <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{row.reference}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.clientName || "-"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColors[row.status] || "default"}>{statusLabels[row.status] || row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.currency || "USD"} {money(estimated)}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.currency || "USD"} {money(actual)}</td>
                      <td className={`px-4 py-3 font-medium ${variance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {row.currency || "USD"} {money(variance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/processes/${row.id}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                          <DollarSign className="h-3.5 w-3.5" />
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, tone = "default" }: { title: string; value: string; tone?: "default" | "success" | "danger" }) {
  const color = tone === "danger" ? "text-red-600 dark:text-red-400" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
