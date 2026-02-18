import { useSearchParams } from "react-router";
import type { Route } from "./+types/audit";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { auditLogs, users } from "../../drizzle/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { Shield, Filter } from "lucide-react";
import { Pagination } from "~/components/ui/pagination";

const ITEMS_PER_PAGE = 20;

const ACTION_OPTIONS = [
  "all",
  "create",
  "update",
  "delete",
  "upload",
  "download",
  "login",
  "logout",
] as const;

const ENTITY_OPTIONS = [
  "all",
  "client",
  "contact",
  "process",
  "invoice",
  "document",
  "user",
  "session",
] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const actionFilter = url.searchParams.get("action") || "";
  const entityFilter = url.searchParams.get("entity") || "";

  // Build where conditions
  const conditions = [];

  if (actionFilter && actionFilter !== "all") {
    conditions.push(eq(auditLogs.action, actionFilter));
  }

  if (entityFilter && entityFilter !== "all") {
    conditions.push(eq(auditLogs.entity, entityFilter));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count query
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(whereClause);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Fetch logs with user join
  const logs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(ITEMS_PER_PAGE)
    .offset((page - 1) * ITEMS_PER_PAGE);

  return { locale, logs, page, totalPages, totalCount, actionFilter, entityFilter };
}

const actionBadgeStyles: Record<string, string> = {
  create:
    "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  update:
    "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  delete:
    "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  upload:
    "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  download:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  login:
    "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400",
  logout:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
};

const entityLabels: Record<string, string> = {
  client: "Cliente",
  contact: "Contato",
  process: "Processo",
  invoice: "Fatura",
  document: "Documento",
  user: "Usuário",
  session: "Sessão",
};

const actionLabels: Record<string, string> = {
  create: "Criar",
  update: "Atualizar",
  delete: "Excluir",
  upload: "Upload",
  download: "Download",
  login: "Login",
  logout: "Logout",
};

function formatDate(date: string | Date, locale: string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditPage({ loaderData }: Route.ComponentProps) {
  const { locale, logs, page, totalCount, actionFilter, entityFilter } =
    loaderData;
  const i18n = t(locale);
  const [searchParams, setSearchParams] = useSearchParams();

  const hasFilters =
    (actionFilter && actionFilter !== "all") ||
    (entityFilter && entityFilter !== "all");

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
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {locale === "en" ? "Audit Logs" : "Logs de Auditoria"}
          </h1>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {locale === "en"
            ? "Track all actions performed in the system"
            : "Acompanhe todas as ações realizadas no sistema"}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Filter className="h-4 w-4" />
            {i18n.common.filter}
          </div>

          <select
            value={actionFilter || "all"}
            onChange={(e) => updateFilter("action", e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all"
                  ? locale === "en"
                    ? "All Actions"
                    : "Todas as Ações"
                  : actionLabels[opt] || opt}
              </option>
            ))}
          </select>

          <select
            value={entityFilter || "all"}
            onChange={(e) => updateFilter("entity", e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {ENTITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all"
                  ? locale === "en"
                    ? "All Entities"
                    : "Todas as Entidades"
                  : entityLabels[opt] || opt}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              {locale === "en" ? "Clear" : "Limpar"}
            </button>
          )}

          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {totalCount}{" "}
            {totalCount === 1
              ? locale === "en"
                ? "record"
                : "registro"
              : locale === "en"
                ? "records"
                : "registros"}
          </span>
        </div>
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-800 dark:bg-gray-900">
          <Shield className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-700" />
          <p className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
            {i18n.common.noResults}
          </p>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            {hasFilters
              ? locale === "en"
                ? "No logs found with these filters."
                : "Nenhum log encontrado com esses filtros."
              : locale === "en"
                ? "No audit logs recorded yet."
                : "Nenhum log de auditoria registrado ainda."}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {locale === "en" ? "Clear filters" : "Limpar filtros"}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {locale === "en" ? "Date" : "Data"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {locale === "en" ? "User" : "Usuário"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {locale === "en" ? "Action" : "Ação"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {locale === "en" ? "Entity" : "Entidade"}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
                    {locale === "en" ? "Entity ID" : "ID da Entidade"}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(log.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {log.userName || (locale === "en" ? "System" : "Sistema")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          actionBadgeStyles[log.action] ||
                          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {entityLabels[log.entity] || log.entity}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {log.entityId
                          ? `${log.entityId.slice(0, 8)}...`
                          : "—"}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400 lg:table-cell">
                      {log.ipAddress || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            totalItems={totalCount}
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={page}
          />
        </div>
      )}
    </div>
  );
}
