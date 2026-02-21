/**
 * GET /public-procurement/$noticeId
 * Detail page para um edital
 */

import { useState } from "react";
import type { Route } from "./+types/public-procurement.$noticeId";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { useNavigate, useFetcher } from "react-router";
import {
  ArrowLeft,
  Edit3,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  // Em produção, buscar do banco
  return { noticeId: params.noticeId, user };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-status") {
    // Atualizar status
  }

  if (intent === "add-process") {
    // Adicionar processo
  }

  return { success: true };
}

export default function PublicProcurementDetailPage({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { noticeId } = loaderData;
  const [editingStatus, setEditingStatus] = useState(false);
  const [showProcessForm, setShowProcessForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/public-procurement")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Edital Info Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  [Título Edital]
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Processo: <span className="font-mono font-semibold">[UPA-2026-001]</span>
                </p>
              </div>
              <Button variant="ghost" size="sm">
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>

            {/* Info Grid */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Órgão</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">[UPA-CS]</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Modalidade</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">[Licitação Aberta]</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Valor Orçado</p>
                <p className="mt-1 text-xl font-bold text-green-600 dark:text-green-400">R$ [valor]</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Valor Contratado</p>
                <p className="mt-1 text-xl font-bold text-indigo-600 dark:text-indigo-400">R$ [valor]</p>
              </div>
            </div>
          </div>

          {/* Processos (Lotes/Itens) */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <FileText className="h-5 w-5 text-indigo-600" />
                Itens/Processos ({0})
              </h2>
              <Button
                size="sm"
                onClick={() => setShowProcessForm(!showProcessForm)}
              >
                <Plus className="h-4 w-4" />
                Novo Item
              </Button>
            </div>

            {showProcessForm && (
              <div className="mb-4 space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <Input placeholder="Descrição do item" />
                <Input placeholder="Quantidade" type="number" />
                <Input placeholder="Unidade (un, caixa, kg...)" />
                <Input placeholder="Especificações técnicas" />
                <div className="flex gap-2">
                  <Button size="sm">Adicionar</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowProcessForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum item adicionado. Clique em "Novo Item" para começar.
              </p>
            </div>
          </div>

          {/* Checklists */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
              Checklists de Conformidade
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm text-gray-900 dark:text-white">Habilitação Jurídica</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm text-gray-900 dark:text-white">Habilitação Técnica</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm text-gray-900 dark:text-white">Qualificação Econômica</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-4">
          {/* Status Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Status</p>
            <div className="mt-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-gray-900 dark:text-white">[Propostas Abertas]</span>
            </div>
            {editingStatus && (
              <select className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option>draft</option>
                <option>published</option>
                <option>proposals_open</option>
                <option>proposals_ended</option>
                <option>contracts_executed</option>
                <option>closed</option>
              </select>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setEditingStatus(!editingStatus)}
            >
              {editingStatus ? "Salvar" : "Alterar"}
            </Button>
          </div>

          {/* Dates Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400 mb-3">Prazos</p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Publicação:</span>
                <p className="font-medium text-gray-900 dark:text-white">[data]</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Fechamento:</span>
                <p className="font-medium text-gray-900 dark:text-white">[data]</p>
              </div>
            </div>
          </div>

          {/* Alerts Card */}
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-500" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900 dark:text-yellow-200">
                  Prazo de encerramento em 5 dias
                </p>
                <p className="mt-1 text-xs text-yellow-800 dark:text-yellow-300">
                  Não há alertas críticos no momento.
                </p>
              </div>
            </div>
          </div>

          {/* Delete Button */}
          <Button
            variant="dangerous"
            className="w-full"
          >
            <Trash2 className="h-4 w-4" />
            Cancelar Edital
          </Button>
        </div>
      </div>
    </div>
  );
}
