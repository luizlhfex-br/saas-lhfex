import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/crm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients, contacts } from "../../drizzle/schema";
import { eq, isNull, and, or, sql, desc } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Button } from "~/components/ui/button";
import { Plus, Search, Users, Eye, Edit, Building2, X } from "lucide-react";
import { formatCNPJ } from "~/lib/utils";
import { Pagination } from "~/components/ui/pagination";

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

  // Build where conditions
  const conditions = [isNull(clients.deletedAt)];

  if (statusFilter !== "all") {
    conditions.push(eq(clients.status, statusFilter as "active" | "inactive" | "prospect"));
  }

  // Server-side search (moved from JS to SQL)
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

  // Count query
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(whereClause);

  // Query clients with contact count
  const clientList = await db
    .select({
      id: clients.id,
      cnpj: clients.cnpj,
      razaoSocial: clients.razaoSocial,
      nomeFantasia: clients.nomeFantasia,
      clientType: clients.clientType,
      status: clients.status,
      email: clients.email,
      phone: clients.phone,
      city: clients.city,
      state: clients.state,
      createdAt: clients.createdAt,
      contactCount: sql<number>`(
        SELECT count(*)::int FROM contacts
        WHERE contacts.client_id = clients.id
        AND contacts.deleted_at IS NULL
      )`,
    })
    .from(clients)
    .where(whereClause)
    .orderBy(clients.razaoSocial)
    .limit(ITEMS_PER_PAGE)
    .offset((page - 1) * ITEMS_PER_PAGE);

  return { clients: clientList, locale, search, statusFilter, totalCount, page };
}

export default function CrmPage({ loaderData }: Route.ComponentProps) {
  const { clients: clientList, locale, search, statusFilter, totalCount, page } = loaderData;
  const i18n = t(locale);
  const [searchParams, setSearchParams] = useSearchParams();

  const hasFilters = search || statusFilter !== "all";

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
      prospect: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
    };
    const labels: Record<string, string> = {
      active: i18n.common.active,
      inactive: i18n.common.inactive,
      prospect: i18n.crm.prospect,
    };
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.active}`}>
        {labels[status] || status}
      </span>
    );
  };

  const typeBadge = (type: string) => {
    const labels: Record<string, string> = {
      importer: i18n.crm.importer,
      exporter: i18n.crm.exporter,
      both: i18n.crm.both,
    };
    return (
      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
        {labels[type] || type}
      </span>
    );
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") { params.set(key, value); } else { params.delete(key); }
    params.delete("page");
    setSearchParams(params);
  };

  const clearFilters = () => setSearchParams({});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {i18n.crm.clients}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {totalCount} {totalCount === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <Link to="/crm/new">
          <Button>
            <Plus className="h-4 w-4" />
            {i18n.crm.newClient}
          </Button>
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={i18n.common.search}
            defaultValue={search}
            onChange={(e) => updateFilter("q", e.target.value)}
            className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="all">{i18n.common.all}</option>
          <option value="active">{i18n.common.active}</option>
          <option value="inactive">{i18n.common.inactive}</option>
          <option value="prospect">{i18n.crm.prospect}</option>
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

      {/* Table */}
      {clientList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-800 dark:bg-gray-900">
          <Building2 className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-700" />
          <p className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
            {i18n.common.noResults}
          </p>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            {hasFilters ? "Nenhum cliente encontrado com esses filtros." : "Cadastre seu primeiro cliente para comecar."}
          </p>
          {hasFilters ? (
            <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {i18n.crm.razaoSocial}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {i18n.crm.cnpj}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
                    {i18n.crm.clientType}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:table-cell">
                    {i18n.common.status}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">
                    {i18n.crm.contacts}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {i18n.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {clientList.map((client) => (
                  <tr
                    key={client.id}
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <Link
                          to={`/crm/${client.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                        >
                          {client.razaoSocial}
                        </Link>
                        {client.nomeFantasia && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {client.nomeFantasia}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatCNPJ(client.cnpj)}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {typeBadge(client.clientType)}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {statusBadge(client.status)}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <Users className="h-3.5 w-3.5" />
                        {client.contactCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/crm/${client.id}`}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                          title="Ver"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/crm/${client.id}/edit`}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                          title="Editar"
                        >
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
        </div>
      )}
    </div>
  );
}
