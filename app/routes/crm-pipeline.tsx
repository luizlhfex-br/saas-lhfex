import { useState } from "react";
import { Form, Link, useActionData, useNavigation, useRevalidator } from "react-router";
import type { Route } from "./+types/crm-pipeline";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { deals, clients, dealActivities } from "../../drizzle/schema";
import { eq, isNull, desc, sql, and } from "drizzle-orm";
import { data } from "react-router";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Plus, X, GripVertical, DollarSign, Building2, MessageSquare } from "lucide-react";

const STAGES = [
  { id: "prospect", label: "Prospects", color: "border-t-gray-400", bg: "bg-gray-50 dark:bg-gray-800/50" },
  { id: "qualification", label: "Qualificação", color: "border-t-blue-500", bg: "bg-blue-50/30 dark:bg-blue-900/10" },
  { id: "proposal", label: "Proposta", color: "border-t-yellow-500", bg: "bg-yellow-50/30 dark:bg-yellow-900/10" },
  { id: "negotiation", label: "Negociação", color: "border-t-purple-500", bg: "bg-purple-50/30 dark:bg-purple-900/10" },
  { id: "won", label: "Ganho ✅", color: "border-t-green-500", bg: "bg-green-50/30 dark:bg-green-900/10" },
  { id: "lost", label: "Perdido ❌", color: "border-t-red-500", bg: "bg-red-50/30 dark:bg-red-900/10" },
] as const;

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const allDeals = await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      currency: deals.currency,
      stage: deals.stage,
      notes: deals.notes,
      clientId: deals.clientId,
      clientName: clients.nomeFantasia,
      clientRazao: clients.razaoSocial,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .where(isNull(deals.deletedAt))
    .orderBy(desc(deals.updatedAt));

  const clientList = await db
    .select({ id: clients.id, razaoSocial: clients.razaoSocial, nomeFantasia: clients.nomeFantasia })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(clients.razaoSocial);

  // Stage totals
  const stageTotals = await db
    .select({
      stage: deals.stage,
      total: sql<number>`coalesce(sum(${deals.value}::numeric), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(deals)
    .where(isNull(deals.deletedAt))
    .groupBy(deals.stage);

  const totalsMap: Record<string, { total: number; count: number }> = {};
  for (const s of stageTotals) {
    totalsMap[s.stage] = { total: Number(s.total), count: s.count };
  }

  return { deals: allDeals, clients: clientList, stageTotals: totalsMap };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const title = formData.get("title") as string;
    const clientId = formData.get("clientId") as string;
    const value = formData.get("value") as string;
    const stage = (formData.get("stage") as string) || "prospect";

    if (!title) return data({ error: "Título é obrigatório" }, { status: 400 });

    await db.insert(deals).values({
      title,
      clientId: clientId || null,
      value: value || null,
      stage: stage as any,
      createdBy: user.id,
    });

    return data({ ok: true });
  }

  if (intent === "move") {
    const dealId = formData.get("dealId") as string;
    const newStage = formData.get("stage") as string;

    await db.update(deals).set({
      stage: newStage as any,
      updatedAt: new Date(),
    }).where(eq(deals.id, dealId));

    await db.insert(dealActivities).values({
      dealId,
      content: `Movido para: ${STAGES.find(s => s.id === newStage)?.label || newStage}`,
      type: "stage_change",
      createdBy: user.id,
    });

    return data({ ok: true });
  }

  if (intent === "delete") {
    const dealId = formData.get("dealId") as string;
    await db.update(deals).set({ deletedAt: new Date() }).where(eq(deals.id, dealId));
    return data({ ok: true });
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}

export default function CRMPipelinePage({ loaderData }: Route.ComponentProps) {
  const { deals: allDeals, clients: clientList, stageTotals } = loaderData;
  const [showCreate, setShowCreate] = useState(false);
  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const navigation = useNavigation();

  const fmtValue = (value: string | null, currency: string | null) => {
    if (!value) return "";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
    }).format(Number(value));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/crm" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Funil de Vendas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Arraste os cards entre as colunas</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" /> Novo Deal
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <Form method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="create" />
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Título *</label>
              <input type="text" name="title" required placeholder="Ex: Importação de eletrônicos"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>
            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Cliente</label>
              <select name="clientId" className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="">Selecione...</option>
                {clientList.map((c) => <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Valor (USD)</label>
              <input type="number" name="value" step="0.01" placeholder="0.00"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            </div>
            <Button type="submit" loading={navigation.state === "submitting"}>Criar</Button>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" />
            </Button>
          </Form>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageDeals = allDeals.filter((d) => d.stage === stage.id);
          const stageStats = stageTotals[stage.id];

          return (
            <div
              key={stage.id}
              className={`flex min-w-[280px] flex-1 flex-col rounded-xl border-t-4 ${stage.color} border border-gray-200 ${stage.bg} dark:border-gray-800`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dealId = e.dataTransfer.getData("dealId");
                if (dealId && dealId !== stage.id) {
                  const form = new FormData();
                  form.set("intent", "move");
                  form.set("dealId", dealId);
                  form.set("stage", stage.id);
                  fetch("", { method: "POST", body: form }).then(() => window.location.reload());
                }
              }}
            >
              {/* Column header */}
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{stage.label}</h3>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {stageDeals.length}
                  </span>
                </div>
                {stageStats && stageStats.total > 0 && (
                  <p className="mt-0.5 text-xs font-mono text-gray-400">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(stageStats.total)}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 p-3">
                {stageDeals.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-xs text-gray-400 dark:border-gray-700">
                    Arraste deals aqui
                  </div>
                )}
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("dealId", deal.id);
                      setDragDealId(deal.id);
                    }}
                    onDragEnd={() => setDragDealId(null)}
                    className={`group cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing dark:border-gray-700 dark:bg-gray-900 ${
                      dragDealId === deal.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{deal.title}</p>
                      <GripVertical className="h-4 w-4 shrink-0 text-gray-300 opacity-0 group-hover:opacity-100" />
                    </div>
                    {deal.clientName && (
                      <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Building2 className="h-3 w-3" />
                        {deal.clientName || deal.clientRazao}
                      </p>
                    )}
                    {deal.value && (
                      <p className="mt-1 flex items-center gap-1 font-mono text-sm font-semibold text-green-600 dark:text-green-400">
                        <DollarSign className="h-3.5 w-3.5" />
                        {fmtValue(deal.value, deal.currency)}
                      </p>
                    )}

                    {/* Stage move buttons */}
                    <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {STAGES.filter(s => s.id !== stage.id && s.id !== "lost").slice(0, 3).map((s) => (
                        <Form key={s.id} method="post" className="inline">
                          <input type="hidden" name="intent" value="move" />
                          <input type="hidden" name="dealId" value={deal.id} />
                          <input type="hidden" name="stage" value={s.id} />
                          <button type="submit" className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                            → {s.label.replace(" ✅", "").replace(" ❌", "")}
                          </button>
                        </Form>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
