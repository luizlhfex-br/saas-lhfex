import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/processes";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, clients } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Pagination } from "~/components/ui/pagination";
import { Plus, Eye, Edit, FileText, Search, X } from "lucide-react";
import { eq, isNull, desc, and, like, sql } from "drizzle-orm";

const ITEMS_PER_PAGE = 20;

const validStatuses = ["draft", "in_progress", "awaiting_docs", "customs_clearance", "in_transit", "delivered", "completed", "cancelled"] as const;
type ProcessStatus = typeof validStatuses[number];
const isValidStatus = (v: string): v is ProcessStatus => (validStatuses as readonly string[]).includes(v);

const validTypes = ["import", "export"] as const;
type ProcessType = typeof validTypes[number];
const isValidType = (v: string): v is ProcessType => (validTypes as readonly string[]).includes(v);

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

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const search = url.searchParams.get("search") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const typeFilter = url.searchParams.get("type") || "";

  const conditions = [isNull(processes.deletedAt)];
  if (search) {
    conditions.push(like(processes.reference, `%${search}%`));
  }
  if (statusFilter && isValidStatus(statusFilter)) {
    conditions.push(eq(processes.status, statusFilter));
  }
  if (typeFilter && isValidType(typeFilter)) {
    conditions.push(eq(processes.processType, typeFilter));
  }

  const whereClause = and(...conditions);

  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(processes)
    .where(whereClause);

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
    .where(whereClause)
    .orderBy(desc(processes.createdAt))
    .limit(ITEMS_PER_PAGE)
    .offset((page - 1) * ITEMS_PER_PAGE);

  return { locale, processes: processList, totalCount, page };
}

export default function ProcessesPage({ loaderData }: Route.ComponentProps) {
  const { locale, processes: processList, totalCount, page } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const i18n = t(locale);

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentType = searchParams.get("type") || "";
  const hasFilters = currentSearch || currentStatus || currentType;

  const statusLabels: Record<string, string> = {
    draft: i18n.processes.draft, in_progress: i18n.processes.inProgress,
    awaiting_docs: i18n.processes.awaitingDocs, customs_clearance: i18n.processes.customsClearance,
    in_transit: i18n.processes.inTransit, delivered: i18n.processes.delivered,
    completed: i18n.processes.completed, cancelled: i18n.processes.cancelled,
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    setSearchParams(params);
  };

  const clearFilters = () => setSearchParams({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.processes.title}</h1>
        <Link to="/processes/new">
          <Button><Plus className="h-4 w-4" />{i18n.processes.newProcess}</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar referência..."
            defaultValue={currentSearch}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select
          value={currentStatus}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={currentType}
          onChange={(e) => updateFilter("type", e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">Todos os tipos</option>
          <option value="import">{i18n.processes.import}</option>
          <option value="export">{i18n.processes.export}</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {processList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <FileText className="mb-4 h-12 w-12" />
            <p>{hasFilters ? "Nenhum processo encontrado com esses filtros." : i18n.processes.noProcesses}</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
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
            <Pagination totalItems={totalCount} itemsPerPage={ITEMS_PER_PAGE} currentPage={page} />
          </>
        )}
      </div>
    </div>
  );
}
