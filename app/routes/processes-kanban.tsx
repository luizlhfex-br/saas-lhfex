import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/processes-kanban";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, clients } from "../../drizzle/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { data } from "react-router";
import { Plus, ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";

const STAGES = [
  { id: "draft",             label: "Rascunho",         color: "border-t-gray-400",    bg: "bg-gray-50 dark:bg-gray-800/30",       dot: "bg-gray-400" },
  { id: "in_progress",       label: "Em Andamento",     color: "border-t-blue-500",    bg: "bg-blue-50/40 dark:bg-blue-900/10",    dot: "bg-blue-500" },
  { id: "awaiting_docs",     label: "Ag. Documentos",   color: "border-t-yellow-500",  bg: "bg-yellow-50/40 dark:bg-yellow-900/10",dot: "bg-yellow-500" },
  { id: "customs_clearance", label: "Despacho",         color: "border-t-purple-500",  bg: "bg-purple-50/40 dark:bg-purple-900/10",dot: "bg-purple-500" },
  { id: "in_transit",        label: "Em Trânsito",      color: "border-t-indigo-500",  bg: "bg-indigo-50/40 dark:bg-indigo-900/10",dot: "bg-indigo-500" },
  { id: "delivered",         label: "Entregue",         color: "border-t-teal-500",    bg: "bg-teal-50/40 dark:bg-teal-900/10",   dot: "bg-teal-500" },
  { id: "completed",         label: "Concluído ✅",     color: "border-t-green-500",   bg: "bg-green-50/40 dark:bg-green-900/10", dot: "bg-green-500" },
  { id: "cancelled",         label: "Cancelado ❌",     color: "border-t-red-500",     bg: "bg-red-50/40 dark:bg-red-900/10",     dot: "bg-red-500" },
] as const;

type StageId = typeof STAGES[number]["id"];

type ProcessCard = {
  id: string;
  reference: string;
  processType: "import" | "export" | "services";
  status: string;
  clientName: string | null;
  totalValue: string | null;
  currency: string | null;
  eta: Date | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const allProcesses = await db
    .select({
      id: processes.id,
      reference: processes.reference,
      processType: processes.processType,
      status: processes.status,
      clientName: clients.razaoSocial,
      totalValue: processes.totalValue,
      currency: processes.currency,
      eta: processes.eta,
    })
    .from(processes)
    .leftJoin(clients, eq(processes.clientId, clients.id))
    .where(isNull(processes.deletedAt))
    .orderBy(desc(processes.createdAt));

  return { processes: allProcesses };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "move") {
    const processId = formData.get("processId") as string;
    const newStatus = formData.get("status") as string;

    const validStatuses = STAGES.map((s) => s.id);
    if (!processId || !validStatuses.includes(newStatus as StageId)) {
      return data({ error: "Dados inválidos" }, { status: 400 });
    }

    await db
      .update(processes)
      .set({ status: newStatus as StageId, updatedAt: new Date() })
      .where(eq(processes.id, processId));

    return data({ success: true });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

function ProcessCard({ process, stages }: { process: ProcessCard; stages: readonly typeof STAGES[number][] }) {
  const fetcher = useFetcher();
  const currentStageIdx = stages.findIndex((s) => s.id === process.status);
  const nextStage = currentStageIdx < stages.length - 1 ? stages[currentStageIdx + 1] : null;

  const typeLabel: Record<string, string> = {
    import: "Importação", export: "Exportação", services: "Serviços"
  };
  const typeBadge: Record<string, string> = {
    import: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    export: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    services: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Reference */}
      <div className="mb-1.5 flex items-start justify-between gap-1">
        <Link
          to={`/processes/${process.id}`}
          className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          {process.reference}
        </Link>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${typeBadge[process.processType] || ""}`}>
          {typeLabel[process.processType] || process.processType}
        </span>
      </div>

      {/* Client */}
      {process.clientName && (
        <p className="mb-1.5 truncate text-xs text-gray-600 dark:text-gray-400">{process.clientName}</p>
      )}

      {/* Value */}
      {process.totalValue && (
        <p className="mb-2 text-xs font-medium text-gray-800 dark:text-gray-200">
          {process.currency || "USD"} {Number(process.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      )}

      {/* ETA */}
      {process.eta && (
        <p className="mb-2 text-[10px] text-gray-500 dark:text-gray-500">
          ETA: {new Date(process.eta).toLocaleDateString("pt-BR")}
        </p>
      )}

      {/* Move to next stage */}
      {nextStage && process.status !== "completed" && process.status !== "cancelled" && (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="move" />
          <input type="hidden" name="processId" value={process.id} />
          <input type="hidden" name="status" value={nextStage.id} />
          <button
            type="submit"
            className="mt-1 w-full rounded px-2 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            → {nextStage.label}
          </button>
        </fetcher.Form>
      )}
    </div>
  );
}

export default function ProcessesKanbanPage({ loaderData }: Route.ComponentProps) {
  const { processes: processList } = loaderData;

  // Group by status
  const byStatus: Record<string, ProcessCard[]> = {};
  for (const stage of STAGES) {
    byStatus[stage.id] = [];
  }
  for (const proc of processList) {
    const key = proc.status in byStatus ? proc.status : "draft";
    byStatus[key].push(proc as ProcessCard);
  }

  const totals: Record<string, number> = {};
  for (const stage of STAGES) {
    totals[stage.id] = byStatus[stage.id].reduce((sum, p) => {
      return sum + (p.totalValue ? Number(p.totalValue) : 0);
    }, 0);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/processes" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kanban — Processos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{processList.length} processos ativos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/processes">
            <Button variant="outline" size="sm">Lista</Button>
          </Link>
          <Link to="/processes/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Novo Processo
            </Button>
          </Link>
        </div>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: `${STAGES.length * 220}px` }}>
          {STAGES.map((stage) => {
            const cards = byStatus[stage.id] || [];
            return (
              <div
                key={stage.id}
                className={`flex w-52 shrink-0 flex-col rounded-xl border border-t-4 border-gray-200 dark:border-gray-700 ${stage.color} ${stage.bg}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{stage.label}</span>
                  </div>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-300">
                    {cards.length}
                  </span>
                </div>

                {/* Total USD */}
                {totals[stage.id] > 0 && (
                  <div className="px-3 pb-1.5">
                    <p className="text-[10px] text-gray-500 dark:text-gray-500">
                      USD {totals[stage.id].toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {/* Cards */}
                <div className="flex flex-col gap-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: "70vh" }}>
                  {cards.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-gray-400 dark:text-gray-600">Nenhum processo</p>
                  ) : (
                    cards.map((proc) => (
                      <ProcessCard key={proc.id} process={proc} stages={STAGES} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        Clique em "→ Próxima etapa" em cada card para mover o processo. Acesse o card para editar detalhes.
      </p>
    </div>
  );
}
