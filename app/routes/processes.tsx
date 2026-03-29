import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/processes";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients, processes } from "../../drizzle/schema";
import { and, desc, eq, isNull, like, sql } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Pagination } from "~/components/ui/pagination";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import {
  ArrowRight,
  DollarSign,
  Edit,
  Eye,
  FileText,
  LayoutGrid,
  Plane,
  Plus,
  Search,
  Ship,
  X,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;
const validStatuses = ["draft", "in_progress", "awaiting_docs", "customs_clearance", "in_transit", "delivered", "completed", "cancelled"] as const;
type ProcessStatus = typeof validStatuses[number];
const isValidStatus = (value: string): value is ProcessStatus => (validStatuses as readonly string[]).includes(value);

const validTypes = ["import", "export", "services"] as const;
type ProcessType = typeof validTypes[number];
const isValidType = (value: string): value is ProcessType => (validTypes as readonly string[]).includes(value);

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

const panelClass =
  "rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] shadow-[var(--app-card-shadow)]";

function getProcessTypeMeta(processType: ProcessType | string) {
  if (processType === "import") {
    return { label: "Importação", icon: Ship };
  }
  if (processType === "export") {
    return { label: "Exportação", icon: Plane };
  }
  return { label: "Outros", icon: FileText };
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const search = url.searchParams.get("search") || "";
  const statusParam = url.searchParams.get("status");
  const statusFilter =
    statusParam === null || statusParam === "all" || isValidStatus(statusParam)
      ? statusParam || "all"
      : "all";
  const typeFilter = url.searchParams.get("type") || "";

  const conditions = [
    isNull(processes.deletedAt),
    eq(processes.companyId, await getPrimaryCompanyId(user.id)),
  ];

  if (search) conditions.push(like(processes.reference, `%${search}%`));
  if (statusFilter !== "all" && isValidStatus(statusFilter)) conditions.push(eq(processes.status, statusFilter));
  if (typeFilter && isValidType(typeFilter)) conditions.push(eq(processes.processType, typeFilter));

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
  const currentStatusParam = searchParams.get("status");
  const currentStatus =
    currentStatusParam === null || currentStatusParam === "all" || isValidStatus(currentStatusParam)
      ? currentStatusParam || "all"
      : "all";
  const currentType = searchParams.get("type") || "";
  const hasFilters = currentSearch || currentType || currentStatus !== "all";

  const statusLabels: Record<string, string> = {
    draft: i18n.processes.draft,
    in_progress: i18n.processes.inProgress,
    awaiting_docs: i18n.processes.awaitingDocs,
    customs_clearance: i18n.processes.customsClearance,
    in_transit: i18n.processes.inTransit,
    delivered: i18n.processes.delivered,
    completed: i18n.processes.completed,
    cancelled: i18n.processes.cancelled,
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
      <section className="relative overflow-hidden rounded-[30px] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,#081221_0%,#12263a_52%,#18334f_100%)] px-6 py-6 text-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.16)] lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_24%)]" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
          <div>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-100">
              Operacao comex
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
              Processos com leitura rapida de referencia, cliente, fase e custo.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Aqui a prioridade e entender o fluxo em execucao e agir sem perder contexto.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/processes/new">
                <Button className="rounded-full border border-white/12 bg-white/10 text-white hover:bg-white/15">
                  <Plus className="h-4 w-4" />
                  {i18n.processes.newProcess}
                </Button>
              </Link>
              <Link to="/processes/kanban" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10">
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </Link>
              <Link to="/processes/cost-report" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10">
                <DollarSign className="h-4 w-4" />
                Relatorio de custos
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Processos</p>
              <p className="mt-2 text-3xl font-semibold text-white">{totalCount}</p>
              <p className="mt-1 text-sm text-slate-300">Registros no recorte atual.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Status</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {currentStatus === "all" ? "Todos" : statusLabels[currentStatus] || currentStatus}
              </p>
              <p className="mt-1 text-sm text-slate-300">Visao geral padrao da operacao.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Tipo</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {currentType ? getProcessTypeMeta(currentType).label : "Todos"}
              </p>
              <p className="mt-1 text-sm text-slate-300">Filtro por natureza do processo.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${panelClass} p-5 lg:p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/18 bg-sky-400/10 text-sky-700 dark:text-sky-200">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Filtro operacional</h2>
            <p className="text-sm text-[var(--app-muted)]">Busque por referencia e refine por fase ou tipo.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
            <input
              type="text"
              placeholder="Buscar referencia..."
              defaultValue={currentSearch}
              onChange={(event) => updateFilter("search", event.target.value)}
              className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] py-3 pl-10 pr-4 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)]"
            />
          </div>
          <select
            value={currentStatus}
            onChange={(event) => updateFilter("status", event.target.value)}
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)]"
          >
            <option value="all">Todos os status</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={currentType}
            onChange={(event) => updateFilter("type", event.target.value)}
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)]"
          >
            <option value="">Todos os tipos</option>
            <option value="import">{i18n.processes.import}</option>
            <option value="export">{i18n.processes.export}</option>
            <option value="services">Outros</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--app-border)] px-4 py-3 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)]"
            >
              <X className="h-4 w-4" />
              Limpar
            </button>
          )}
        </div>
      </section>

      <section className={panelClass}>
        {processList.length === 0 ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-16 text-center">
            <FileText className="mb-4 h-16 w-16 text-[var(--app-muted)]" />
            <p className="text-lg font-semibold text-[var(--app-text)]">{i18n.processes.noProcesses}</p>
            <p className="mt-2 max-w-md text-sm text-[var(--app-muted)]">
              {hasFilters
                ? "Nenhum processo encontrado com esse recorte."
                : "Abra um processo para comecar a operar embarques, documentos e custos."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4 lg:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Mapa da operacao</h2>
                <p className="text-sm text-[var(--app-muted)]">
                  {totalCount} {totalCount === 1 ? "processo encontrado" : "processos encontrados"}
                </p>
              </div>
              <div className="hidden items-center gap-2 text-sm text-[var(--app-muted)] sm:flex">
                <Ship className="h-4 w-4" />
                Fluxo por referencia
              </div>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {processList.map((proc) => {
                const typeMeta = getProcessTypeMeta(proc.processType);
                const TypeIcon = typeMeta.icon;
                return (
                <div key={proc.id} className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/processes/${proc.id}`} className="text-base font-semibold text-[var(--app-text)]">
                        {proc.reference}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--app-muted)]">{proc.clientName || "Cliente nao informado"}</p>
                    </div>
                    <Badge variant={statusColors[proc.status] || "default"}>
                      {statusLabels[proc.status] || proc.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/20 bg-sky-400/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-200">
                      <TypeIcon className="h-3.5 w-3.5" />
                      {typeMeta.label}
                    </span>
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">
                      {proc.totalValue ? `${proc.currency} ${Number(proc.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Sem valor"}
                    </span>
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">
                      {proc.eta ? `ETA ${new Date(proc.eta).toLocaleDateString("pt-BR")}` : "ETA nao informado"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link to={`/processes/${proc.id}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-3 py-2 text-sm font-medium text-[var(--app-text)]">
                      <Eye className="h-4 w-4" />
                      Ver
                    </Link>
                    <Link to={`/processes/${proc.id}/edit`} className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-3 py-2 text-sm font-medium text-[var(--app-text)]">
                      <Edit className="h-4 w-4" />
                      Editar
                    </Link>
                  </div>
                </div>
              )})}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-left">
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Referencia</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Cliente</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Tipo</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Status</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Valor</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">ETA</th>
                    <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {processList.map((proc) => {
                    const typeMeta = getProcessTypeMeta(proc.processType);
                    const TypeIcon = typeMeta.icon;
                    return (
                    <tr key={proc.id} className="border-b border-[var(--app-border)]/80 transition-colors hover:bg-[var(--app-surface)]">
                      <td className="px-6 py-4">
                        <Link to={`/processes/${proc.id}`} className="font-semibold text-[var(--app-text)] hover:text-sky-700 dark:hover:text-sky-300">
                          {proc.reference}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--app-muted)]">{proc.clientName || "-"}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/20 bg-sky-400/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-200">
                          <TypeIcon className="h-3.5 w-3.5" />
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusColors[proc.status] || "default"}>
                          {statusLabels[proc.status] || proc.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--app-muted)]">
                        {proc.totalValue
                          ? `${proc.currency} ${Number(proc.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--app-muted)]">
                        {proc.eta ? new Date(proc.eta).toLocaleDateString("pt-BR") : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/processes/${proc.id}`} className="rounded-full border border-[var(--app-border)] p-2 text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link to={`/processes/${proc.id}/edit`} className="rounded-full border border-[var(--app-border)] p-2 text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]">
                            <Edit className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            <Pagination totalItems={totalCount} itemsPerPage={ITEMS_PER_PAGE} currentPage={page} />
          </>
        )}
      </section>
    </div>
  );
}
