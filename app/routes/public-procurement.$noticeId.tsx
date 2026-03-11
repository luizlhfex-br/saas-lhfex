/**
 * GET /public-procurement/$noticeId
 * Detail page para um edital
 */

import { useState } from "react";
import { Form, useFetcher, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/public-procurement.$noticeId";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import {
  publicProcurementNotices,
  publicProcurementProcesses,
  publicProcurementHistory,
} from "drizzle/schema";
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

const NOTICE_STATUS_OPTIONS = [
  "draft",
  "published",
  "proposals_open",
  "proposals_ended",
  "contracts_executed",
  "closed",
  "cancelled",
] as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const noticeId = String(params.noticeId || "");
  const [notice] = await db
    .select()
    .from(publicProcurementNotices)
    .where(
      and(
        eq(publicProcurementNotices.id, noticeId),
        eq(publicProcurementNotices.userId, user.id),
        isNull(publicProcurementNotices.deletedAt)
      )
    )
    .limit(1);

  if (!notice) {
    throw new Response("Not found", { status: 404 });
  }

  const [processes, history] = await Promise.all([
    db
      .select()
      .from(publicProcurementProcesses)
      .where(eq(publicProcurementProcesses.noticeId, notice.id))
      .orderBy(publicProcurementProcesses.lotNumber, publicProcurementProcesses.itemNumber),
    db
      .select()
      .from(publicProcurementHistory)
      .where(eq(publicProcurementHistory.noticeId, notice.id))
      .orderBy(desc(publicProcurementHistory.createdAt))
      .limit(20),
  ]);

  return { notice, processes, history };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const noticeId = String(formData.get("noticeId") || "");

  const [notice] = await db
    .select()
    .from(publicProcurementNotices)
    .where(
      and(
        eq(publicProcurementNotices.id, noticeId),
        eq(publicProcurementNotices.userId, user.id),
        isNull(publicProcurementNotices.deletedAt)
      )
    )
    .limit(1);

  if (!notice) {
    throw new Response("Not found", { status: 404 });
  }

  if (intent === "update-status") {
    const newStatus = String(formData.get("status") || "").trim();
    const reason = String(formData.get("reason") || "Mudança manual de status").trim();

    if (newStatus && newStatus !== notice.status) {
      await db
        .update(publicProcurementNotices)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(publicProcurementNotices.id, notice.id));

      await db.insert(publicProcurementHistory).values({
        noticeId: notice.id,
        changeType: "status_change",
        previousValue: JSON.stringify({ status: notice.status }),
        newValue: JSON.stringify({ status: newStatus }),
        reason,
        changedBy: user.id,
      });
    }
  }

  if (intent === "add-process") {
    const description = String(formData.get("description") || "").trim();
    const quantity = String(formData.get("quantity") || "").trim();
    const unit = String(formData.get("unit") || "").trim();
    const specifications = String(formData.get("specifications") || "").trim();
    const lotNumber = Number(formData.get("lotNumber") || 1);
    const itemNumber = Number(formData.get("itemNumber") || 1);

    if (description && quantity && unit) {
      const [created] = await db
        .insert(publicProcurementProcesses)
        .values({
          noticeId: notice.id,
          lotNumber,
          itemNumber,
          description,
          quantity,
          unit,
          specifications: specifications || null,
          status: "pending",
        })
        .returning();

      await db.insert(publicProcurementHistory).values({
        noticeId: notice.id,
        changeType: "process_added",
        newValue: JSON.stringify({
          processId: created.id,
          lotNumber: created.lotNumber,
          itemNumber: created.itemNumber,
          description: created.description,
        }),
        reason: "Item adicionado ao edital",
        changedBy: user.id,
      });
    }
  }

  if (intent === "cancel-notice") {
    const reason = String(formData.get("reason") || "Cancelamento manual").trim();

    if (notice.status !== "cancelled") {
      await db
        .update(publicProcurementNotices)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(publicProcurementNotices.id, notice.id));

      await db.insert(publicProcurementHistory).values({
        noticeId: notice.id,
        changeType: "cancellation",
        previousValue: JSON.stringify({ status: notice.status }),
        newValue: JSON.stringify({ status: "cancelled" }),
        reason,
        changedBy: user.id,
      });
    }
  }

  return { success: true };
}

export default function PublicProcurementDetailPage() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { notice, processes, history } = useLoaderData<typeof loader>();
  const [editingStatus, setEditingStatus] = useState(false);
  const [showProcessForm, setShowProcessForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/public-procurement")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{notice.title}</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Processo: <span className="font-mono font-semibold">{notice.processNumber}</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditingStatus((v) => !v)}>
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Órgão</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{notice.organizationName}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Modalidade</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{notice.modalityLabel}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Valor Orçado</p>
                <p className="mt-1 text-xl font-bold text-green-600 dark:text-green-400">
                  R$ {Number(notice.budgetEstimate || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Valor Contratado</p>
                <p className="mt-1 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                  R$ {Number(notice.contractedValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {editingStatus && (
              <fetcher.Form method="post" className="mt-5 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="intent" value="update-status" />
                <input type="hidden" name="noticeId" value={notice.id} />
                <select
                  name="status"
                  defaultValue={notice.status}
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  {NOTICE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <Input name="reason" placeholder="Motivo da mudança" />
                <Button size="sm" type="submit">Salvar status</Button>
              </fetcher.Form>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <FileText className="h-5 w-5 text-indigo-600" />
                Itens/Processos ({processes.length})
              </h2>
              <Button size="sm" onClick={() => setShowProcessForm((v) => !v)}>
                <Plus className="h-4 w-4" />
                Novo Item
              </Button>
            </div>

            {showProcessForm && (
              <Form method="post" className="mb-4 space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <input type="hidden" name="intent" value="add-process" />
                <input type="hidden" name="noticeId" value={notice.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="lotNumber" type="number" defaultValue={1} placeholder="Lote" />
                  <Input name="itemNumber" type="number" defaultValue={1} placeholder="Item" />
                </div>
                <Input name="description" required placeholder="Descrição do item" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="quantity" required type="number" step="0.01" placeholder="Quantidade" />
                  <Input name="unit" required placeholder="Unidade (un, caixa, kg...)" />
                </div>
                <Input name="specifications" placeholder="Especificações técnicas" />
                <div className="flex gap-2">
                  <Button size="sm" type="submit">Adicionar</Button>
                  <Button size="sm" variant="outline" type="button" onClick={() => setShowProcessForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </Form>
            )}

            <div className="space-y-2">
              {processes.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum item adicionado.</p>
              ) : (
                processes.map((process) => (
                  <div key={process.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Lote {process.lotNumber} • Item {process.itemNumber} • {process.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {Number(process.quantity).toLocaleString("pt-BR")} {process.unit} • status: {process.status}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
              Histórico de Mudanças
            </h2>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Sem histórico recente.</p>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
                    <p className="font-medium text-gray-900 dark:text-white">{entry.changeType}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.reason || "Sem justificativa"} • {new Date(entry.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Status</p>
            <div className="mt-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-gray-900 dark:text-white">{notice.status}</span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-3 text-xs font-medium uppercase text-gray-600 dark:text-gray-400">Prazos</p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Publicação:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {notice.publicationDate ? new Date(notice.publicationDate).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Fechamento:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {notice.closureDate ? new Date(notice.closureDate).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-500" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900 dark:text-yellow-200">Atenção aos prazos do edital</p>
                <p className="mt-1 text-xs text-yellow-800 dark:text-yellow-300">
                  Verifique mudanças de status e checklist de conformidade.
                </p>
              </div>
            </div>
          </div>

          <Form method="post" className="w-full">
            <input type="hidden" name="intent" value="cancel-notice" />
            <input type="hidden" name="noticeId" value={notice.id} />
            <input type="hidden" name="reason" value="Cancelamento pela tela de detalhe" />
            <Button variant="dangerous" className="w-full" type="submit">
              <Trash2 className="h-4 w-4" />
              Cancelar Edital
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
