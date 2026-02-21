/**
 * GET /public-procurement
 * Dashboard de Compras Públicas - Listagem de Editais
 */

import { useState } from "react";
import type { Route } from "./+types/public-procurement";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { useNavigate } from "react-router";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useFetcher } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "1";
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q");

  const params = new URLSearchParams();
  params.append("page", page);
  if (status) params.append("status", status);
  if (search) params.append("q", search);

  const response = await fetch(`http://localhost:3000/api/public-procurement-notices?${params}`, {
    headers: { Cookie: request.headers.get("cookie") || "" },
  });

  const data = await response.json();
  return data;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800 dark:bg-gray-700", icon: Clock },
  published: { label: "Publicado", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900", icon: FileText },
  proposals_open: { label: "Propostas Abertas", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900", icon: AlertCircle },
  proposals_ended: { label: "Propostas Encerradas", color: "bg-orange-100 text-orange-800 dark:bg-orange-900", icon: Clock },
  contracts_executed: { label: "Contrato Executado", color: "bg-green-100 text-green-800 dark:bg-green-900", icon: CheckCircle2 },
  closed: { label: "Encerrado", color: "bg-gray-200 text-gray-900 dark:bg-gray-600", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800 dark:bg-red-900", icon: AlertCircle },
};

export default function PublicProcurementPage({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const fetcher = useFetcher();

  const { notices = [], pagination = { page: 1, pages: 1 } } = loaderData;

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (search) params.append("q", search);
    if (statusFilter) params.append("status", statusFilter);
    navigate(`?${params}`);
  };

  const handleDelete = (noticeId: string) => {
    if (!confirm("Tem certeza que deseja cancelar este edital?")) return;
    fetcher.submit(
      { intent: "delete", noticeId, reason: "Cancelamento solicitado" },
      { method: "POST", action: "/api/public-procurement-notices" }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Compras Públicas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestão de editais e processos conforme Lei 14.133/21
          </p>
        </div>
        <Button
          onClick={() => navigate("/public-procurement-new")}
          className="flex gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Edital
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Buscar por título, processo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <select
            value={statusFilter || ""}
            onChange={(e) => setStatusFilter(e.target.value || null)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">Todos Status</option>
            {Object.entries(statusConfig).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={handleSearch}>
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Notices Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Edital</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Valor Orçado</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Fechamento</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {notices.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  Nenhum edital encontrado. Clique em "Novo Edital" para começar.
                </td>
              </tr>
            ) : (
              notices.map((notice: any) => {
                const config = statusConfig[notice.status] || statusConfig.draft;
                const Icon = config.icon;
                return (
                  <tr key={notice.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{notice.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{notice.processNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {notice.budgetEstimate
                          ? `R$ ${parseFloat(notice.budgetEstimate).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}`
                          : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4" />
                        {notice.closureDate ? new Date(notice.closureDate).toLocaleDateString("pt-BR") : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/public-procurement/${notice.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(notice.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => (
            <Button
              key={i + 1}
              variant={pagination.page === i + 1 ? "default" : "outline"}
              onClick={() => navigate(`?page=${i + 1}`)}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
