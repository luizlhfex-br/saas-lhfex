import { useMemo, useState } from "react";
import { data, Form, Link, useActionData, useFetcher, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/crm-pipeline";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { db } from "~/lib/db.server";
import { getCSRFFormState, requireValidCSRF } from "~/lib/csrf.server";
import { clients, dealActivities, deals } from "../../drizzle/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { OperationalHero, OperationalPanel, OperationalStat } from "~/components/ui/operational-page";
import {
  ArrowLeft,
  BellRing,
  Clock3,
  Columns3,
  GripVertical,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

type VisibleStageId = "prospect" | "proposal" | "negotiation" | "won" | "lost";

const PIPELINE_STAGES: Array<{
  id: VisibleStageId;
  label: string;
  borderClass: string;
  surfaceClass: string;
  emptyLabel: string;
}> = [
  {
    id: "prospect",
    label: "Lead",
    borderClass: "border-t-cyan-400",
    surfaceClass: "bg-cyan-500/6",
    emptyLabel: "Sem leads nesta etapa",
  },
  {
    id: "proposal",
    label: "Proposta",
    borderClass: "border-t-amber-400",
    surfaceClass: "bg-amber-500/6",
    emptyLabel: "Nenhuma proposta aberta",
  },
  {
    id: "negotiation",
    label: "Negociacao",
    borderClass: "border-t-fuchsia-400",
    surfaceClass: "bg-fuchsia-500/6",
    emptyLabel: "Nada em negociacao",
  },
  {
    id: "won",
    label: "Fechado",
    borderClass: "border-t-emerald-400",
    surfaceClass: "bg-emerald-500/6",
    emptyLabel: "Nenhum fechamento ainda",
  },
  {
    id: "lost",
    label: "Perdido",
    borderClass: "border-t-rose-400",
    surfaceClass: "bg-rose-500/6",
    emptyLabel: "Nenhuma perda registrada",
  },
];

type DealRow = {
  id: string;
  title: string;
  value: string | null;
  currency: string | null;
  stage: string;
  visibleStage: VisibleStageId;
  notes: string | null;
  nextAction: string | null;
  nextFollowUpAt: Date | string | null;
  lostReason: string | null;
  clientId: string | null;
  clientName: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function getVisibleStage(stage: string): VisibleStageId {
  if (stage === "qualification") return "prospect";
  if (stage === "proposal" || stage === "negotiation" || stage === "won" || stage === "lost") {
    return stage;
  }
  return "prospect";
}

function normalizeStage(stage: string): VisibleStageId {
  if (stage === "proposal" || stage === "negotiation" || stage === "won" || stage === "lost") {
    return stage;
  }
  return "prospect";
}

function formatMoney(value: string | null, currency: string | null) {
  if (!value) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
    minimumFractionDigits: 0,
  }).format(Number(value));
}

function formatDateTime(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateTimestamp(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseNumericInput(rawValue: FormDataEntryValue | null) {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return parsed.toFixed(2);
}

function parseFollowUpInput(rawValue: FormDataEntryValue | null) {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getFollowUpMeta(value: Date | string | null) {
  if (!value) {
    return {
      label: "Sem follow-up",
      className: "border-white/10 bg-white/5 text-slate-300",
      isOverdue: false,
    };
  }

  const now = Date.now();
  const timestamp = getDateTimestamp(value);
  if (timestamp === null) {
    return {
      label: "Sem follow-up",
      className: "border-white/10 bg-white/5 text-slate-300",
      isOverdue: false,
    };
  }

  const diffMs = timestamp - now;
  if (diffMs < 0) {
    return {
      label: `Atrasado desde ${formatDateTime(value)}`,
      className: "border-rose-400/25 bg-rose-500/10 text-rose-200",
      isOverdue: true,
    };
  }

  if (diffMs <= 1000 * 60 * 60 * 24 * 2) {
    return {
      label: `Follow-up em ${formatDateTime(value)}`,
      className: "border-amber-400/25 bg-amber-500/10 text-amber-100",
      isOverdue: false,
    };
  }

  return {
      label: `Follow-up em ${formatDateTime(value)}`,
    className: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
    isOverdue: false,
  };
}

function getQuickMoves(stage: VisibleStageId) {
  switch (stage) {
    case "prospect":
      return [{ id: "proposal" as const, label: "Enviar proposta" }];
    case "proposal":
      return [{ id: "negotiation" as const, label: "Entrar em negociacao" }];
    case "negotiation":
      return [
        { id: "won" as const, label: "Fechar" },
        { id: "lost" as const, label: "Perder" },
      ];
    default:
      return [];
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const { csrfToken, csrfCookieHeader } = await getCSRFFormState(request);

  const [dealRows, clientRows, stageRows] = await Promise.all([
    db
      .select({
        id: deals.id,
        title: deals.title,
        value: deals.value,
        currency: deals.currency,
        stage: deals.stage,
        notes: deals.notes,
        nextAction: deals.nextAction,
        nextFollowUpAt: deals.nextFollowUpAt,
        lostReason: deals.lostReason,
        clientId: deals.clientId,
        clientFantasia: clients.nomeFantasia,
        clientRazao: clients.razaoSocial,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(clients, eq(deals.clientId, clients.id))
      .where(and(eq(deals.companyId, companyId), isNull(deals.deletedAt)))
      .orderBy(desc(deals.updatedAt)),
    db
      .select({
        id: clients.id,
        razaoSocial: clients.razaoSocial,
        nomeFantasia: clients.nomeFantasia,
      })
      .from(clients)
      .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .orderBy(clients.razaoSocial),
    db
      .select({
        stage: deals.stage,
        total: sql<string>`coalesce(sum(${deals.value}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(deals)
      .where(and(eq(deals.companyId, companyId), isNull(deals.deletedAt)))
      .groupBy(deals.stage),
  ]);

  const normalizedDeals: DealRow[] = dealRows.map((row) => ({
    id: row.id,
    title: row.title,
    value: row.value,
    currency: row.currency,
    stage: row.stage,
    visibleStage: getVisibleStage(row.stage),
    notes: row.notes,
    nextAction: row.nextAction,
    nextFollowUpAt: row.nextFollowUpAt,
    lostReason: row.lostReason,
    clientId: row.clientId,
    clientName: row.clientFantasia || row.clientRazao,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  const stageTotals = PIPELINE_STAGES.reduce<Record<VisibleStageId, { count: number; total: number }>>(
    (acc, stage) => {
      acc[stage.id] = { count: 0, total: 0 };
      return acc;
    },
    {
      prospect: { count: 0, total: 0 },
      proposal: { count: 0, total: 0 },
      negotiation: { count: 0, total: 0 },
      won: { count: 0, total: 0 },
      lost: { count: 0, total: 0 },
    },
  );

  for (const row of stageRows) {
    const visibleStage = getVisibleStage(row.stage);
    stageTotals[visibleStage].count += row.count;
    stageTotals[visibleStage].total += Number(row.total || 0);
  }

  return data(
    {
      csrfToken,
      deals: normalizedDeals,
      clients: clientRows.map((client) => ({
        id: client.id,
        label: client.nomeFantasia || client.razaoSocial,
      })),
      stageTotals,
    },
    {
      headers: {
        "Set-Cookie": csrfCookieHeader,
      },
    },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);
  const formData = await request.formData();

  try {
    await requireValidCSRF(request, formData);
  } catch {
    return data({ error: "Sessao do formulario expirou. Atualize a pagina e tente novamente." }, { status: 403 });
  }

  const intent = String(formData.get("intent") || "");

  if (intent === "create") {
    const title = String(formData.get("title") || "").trim();
    const clientId = String(formData.get("clientId") || "").trim() || null;
    const value = parseNumericInput(formData.get("value"));
    const nextAction = String(formData.get("nextAction") || "").trim() || null;
    const nextFollowUpAt = parseFollowUpInput(formData.get("nextFollowUpAt"));
    const notes = String(formData.get("notes") || "").trim() || null;

    if (!title) {
      return data({ error: "Informe o nome da oportunidade." }, { status: 400 });
    }

    if (String(formData.get("value") || "").trim() && value === null) {
      return data({ error: "Valor invalido. Use um numero simples, ex.: 3500 ou 3500.00." }, { status: 400 });
    }

    if (String(formData.get("nextFollowUpAt") || "").trim() && nextFollowUpAt === null) {
      return data({ error: "Data de follow-up invalida." }, { status: 400 });
    }

    if (clientId) {
      const [client] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId), isNull(clients.deletedAt)))
        .limit(1);

      if (!client) {
        return data({ error: "Cliente selecionado nao pertence a empresa ativa." }, { status: 400 });
      }
    }

    const [deal] = await db
      .insert(deals)
      .values({
        companyId,
        clientId,
        title,
        value,
        currency: "BRL",
        stage: "prospect",
        nextAction,
        nextFollowUpAt,
        notes,
        createdBy: user.id,
      })
      .returning({ id: deals.id });

    await db.insert(dealActivities).values({
      dealId: deal.id,
      content: "Oportunidade criada no pipeline",
      type: "created",
      createdBy: user.id,
    });

    return data({ ok: true, created: true });
  }

  if (intent === "move") {
    const dealId = String(formData.get("dealId") || "").trim();
    const stage = normalizeStage(String(formData.get("stage") || ""));

    if (!dealId) {
      return data({ error: "dealId e obrigatorio para mover a oportunidade." }, { status: 400 });
    }

    const [deal] = await db
      .select({ id: deals.id, stage: deals.stage })
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.companyId, companyId), isNull(deals.deletedAt)))
      .limit(1);

    if (!deal) {
      return data({ error: "Oportunidade nao encontrada na empresa ativa." }, { status: 404 });
    }

    await db
      .update(deals)
      .set({
        stage,
        updatedAt: new Date(),
      })
      .where(and(eq(deals.id, dealId), eq(deals.companyId, companyId)));

    await db.insert(dealActivities).values({
      dealId,
      content: `Etapa alterada para ${PIPELINE_STAGES.find((item) => item.id === stage)?.label || "Lead"}`,
      type: "stage_change",
      createdBy: user.id,
    });

    return data({ ok: true });
  }

  if (intent === "delete") {
    const dealId = String(formData.get("dealId") || "").trim();
    if (!dealId) {
      return data({ error: "dealId e obrigatorio para excluir a oportunidade." }, { status: 400 });
    }

    await db
      .update(deals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(deals.id, dealId), eq(deals.companyId, companyId), isNull(deals.deletedAt)));

    return data({ ok: true });
  }

  return data({ error: "Acao invalida no pipeline." }, { status: 400 });
}

export default function CRMPipelinePage({ loaderData }: Route.ComponentProps) {
  const { csrfToken, deals: allDeals, clients: clientList, stageTotals } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const moveFetcher = useFetcher<typeof action>();
  const deleteFetcher = useFetcher<typeof action>();
  const [searchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [dragDealId, setDragDealId] = useState<string | null>(null);

  const groupedDeals = useMemo(() => {
    const groups = PIPELINE_STAGES.reduce<Record<VisibleStageId, DealRow[]>>(
      (acc, stage) => {
        acc[stage.id] = [];
        return acc;
      },
      {
        prospect: [],
        proposal: [],
        negotiation: [],
        won: [],
        lost: [],
      },
    );

    for (const deal of allDeals) {
      groups[deal.visibleStage].push(deal);
    }

    return groups;
  }, [allDeals]);

  const followUps = useMemo(() => {
    const withFollowUp = allDeals
      .filter((deal) => deal.nextFollowUpAt)
      .sort((a, b) => {
        const left = getDateTimestamp(a.nextFollowUpAt) ?? Number.MAX_SAFE_INTEGER;
        const right = getDateTimestamp(b.nextFollowUpAt) ?? Number.MAX_SAFE_INTEGER;
        return left - right;
      });

    return {
      overdue: withFollowUp.filter((deal) => (getDateTimestamp(deal.nextFollowUpAt) ?? 0) < Date.now()).slice(0, 5),
      upcoming: withFollowUp.filter((deal) => (getDateTimestamp(deal.nextFollowUpAt) ?? 0) >= Date.now()).slice(0, 5),
    };
  }, [allDeals]);

  const totalPipelineValue = useMemo(
    () =>
      allDeals
        .filter((deal) => deal.visibleStage !== "lost" && deal.visibleStage !== "won")
        .reduce((sum, deal) => sum + Number(deal.value || 0), 0),
    [allDeals],
  );

  function submitMove(dealId: string, stage: VisibleStageId) {
    const form = new FormData();
    form.set("intent", "move");
    form.set("dealId", dealId);
    form.set("stage", stage);
    form.set("csrf", csrfToken);
    moveFetcher.submit(form, { method: "post" });
  }

  function submitDelete(dealId: string) {
    const form = new FormData();
    form.set("intent", "delete");
    form.set("dealId", dealId);
    form.set("csrf", csrfToken);
    deleteFetcher.submit(form, { method: "post" });
  }

  const actionResult = actionData as { error?: string; created?: boolean } | undefined;
  const moveResult = moveFetcher.data as { error?: string } | undefined;
  const deleteResult = deleteFetcher.data as { error?: string } | undefined;

  const feedback = actionResult?.error || moveResult?.error || deleteResult?.error || null;
  const created = searchParams.get("created") === "1" || actionResult?.created === true;

  return (
    <div className="space-y-6">
      <OperationalHero
        eyebrow="CRM"
        title="Funil comercial"
        description="Use poucas etapas, sempre com proximo passo claro. O objetivo aqui e enxergar quem precisa de proposta, follow-up ou decisao agora."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/crm">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao CRM
              </Link>
            </Button>
            <Button type="button" onClick={() => setShowCreate((current) => !current)}>
              <Plus className="h-4 w-4" />
              Nova oportunidade
            </Button>
          </>
        }
        aside={
          <>
            <OperationalStat
              label="Pipeline aberto"
              value={formatMoney(String(totalPipelineValue.toFixed(2)), "BRL") || "R$ 0"}
              description="Valor estimado entre leads, propostas e negociacoes."
            />
            <OperationalStat
              label="Follow-ups atrasados"
              value={followUps.overdue.length}
              description="Negociacoes que ja deveriam ter sido tocadas novamente."
            />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OperationalStat
          label="Leads"
          value={stageTotals.prospect.count}
          description="Entradas novas ou ainda sem proposta enviada."
        />
        <OperationalStat
          label="Propostas"
          value={stageTotals.proposal.count}
          description="Itens em proposta formal, aguardando avancar."
        />
        <OperationalStat
          label="Negociacao"
          value={stageTotals.negotiation.count}
          description="Deals com conversa ativa de preco, escopo ou prazo."
        />
        <OperationalStat
          label="Fechados no quadro"
          value={stageTotals.won.count}
          description="Oportunidades marcadas como fechadas no pipeline."
        />
      </div>

      {feedback ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </div>
      ) : null}

      {created ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Oportunidade criada no pipeline.
        </div>
      ) : null}

      {showCreate ? (
        <OperationalPanel
          title="Nova oportunidade"
          icon={<Plus className="h-5 w-5" />}
          description="Cadastre somente oportunidades reais. Menos coluna, mais manutencao do que importa."
        >
          <Form method="post" className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="csrf" value={csrfToken} />

            <label className="space-y-2 text-sm text-[var(--app-muted)]">
              <span className="font-medium text-[var(--app-text)]">Titulo da oportunidade</span>
              <input
                type="text"
                name="title"
                required
                placeholder="Ex.: DHL - consultoria de classificacao fiscal"
                className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-cyan-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--app-muted)]">
              <span className="font-medium text-[var(--app-text)]">Cliente</span>
              <select
                name="clientId"
                className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-cyan-400/40"
              >
                <option value="">Sem cliente definido</option>
                {clientList.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-[var(--app-muted)]">
              <span className="font-medium text-[var(--app-text)]">Valor estimado (BRL)</span>
              <input
                type="number"
                name="value"
                step="0.01"
                min="0"
                placeholder="3500"
                className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-cyan-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--app-muted)] lg:col-span-2">
              <span className="font-medium text-[var(--app-text)]">Proximo passo</span>
              <input
                type="text"
                name="nextAction"
                placeholder="Ex.: enviar proposta, cobrar retorno, agendar reuniao"
                className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-cyan-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--app-muted)]">
              <span className="font-medium text-[var(--app-text)]">Follow-up</span>
              <input
                type="datetime-local"
                name="nextFollowUpAt"
                className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-cyan-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--app-muted)] lg:col-span-3">
              <span className="font-medium text-[var(--app-text)]">Observacoes</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Contexto da demanda, objeções, prazo esperado ou qualquer detalhe comercial relevante."
                className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition focus:border-cyan-400/40"
              />
            </label>

            <div className="lg:col-span-3 flex flex-wrap gap-3">
              <Button type="submit" loading={navigation.state === "submitting"}>
                Criar oportunidade
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Fechar
              </Button>
            </div>
          </Form>
        </OperationalPanel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <OperationalPanel
          title="Quadro do pipeline"
          icon={<Columns3 className="h-5 w-5" />}
          description="Arraste ou use os atalhos rapidos. Etapas intermediarias de qualificacao ficam embutidas em Lead."
        >
          <div className="flex gap-4 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage) => {
              const cards = groupedDeals[stage.id];
              const stageTotal = stageTotals[stage.id];

              return (
                <section
                  key={stage.id}
                  className={`min-h-[420px] min-w-[280px] flex-1 rounded-[26px] border border-[var(--app-border)] border-t-4 ${stage.borderClass} ${stage.surfaceClass} p-4`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dealId = event.dataTransfer.getData("dealId");
                    if (dealId) {
                      submitMove(dealId, stage.id);
                    }
                  }}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--app-text)]">{stage.label}</h3>
                      <p className="mt-1 text-xs text-[var(--app-muted)]">
                        {stageTotal.count} oportunidade(s)
                        {stageTotal.total > 0 ? ` · ${formatMoney(String(stageTotal.total.toFixed(2)), "BRL")}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {cards.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[var(--app-muted)]">
                        {stage.emptyLabel}
                      </div>
                    ) : null}

                    {cards.map((deal) => {
                      const followUpMeta = getFollowUpMeta(deal.nextFollowUpAt);
                      const quickMoves = getQuickMoves(stage.id);

                      return (
                        <article
                          key={deal.id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData("dealId", deal.id);
                            setDragDealId(deal.id);
                          }}
                          onDragEnd={() => setDragDealId(null)}
                          className={`rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(20,29,46,0.95))] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.28)] transition ${
                            dragDealId === deal.id ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-white">{deal.title}</p>
                              <p className="text-xs text-slate-400">{deal.clientName || "Cliente nao vinculado"}</p>
                            </div>
                            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                            {deal.value ? (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                                {formatMoney(deal.value, deal.currency)}
                              </span>
                            ) : null}
                            <span className={`rounded-full border px-2.5 py-1 ${followUpMeta.className}`}>
                              {followUpMeta.label}
                            </span>
                          </div>

                          {deal.nextAction ? (
                            <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Proximo passo</p>
                              <p className="mt-1 text-sm text-slate-100">{deal.nextAction}</p>
                            </div>
                          ) : null}

                          {deal.notes ? (
                            <p className="mt-3 text-sm leading-6 text-slate-300">{deal.notes}</p>
                          ) : null}

                          {deal.visibleStage === "lost" && deal.lostReason ? (
                            <p className="mt-3 text-sm text-rose-200">Motivo: {deal.lostReason}</p>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {quickMoves.map((nextStage) => (
                              <Button
                                key={nextStage.id}
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => submitMove(deal.id, nextStage.id)}
                              >
                                {nextStage.label}
                              </Button>
                            ))}
                            <Button type="button" size="sm" variant="danger" onClick={() => submitDelete(deal.id)}>
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </OperationalPanel>

        <div className="space-y-6">
          <OperationalPanel
            title="Agenda comercial"
            icon={<BellRing className="h-5 w-5" />}
            description="Follow-ups atrasados primeiro. Se uma oportunidade nao tem proximo passo, ela tende a esfriar."
          >
            <div className="space-y-4">
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--app-text)]">
                  <Clock3 className="h-4 w-4 text-rose-300" />
                  Atrasados
                </div>
                {followUps.overdue.length === 0 ? (
                  <p className="text-sm text-[var(--app-muted)]">Nenhum follow-up vencido agora.</p>
                ) : (
                  followUps.overdue.map((deal) => (
                    <div key={deal.id} className="rounded-2xl border border-rose-400/18 bg-rose-500/8 px-4 py-3">
                      <p className="text-sm font-semibold text-white">{deal.title}</p>
                      <p className="mt-1 text-xs text-rose-100">{deal.clientName || "Cliente nao vinculado"}</p>
                      <p className="mt-2 text-sm text-rose-50">{deal.nextAction || "Sem proximo passo definido"}</p>
                      <p className="mt-1 text-xs text-rose-100">Prazo: {formatDateTime(deal.nextFollowUpAt)}</p>
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--app-text)]">
                  <Target className="h-4 w-4 text-cyan-300" />
                  Proximos follow-ups
                </div>
                {followUps.upcoming.length === 0 ? (
                  <p className="text-sm text-[var(--app-muted)]">Nenhum follow-up agendado.</p>
                ) : (
                  followUps.upcoming.map((deal) => (
                    <div key={deal.id} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <p className="text-sm font-semibold text-white">{deal.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{deal.clientName || "Cliente nao vinculado"}</p>
                      <p className="mt-2 text-sm text-slate-100">{deal.nextAction || "Sem proximo passo definido"}</p>
                      <p className="mt-1 text-xs text-slate-400">Prazo: {formatDateTime(deal.nextFollowUpAt)}</p>
                    </div>
                  ))
                )}
              </section>
            </div>
          </OperationalPanel>

          <OperationalPanel
            title="Como usar"
            icon={<TrendingUp className="h-5 w-5" />}
            description="Fluxo recomendado para a LHFEX com poucas etapas e manutencao leve."
          >
            <ol className="space-y-3 text-sm leading-6 text-[var(--app-muted)]">
              <li>1. Crie um lead apenas quando houver chance comercial real.</li>
              <li>2. Sempre preencha proximo passo e, se possivel, um follow-up.</li>
              <li>3. Mova para Proposta somente quando a oferta tiver sido enviada.</li>
              <li>4. Use Negociacao quando houver ajuste de preco, prazo ou escopo.</li>
              <li>5. Feche ou perca rapido. Funil parado perde valor.</li>
            </ol>
          </OperationalPanel>
        </div>
      </div>
    </div>
  );
}
