import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/crm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients } from "../../drizzle/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Pagination } from "~/components/ui/pagination";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { formatCNPJ } from "~/lib/utils";
import {
  ArrowRight,
  Building2,
  Edit,
  Eye,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";
  const statusFilter = url.searchParams.get("status") || "all";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;
  const companyId = await getPrimaryCompanyId(user.id);

  const conditions = [isNull(clients.deletedAt), eq(clients.companyId, companyId)];

  if (statusFilter !== "all") {
    conditions.push(eq(clients.status, statusFilter as "active" | "inactive" | "prospect"));
  }

  if (search) {
    const searchPattern = `%${search}%`;
    const searchDigits = search.replace(/\D/g, "");
    const searchConditions = [
      sql`LOWER(${clients.razaoSocial}) LIKE LOWER(${searchPattern})`,
      sql`LOWER(COALESCE(${clients.nomeFantasia}, '')) LIKE LOWER(${searchPattern})`,
    ];

    if (searchDigits) {
      searchConditions.push(sql`${clients.cnpj} LIKE ${`%${searchDigits}%`}`);
    }

    conditions.push(or(...searchConditions)!);
  }

  const whereClause = and(...conditions);

  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(whereClause);

  const clientList = await db
    .select({
      id: clients.id,
      cnpj: clients.cnpj,
      razaoSocial: clients.razaoSocial,
      nomeFantasia: clients.nomeFantasia,
      status: clients.status,
      city: clients.city,
      state: clients.state,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(whereClause)
    .orderBy(clients.razaoSocial)
    .limit(ITEMS_PER_PAGE)
    .offset((page - 1) * ITEMS_PER_PAGE);

  return { clients: clientList, locale, search, statusFilter, totalCount, page };
}

const panelClass =
  "rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] shadow-[var(--app-card-shadow)]";

export default function CrmPage({ loaderData }: Route.ComponentProps) {
  const { clients: clientList, locale, search, statusFilter, totalCount, page } = loaderData;
  const i18n = t(locale);
  const [searchParams, setSearchParams] = useSearchParams();

  const hasFilters = search || statusFilter !== "all";

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "border-emerald-300/20 bg-emerald-400/12 text-emerald-700 dark:text-emerald-200",
      inactive: "border-slate-300/20 bg-slate-400/10 text-slate-600 dark:text-slate-200",
      prospect: "border-amber-300/20 bg-amber-400/12 text-amber-700 dark:text-amber-200",
    };
    const labels: Record<string, string> = {
      active: i18n.common.active,
      inactive: i18n.common.inactive,
      prospect: i18n.crm.prospect,
    };

    return (
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${styles[status] || styles.active}`}>
        {labels[status] || status}
      </span>
    );
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
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
      <section className="relative overflow-hidden rounded-[30px] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,#071827_0%,#12253a_58%,#20324c_100%)] px-6 py-6 text-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.16)] lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_26%)]" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
          <div>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
              Relacionamento
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
              CRM com foco em contexto, prioridade comercial e carteira ativa.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Base central de clientes para prospeccao, operacao e relacionamento continuo.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/crm/new">
                <Button className="rounded-full border border-white/12 bg-white/10 text-white hover:bg-white/15">
                  <Plus className="h-4 w-4" />
                  {i18n.crm.newClient}
                </Button>
              </Link>
              <Link
                to="/crm/pipeline"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Ver pipeline
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Clientes</p>
              <p className="mt-2 text-3xl font-semibold text-white">{totalCount}</p>
              <p className="mt-1 text-sm text-slate-300">Base retornada para a visao atual.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Filtro de status</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {statusFilter === "all" ? "Todos" : statusFilter}
              </p>
              <p className="mt-1 text-sm text-slate-300">Carteira visivel no momento.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Busca</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {search ? `"${search}"` : "Sem termo"}
              </p>
              <p className="mt-1 text-sm text-slate-300">Pesquisa por razao, fantasia ou CNPJ.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${panelClass} p-5 lg:p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Corte da carteira</h2>
            <p className="text-sm text-[var(--app-muted)]">Refine por busca e status sem sair da tela.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
            <input
              type="text"
              placeholder={i18n.common.search}
              defaultValue={search}
              onChange={(event) => updateFilter("q", event.target.value)}
              className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] py-3 pl-10 pr-4 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => updateFilter("status", event.target.value)}
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)]"
          >
            <option value="all">{i18n.common.all}</option>
            <option value="active">{i18n.common.active}</option>
            <option value="inactive">{i18n.common.inactive}</option>
            <option value="prospect">{i18n.crm.prospect}</option>
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
        {clientList.length === 0 ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-16 text-center">
            <Building2 className="mb-4 h-16 w-16 text-[var(--app-muted)]" />
            <p className="text-lg font-semibold text-[var(--app-text)]">{i18n.common.noResults}</p>
            <p className="mt-2 max-w-md text-sm text-[var(--app-muted)]">
              {hasFilters
                ? "Nenhum cliente encontrado com esse recorte."
                : "Cadastre seu primeiro cliente para iniciar a operacao comercial."}
            </p>
            <div className="mt-6">
              {hasFilters ? (
                <button onClick={clearFilters} className="text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-300">
                  Limpar filtros
                </button>
              ) : (
                <Link to="/crm/new">
                  <Button>
                    <Plus className="h-4 w-4" />
                    {i18n.crm.newClient}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4 lg:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Carteira de clientes</h2>
                <p className="text-sm text-[var(--app-muted)]">
                  {totalCount} {totalCount === 1 ? "cliente encontrado" : "clientes encontrados"}
                </p>
              </div>
              <div className="hidden items-center gap-2 text-sm text-[var(--app-muted)] sm:flex">
                <Users className="h-4 w-4" />
                Visao operacional
              </div>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {clientList.map((client) => (
                <div key={client.id} className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/crm/${client.id}`} className="text-base font-semibold text-[var(--app-text)]">
                        {client.razaoSocial}
                      </Link>
                      {client.nomeFantasia && (
                        <p className="mt-1 text-sm text-[var(--app-muted)]">{client.nomeFantasia}</p>
                      )}
                    </div>
                    {statusBadge(client.status)}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">
                      {formatCNPJ(client.cnpj)}
                    </span>
                    {(client.city || client.state) && (
                      <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">
                        {[client.city, client.state].filter(Boolean).join(" / ")}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link to={`/crm/${client.id}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-3 py-2 text-sm font-medium text-[var(--app-text)]">
                      <Eye className="h-4 w-4" />
                      Ver
                    </Link>
                    <Link to={`/crm/${client.id}/edit`} className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-3 py-2 text-sm font-medium text-[var(--app-text)]">
                      <Edit className="h-4 w-4" />
                      Editar
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-left">
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                      Cliente
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                      CNPJ
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                      Status
                    </th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                      Local
                    </th>
                    <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientList.map((client) => (
                    <tr key={client.id} className="border-b border-[var(--app-border)]/80 transition-colors hover:bg-[var(--app-surface)]">
                      <td className="px-6 py-4">
                        <Link to={`/crm/${client.id}`} className="font-semibold text-[var(--app-text)] hover:text-cyan-700 dark:hover:text-cyan-300">
                          {client.razaoSocial}
                        </Link>
                        {client.nomeFantasia && (
                          <p className="mt-1 text-sm text-[var(--app-muted)]">{client.nomeFantasia}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--app-muted)]">{formatCNPJ(client.cnpj)}</td>
                      <td className="px-6 py-4">{statusBadge(client.status)}</td>
                      <td className="px-6 py-4 text-sm text-[var(--app-muted)]">
                        {[client.city, client.state].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/crm/${client.id}`} className="rounded-full border border-[var(--app-border)] p-2 text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link to={`/crm/${client.id}/edit`} className="rounded-full border border-[var(--app-border)] p-2 text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]">
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
      </section>
    </div>
  );
}
