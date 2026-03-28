/**
 * OpenClaw Tools API
 *
 * Endpoint exclusivo para o openclaw.ai acessar dados e executar ações no SAAS.
 * Auth: header X-OpenClaw-Key === OPENCLAW_TOOLS_API_KEY
 *
 * GET  /api/openclaw-tools?action=resumo_processos
 * POST /api/openclaw-tools  { action: "criar_cliente", ... }
 */

import type { Route } from "./+types/api.openclaw-tools";
import { db } from "~/lib/db.server";
import { APP_VERSION } from "~/config/version";
import {
  clients,
  deals,
  processes,
  personalFinance,
  promotions,
  missionControlTasks,
  claudeTasks,
  personalInvestments,
  seinfeldHabits,
  seinfeldLogs,
  personalGoals,
  pessoas,
  plannedTimeOff,
  subscriptions,
  invoices,
  radioStations,
} from "../../drizzle/schema";
import { eq, desc, ilike, or, and, isNull, sql, gte, lte } from "drizzle-orm";
import { askAgent } from "~/lib/ai.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import {
  OpenClawActionError,
  createClientFromOpenClaw,
  createDealFromOpenClaw,
  getDealStageLabel,
  normalizeDealStage,
  openProcessFromOpenClaw,
  updateDealFromOpenClaw,
  updateProcessFromOpenClaw,
} from "~/lib/openclaw-saas-actions.server";
import {
  getOpenClawObservabilitySnapshot,
  recordOpenClawHandoff,
  recordOpenClawHeartbeat,
  recordOpenClawRun,
  recordOpenClawWorkItem,
  updateOpenClawWorkItem,
} from "~/lib/openclaw-observability.server";
import {
  createGoogleCalendarEvent,
  createGoogleSheetWithRows,
  getGoogleConnectionStatus,
  searchGoogleDriveFiles,
} from "~/lib/google.server";
import { getSubscriptionHealth, resolveSubscriptionNextDueDate, summarizeSubscriptionTotals } from "~/lib/subscriptions.server";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

function badRequestWithDetails(msg: string, details?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: msg, details: details ?? null }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendSlackAlert(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // non-blocking
  }
}

function checkAuth(request: Request): boolean {
  const key = request.headers.get("X-OpenClaw-Key");
  const expected = process.env.OPENCLAW_TOOLS_API_KEY;
  if (!expected) return false;
  return key === expected;
}

function getUserId(): string {
  return process.env.OPENCLAW_USER_ID || "";
}

const processStatuses = [
  "draft",
  "in_progress",
  "awaiting_docs",
  "customs_clearance",
  "in_transit",
  "delivered",
  "completed",
  "cancelled",
  "pending_approval",
] as const;

type ProcessStatus = (typeof processStatuses)[number];

function isProcessStatus(value: string): value is ProcessStatus {
  return processStatuses.includes(value as ProcessStatus);
}

function normalizePipelineStage(value: string): "prospect" | "proposal" | "negotiation" | "won" | "lost" {
  const stage = normalizeDealStage(value) ?? "prospect";
  if (stage === "proposal" || stage === "negotiation" || stage === "won" || stage === "lost") {
    return stage;
  }
  return "prospect";
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  if (!checkAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";
  const userId = getUserId();
  if (!userId) return badRequest("OPENCLAW_USER_ID not configured");
  const companyId = await getPrimaryCompanyId(userId);

  if (action === "catalogo_acoes") {
    return ok({
      get: [
        { action: "catalogo_acoes", description: "Lista todas as actions GET/POST suportadas pelo endpoint" },
        { action: "system_status", description: "Status do sistema + versoes + saude OpenRouter" },
        { action: "contexto_completo", description: "Contexto agregado para briefing operacional" },
        { action: "resumo_modulos_saas", description: "Resumo por modulo principal do SaaS" },
        { action: "resumo_processos", description: "Resumo de processos e chegadas proximas" },
        { action: "buscar_processos&q=TERMO", description: "Busca processos por referencia, descricao ou cliente" },
        { action: "buscar_clientes&q=TERMO", description: "Busca clientes por razao social, fantasia ou CNPJ" },
        { action: "listar_pipeline", description: "Resumo do funil comercial com oportunidades por etapa e follow-ups" },
        { action: "listar_promocoes", description: "Lista promocoes/sorteios cadastrados" },
        { action: "listar_radios", description: "Lista radios do modulo Radio Monitor" },
        { action: "listar_faturas", description: "Lista faturas do financeiro empresarial" },
        { action: "ver_financeiro_pessoal&mes=YYYY-MM", description: "Resumo financeiro pessoal por mes" },
        { action: "ver_assinaturas", description: "Lista assinaturas da LHFEX e saude de vencimento" },
        { action: "google_status", description: "Status da conexao Google (Drive, Sheets, Calendar)" },
        { action: "google_buscar_drive&q=TERMO", description: "Busca arquivos no Google Drive conectado" },
        { action: "cotacao_dolar", description: "Cotacao USD/BRL" },
        { action: "openclaw_observability", description: "Snapshot de runs, heartbeats, handoffs e work items" },
      ],
      post: [
        { action: "criar_cliente", description: "Cria cliente (aceita CNPJ para enriquecimento)" },
        { action: "criar_deal", description: "Cria oportunidade comercial no pipeline" },
        { action: "atualizar_deal", description: "Atualiza titulo, valor, proximo passo, follow-up ou observacoes do deal" },
        { action: "mover_deal", description: "Move deal para outra etapa do funil" },
        { action: "registrar_followup_deal", description: "Atualiza proximo passo e data de follow-up do deal" },
        { action: "ganhar_deal", description: "Marca oportunidade como fechada" },
        { action: "perder_deal", description: "Marca oportunidade como perdida com motivo" },
        { action: "abrir_processo", description: "Abre processo por cliente/modal/tipo" },
        { action: "atualizar_processo", description: "Atualiza status/campos do processo por referencia/id" },
        { action: "google_criar_evento_calendario", description: "Cria evento no Google Calendar conectado" },
        { action: "google_criar_planilha", description: "Cria planilha simples no Google Sheets com linhas livres" },
        { action: "adicionar_transacao", description: "Adiciona transacao no financeiro pessoal" },
        { action: "ask_agent", description: "Encaminha tarefa para agente especializado" },
        { action: "criar_tarefa_mc", description: "Cria tarefa no Mission Control" },
        { action: "atualizar_tarefa_mc", description: "Atualiza tarefa do Mission Control" },
        { action: "criar_tarefa_claude", description: "Cria tarefa de acompanhamento no backlog Claude" },
        { action: "atualizar_tarefa_claude", description: "Atualiza status/resultado da tarefa Claude" },
        { action: "registrar_run_agente", description: "Registra execucao operacional de agente" },
        { action: "registrar_heartbeat_agente", description: "Registra heartbeat operacional de agente" },
        { action: "registrar_handoff_agente", description: "Registra handoff entre agentes" },
        { action: "registrar_work_item", description: "Cria work item operacional de agente" },
        { action: "atualizar_work_item", description: "Atualiza work item operacional" },
      ],
      examples: {
        get: [
          "/api/openclaw-tools?action=system_status",
          "/api/openclaw-tools?action=buscar_clientes&q=lhfex",
          "/api/openclaw-tools?action=buscar_processos&q=A26-001",
          "/api/openclaw-tools?action=listar_pipeline",
          "/api/openclaw-tools?action=listar_faturas",
          "/api/openclaw-tools?action=google_status",
          "/api/openclaw-tools?action=google_buscar_drive&q=invoice",
        ],
        post: [
          { action: "criar_cliente", cnpj: "62180992000133" },
          {
            action: "criar_deal",
            title: "DHL - consultoria classificacao fiscal",
            clientSearch: "DHL",
            value: 3500,
            currency: "BRL",
            nextAction: "Enviar proposta comercial",
            nextFollowUpAt: "2026-03-29T14:00:00-03:00",
          },
          {
            action: "mover_deal",
            search: "DHL - consultoria classificacao fiscal",
            stage: "proposal",
          },
          { action: "abrir_processo", client: "LHFEX", modal: "aereo", processType: "import" },
          { action: "atualizar_processo", reference: "A26-001", status: "in_progress" },
          {
            action: "google_criar_evento_calendario",
            title: "Reuniao com cliente",
            startDateTime: "2026-03-20T14:00:00-03:00",
            endDateTime: "2026-03-20T15:00:00-03:00",
          },
          {
            action: "google_criar_planilha",
            title: "Resumo LHFEX",
            rows: [
              ["Campo", "Valor"],
              ["Processos ativos", 5],
            ],
          },
        ],
      },
    });
  }

  if (action === "resumo_modulos_saas") {
    const [crmSummary, pipelineSummary, processSummary, financeSummary, promotionSummary, subscriptionSummary, radioSummary] =
      await Promise.all([
        db
          .select({
            total: sql<number>`count(*)::int`,
            ativos: sql<number>`count(*) filter (where status = 'active')::int`,
            prospects: sql<number>`count(*) filter (where status = 'prospect')::int`,
          })
          .from(clients)
          .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt))),
        db
          .select({
            total: sql<number>`count(*)::int`,
            leads: sql<number>`count(*) filter (where stage = 'prospect')::int`,
            qualificacao: sql<number>`count(*) filter (where stage = 'qualification')::int`,
            proposta: sql<number>`count(*) filter (where stage = 'proposal')::int`,
            negociacao: sql<number>`count(*) filter (where stage = 'negotiation')::int`,
            fechados: sql<number>`count(*) filter (where stage = 'won')::int`,
          })
          .from(deals)
          .where(and(eq(deals.companyId, companyId), isNull(deals.deletedAt))),
        db
          .select({
            total: sql<number>`count(*)::int`,
            draft: sql<number>`count(*) filter (where status = 'draft')::int`,
            inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
            inTransit: sql<number>`count(*) filter (where status = 'in_transit')::int`,
            completed: sql<number>`count(*) filter (where status = 'completed')::int`,
          })
          .from(processes)
          .where(and(eq(processes.companyId, companyId), isNull(processes.deletedAt))),
        db
          .select({
            total: sql<number>`count(*)::int`,
            paid: sql<number>`count(*) filter (where status = 'paid')::int`,
            overdue: sql<number>`count(*) filter (where status = 'overdue')::int`,
            totalAmount: sql<string>`coalesce(sum(total), 0)::text`,
          })
          .from(invoices)
          .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt))),
        db
          .select({
            total: sql<number>`count(*)::int`,
            active: sql<number>`count(*) filter (where end_date >= current_date)::int`,
            participated: sql<number>`count(*) filter (where participation_status = 'participated')::int`,
          })
          .from(promotions)
          .where(and(eq(promotions.userId, userId), isNull(promotions.deletedAt))),
        db
          .select({
            total: sql<number>`count(*)::int`,
            active: sql<number>`count(*) filter (where status = 'active')::int`,
            cancelled: sql<number>`count(*) filter (where status = 'cancelled')::int`,
          })
          .from(subscriptions)
          .where(and(eq(subscriptions.companyId, companyId), isNull(subscriptions.deletedAt))),
        db
          .select({
            total: sql<number>`count(*)::int`,
            active: sql<number>`count(*) filter (where is_active = true)::int`,
            monitoringEnabled: sql<number>`count(*) filter (where monitoring_enabled = true)::int`,
          })
          .from(radioStations),
      ]);

    return ok({
      timestamp: new Date().toISOString(),
      modules: {
        crm: crmSummary[0] ?? null,
        pipeline: pipelineSummary[0] ?? null,
        processes: processSummary[0] ?? null,
        financial: financeSummary[0] ?? null,
        promotions: promotionSummary[0] ?? null,
        subscriptions: subscriptionSummary[0] ?? null,
        radioMonitor: radioSummary[0] ?? null,
      },
    });
  }

  // ── resumo_processos ──────────────────────────────────────────────────────
  if (action === "resumo_processos") {
    const [counts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
        awaitingDocs: sql<number>`count(*) filter (where status = 'awaiting_docs')::int`,
        draft: sql<number>`count(*) filter (where status = 'draft')::int`,
        customsClearance: sql<number>`count(*) filter (where status = 'customs_clearance')::int`,
        inTransit: sql<number>`count(*) filter (where status = 'in_transit')::int`,
      })
      .from(processes)
      .where(
        and(
          eq(processes.companyId, companyId),
          isNull(processes.deletedAt),
          or(
            eq(processes.status, "in_progress"),
            eq(processes.status, "awaiting_docs"),
            eq(processes.status, "draft"),
            eq(processes.status, "customs_clearance"),
            eq(processes.status, "in_transit"),
          ),
        ),
      );

    const soon = await db
      .select({
        id: processes.id,
        reference: processes.reference,
        processType: processes.processType,
        status: processes.status,
        eta: processes.eta,
      })
      .from(processes)
      .where(
        and(
          eq(processes.companyId, companyId),
          isNull(processes.deletedAt),
          gte(processes.eta, sql`now()`),
          lte(processes.eta, sql`now() + interval '7 days'`),
        ),
      )
      .orderBy(processes.eta)
      .limit(5);

    const summary = `Processos ativos: ${counts.inProgress} em andamento, ${counts.awaitingDocs} aguardando docs, ${counts.customsClearance} em desembaraço, ${counts.inTransit} em trânsito, ${counts.draft} rascunhos. Chegando em 7 dias: ${soon.length}.`;
    return ok({ counts, arrivingSoon: soon, summary });
  }

  // ── buscar_processos ──────────────────────────────────────────────────────
  if (action === "buscar_processos") {
    const q = url.searchParams.get("q") || "";
    const status = url.searchParams.get("status") || "";
    const normalizedStatus = isProcessStatus(status) ? status : undefined;

    const rows = await db
      .select({
        id: processes.id,
        reference: processes.reference,
        processType: processes.processType,
        status: processes.status,
        description: processes.description,
        eta: processes.eta,
        clientName: clients.razaoSocial,
      })
      .from(processes)
      .leftJoin(clients, eq(processes.clientId, clients.id))
      .where(
        and(
          eq(processes.companyId, companyId),
          isNull(processes.deletedAt),
          normalizedStatus ? eq(processes.status, normalizedStatus) : undefined,
          q
            ? or(
                ilike(processes.reference, `%${q}%`),
                ilike(processes.description, `%${q}%`),
                ilike(clients.razaoSocial, `%${q}%`),
                ilike(clients.nomeFantasia, `%${q}%`),
              )
            : undefined,
        ),
      )
      .orderBy(desc(processes.updatedAt))
      .limit(10);

    return ok({ processes: rows, total: rows.length, hint: "Para detalhes de um processo específico, use action=buscar_processos&q=REFERENCIA" });
  }

  // ── ver_financeiro_pessoal ────────────────────────────────────────────────
  if (action === "ver_financeiro_pessoal") {
    const mes = url.searchParams.get("mes") || new Date().toISOString().slice(0, 7); // YYYY-MM
    const [year, month] = mes.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const rows = await db
      .select()
      .from(personalFinance)
      .where(
        and(
          eq(personalFinance.userId, userId),
          isNull(personalFinance.deletedAt),
          gte(personalFinance.date, startDate),
          lte(personalFinance.date, endDate),
        ),
      )
      .orderBy(desc(personalFinance.date))
      .limit(100);

    const receitas = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
    const despesas = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
    const saldo = receitas - despesas;

    // Group by category
    const byCat: Record<string, number> = {};
    for (const r of rows) {
      byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount);
    }

    return ok({ mes, receitas, despesas, saldo, porCategoria: byCat, transacoes: rows.slice(0, 20) });
  }

  // ── listar_promocoes ──────────────────────────────────────────────────────
  if (action === "listar_promocoes") {
    const status = url.searchParams.get("status") || "";

    const rows = await db
      .select({
        id: promotions.id,
        name: promotions.name,
        company: promotions.company,
        type: promotions.type,
        startDate: promotions.startDate,
        endDate: promotions.endDate,
        prize: promotions.prize,
        participationStatus: promotions.participationStatus,
        source: promotions.source,
      })
      .from(promotions)
      .where(
        and(
          eq(promotions.userId, userId),
          isNull(promotions.deletedAt),
          status ? eq(promotions.participationStatus, status) : undefined,
        ),
      )
      .orderBy(desc(promotions.endDate))
      .limit(30);

    return ok(rows);
  }

  if (action === "ver_assinaturas") {
    const rows = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.companyId, companyId),
          isNull(subscriptions.deletedAt),
        ),
      )
      .orderBy(desc(subscriptions.updatedAt));

    const totals = summarizeSubscriptionTotals(rows);
    const items = rows.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      category: subscription.category,
      valueAmount: subscription.valueAmount,
      valueCurrency: subscription.valueCurrency,
      recurrence: subscription.recurrence,
      paymentMethod: subscription.paymentMethod,
      status: subscription.status,
      dueDay: subscription.dueDay,
      dueDate: subscription.dueDate,
      nextDueDate: resolveSubscriptionNextDueDate(subscription),
      health: getSubscriptionHealth(subscription),
      url: subscription.url,
      loginHint: subscription.loginHint,
      notes: subscription.notes,
    }));

    return ok({
      totals,
      total: items.length,
      subscriptions: items,
    });
  }

  if (action === "google_status") {
    const status = await getGoogleConnectionStatus(userId);
    return ok({
      ...status,
      summary: status.connected
        ? `Google conectado. Drive=${status.services.drive ? "ok" : "nao"} | Sheets=${status.services.sheets ? "ok" : "nao"} | Calendar=${status.services.calendar ? "ok" : "nao"}`
        : "Google nao conectado para este usuario.",
    });
  }

  if (action === "google_buscar_drive") {
    const q = url.searchParams.get("q") || "";
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || 10), 1), 25);
    const files = await searchGoogleDriveFiles({ userId, query: q, pageSize });

    if (files === null) {
      return badRequest("Google Drive nao conectado ou indisponivel");
    }

    return ok({
      total: files.length,
      query: q,
      files,
    });
  }

  if (action === "listar_faturas") {
    const status = url.searchParams.get("status") || "";
    const rows = await db
      .select({
        id: invoices.id,
        number: invoices.number,
        type: invoices.type,
        status: invoices.status,
        currency: invoices.currency,
        total: invoices.total,
        dueDate: invoices.dueDate,
        paidDate: invoices.paidDate,
        clientName: clients.razaoSocial,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          eq(invoices.companyId, companyId),
          isNull(invoices.deletedAt),
          status ? eq(invoices.status, status as "draft" | "sent" | "paid" | "overdue" | "cancelled") : undefined,
        ),
      )
      .orderBy(desc(invoices.updatedAt))
      .limit(50);

    return ok({ total: rows.length, invoices: rows });
  }

  if (action === "listar_radios") {
    const rows = await db
      .select({
        id: radioStations.id,
        name: radioStations.name,
        frequency: radioStations.frequency,
        city: radioStations.city,
        state: radioStations.state,
        websiteUrl: radioStations.websiteUrl,
        instagramUrl: radioStations.instagramUrl,
        contactPhone: radioStations.contactPhone,
        contactWhatsapp: radioStations.contactWhatsapp,
        isActive: radioStations.isActive,
        monitoringEnabled: radioStations.monitoringEnabled,
      })
      .from(radioStations)
      .orderBy(radioStations.name)
      .limit(100);

    return ok({ total: rows.length, stations: rows });
  }

  // ── buscar_clientes ───────────────────────────────────────────────────────
  if (action === "buscar_clientes") {
    const q = url.searchParams.get("q") || "";

    const rows = await db
      .select({
        id: clients.id,
        cnpj: clients.cnpj,
        razaoSocial: clients.razaoSocial,
        nomeFantasia: clients.nomeFantasia,
        clientType: clients.clientType,
        status: clients.status,
        city: clients.city,
        state: clients.state,
      })
      .from(clients)
      .where(
        and(
          eq(clients.companyId, companyId),
          isNull(clients.deletedAt),
          q
            ? or(ilike(clients.razaoSocial, `%${q}%`), ilike(clients.nomeFantasia, `%${q}%`), ilike(clients.cnpj, `%${q}%`))
            : undefined,
        ),
      )
      .orderBy(clients.razaoSocial)
      .limit(20);

    return ok(rows);
  }

  // ── system_status ─────────────────────────────────────────────────────────
  if (action === "listar_pipeline") {
    const rows = await db
      .select({
        id: deals.id,
        title: deals.title,
        stage: deals.stage,
        value: deals.value,
        currency: deals.currency,
        nextAction: deals.nextAction,
        nextFollowUpAt: deals.nextFollowUpAt,
        lostReason: deals.lostReason,
        notes: deals.notes,
        clientName: clients.razaoSocial,
        clientFantasia: clients.nomeFantasia,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(clients, eq(deals.clientId, clients.id))
      .where(and(eq(deals.companyId, companyId), isNull(deals.deletedAt)))
      .orderBy(desc(deals.updatedAt))
      .limit(60);

    const stageMap = {
      prospect: { label: "Lead", count: 0, total: 0 },
      proposal: { label: "Proposta", count: 0, total: 0 },
      negotiation: { label: "Negociacao", count: 0, total: 0 },
      won: { label: "Fechado", count: 0, total: 0 },
      lost: { label: "Perdido", count: 0, total: 0 },
    };

    const overdueFollowUps: Array<Record<string, unknown>> = [];
    const upcomingFollowUps: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const stage = normalizePipelineStage(row.stage);
      stageMap[stage].count += 1;
      stageMap[stage].total += Number(row.value || 0);

      if (row.nextFollowUpAt) {
        const item = {
          id: row.id,
          title: row.title,
          stage,
          stageLabel: getDealStageLabel(stage),
          clientName: row.clientFantasia || row.clientName,
          nextAction: row.nextAction,
          nextFollowUpAt: row.nextFollowUpAt,
        };

        if (row.nextFollowUpAt.getTime() < Date.now()) {
          overdueFollowUps.push(item);
        } else {
          upcomingFollowUps.push(item);
        }
      }
    }

    const orderedStages = [
      { id: "prospect", ...stageMap.prospect },
      { id: "proposal", ...stageMap.proposal },
      { id: "negotiation", ...stageMap.negotiation },
      { id: "won", ...stageMap.won },
      { id: "lost", ...stageMap.lost },
    ];

    return ok({
      totalDeals: rows.length,
      pipelineOpenValue: orderedStages
        .filter((stage) => stage.id !== "won" && stage.id !== "lost")
        .reduce((sum, stage) => sum + stage.total, 0),
      stages: orderedStages,
      overdueFollowUps: overdueFollowUps.slice(0, 10),
      upcomingFollowUps: upcomingFollowUps.slice(0, 10),
      deals: rows.slice(0, 20).map((row) => {
        const stage = normalizePipelineStage(row.stage);
        return {
          id: row.id,
          title: row.title,
          stage,
          stageLabel: getDealStageLabel(stage),
          value: row.value,
          currency: row.currency,
          nextAction: row.nextAction,
          nextFollowUpAt: row.nextFollowUpAt,
          lostReason: row.lostReason,
          notes: row.notes,
          clientName: row.clientFantasia || row.clientName,
        };
      }),
      summary: `Pipeline com ${stageMap.prospect.count} leads, ${stageMap.proposal.count} em proposta, ${stageMap.negotiation.count} em negociacao e ${overdueFollowUps.length} follow-ups atrasados.`,
    });
  }

  if (action === "system_status") {
    const legacyOpenClawVersion =
      process.env.OPENCLAW_VERSION ?? process.env.OPENCLAW_TARGET_VERSION ?? "2026.3.13";
    const hermesVersion = process.env.HERMES_VERSION ?? null;

    let openrouter: Record<string, unknown> = {};
    try {
      const res = await fetch("https://openrouter.ai/api/v1/key", {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: Record<string, unknown> };
        openrouter = json.data || {};
      }
    } catch {
      openrouter = { error: "unreachable" };
    }

    // Slack alert if OpenRouter usage is high
    const limitRemaining = openrouter.limit_remaining as number | undefined;
    const usageDaily = openrouter.usage_daily as number | undefined;
    if (typeof limitRemaining === "number" && typeof usageDaily === "number") {
      const total = limitRemaining + usageDaily;
      const pct = total > 0 ? Math.round((limitRemaining / total) * 100) : 100;
      if (pct < 20) {
        await sendSlackAlert(`⚠️ *OpenRouter Free* — apenas ${pct}% do limite restante (${limitRemaining} req). Considere recarregar.`);
      }
    }

    const now = new Date();
    const timestampSaoPaulo = now.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return ok({
      agentRuntime: "Hermes Agent",
      hermesVersion,
      openclawVersion: legacyOpenClawVersion,
      legacyOpenclawVersion: legacyOpenClawVersion,
      saasVersion: APP_VERSION,
      openrouter,
      timestamp: now.toISOString(),
      timestampSaoPaulo,
      timezone: "America/Sao_Paulo",
    });
  }

  if (action === "listar_tarefas_claude") {
    const tasks = await db
      .select()
      .from(claudeTasks)
      .where(eq(claudeTasks.userId, userId))
      .orderBy(desc(claudeTasks.updatedAt))
      .limit(10);
    return ok({ tasks });
  }

  if (action === "listar_tarefas_pendentes") {
    const tasks = await db
      .select()
      .from(claudeTasks)
      .where(and(eq(claudeTasks.userId, userId), eq(claudeTasks.status, "pending")))
      .orderBy(claudeTasks.createdAt)
      .limit(5);
    return ok({ tasks });
  }

  // ── cotacao_dolar ─────────────────────────────────────────────────────────
  if (action === "cotacao_dolar") {
    try {
      const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
        signal: AbortSignal.timeout(5000),
      });
      const data = (await res.json()) as {
        USDBRL?: { bid: string; ask: string; high: string; low: string; timestamp: string };
      };
      const usd = data.USDBRL;
      return ok({ bid: usd?.bid, ask: usd?.ask, high: usd?.high, low: usd?.low, timestamp: usd?.timestamp });
    } catch {
      return ok({ error: "Falha ao buscar cotação do dólar" });
    }
  }

  // ── ver_investimentos ─────────────────────────────────────────────────────
  if (action === "ver_investimentos") {
    try {
      const rows = await db
        .select({
          id: personalInvestments.id,
          assetType: personalInvestments.assetType,
          assetName: personalInvestments.assetName,
          ticker: personalInvestments.ticker,
          quantity: personalInvestments.quantity,
          purchasePrice: personalInvestments.purchasePrice,
          purchaseDate: personalInvestments.purchaseDate,
          currentPrice: personalInvestments.currentPrice,
          currentValue: personalInvestments.currentValue,
          gainLoss: personalInvestments.gainLoss,
          gainLossPercent: personalInvestments.gainLossPercent,
          broker: personalInvestments.broker,
          notes: personalInvestments.notes,
        })
        .from(personalInvestments)
        .where(and(eq(personalInvestments.userId, userId), isNull(personalInvestments.deletedAt)))
        .orderBy(personalInvestments.assetType, desc(personalInvestments.currentValue));

      const byType: Record<string, { count: number; totalValue: number }> = {};
      let totalPortfolio = 0;
      for (const r of rows) {
        const val = Number(r.currentValue ?? 0);
        totalPortfolio += val;
        if (!byType[r.assetType]) byType[r.assetType] = { count: 0, totalValue: 0 };
        byType[r.assetType].count += 1;
        byType[r.assetType].totalValue += val;
      }

      return ok({ total: rows.length, totalPortfolio, porTipo: byType, investimentos: rows });
    } catch (err) {
      return ok({ available: false, error: String(err) });
    }
  }

  // ── ver_habitos ───────────────────────────────────────────────────────────
  if (action === "ver_habitos") {
    try {
      const habits = await db
        .select()
        .from(seinfeldHabits)
        .where(and(eq(seinfeldHabits.userId, userId), eq(seinfeldHabits.active, true)))
        .orderBy(seinfeldHabits.createdAt);

      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const logs = await db
        .select()
        .from(seinfeldLogs)
        .where(
          and(
            eq(seinfeldLogs.userId, userId),
            gte(seinfeldLogs.date, thirtyDaysAgo.toISOString().slice(0, 10)),
            lte(seinfeldLogs.date, today.toISOString().slice(0, 10)),
          ),
        )
        .orderBy(desc(seinfeldLogs.date));

      const habitResults = habits.map((habit) => {
        const habitLogs = logs
          .filter((l) => l.habitId === habit.id && l.done)
          .map((l) => l.date)
          .sort()
          .reverse();

        let streak = 0;
        const checkDate = new Date(today);
        for (let i = 0; i <= 30; i++) {
          const dateStr = checkDate.toISOString().slice(0, 10);
          if (habitLogs.includes(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (i === 0) {
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

        return { ...habit, streakAtual: streak, completadosUltimos30Dias: habitLogs.length };
      });

      return ok({ habitos: habitResults, totalAtivos: habits.length });
    } catch (err) {
      return ok({ available: false, error: String(err) });
    }
  }

  // ── ver_objetivos ─────────────────────────────────────────────────────────
  if (action === "ver_objetivos") {
    try {
      const rows = await db
        .select()
        .from(personalGoals)
        .where(and(eq(personalGoals.userId, userId), eq(personalGoals.status, "in_progress")))
        .orderBy(personalGoals.deadline, desc(personalGoals.updatedAt))
        .limit(20);
      return ok({ total: rows.length, objetivos: rows });
    } catch (err) {
      return ok({ available: false, error: String(err) });
    }
  }

  // ── ver_pessoas ───────────────────────────────────────────────────────────
  if (action === "ver_pessoas") {
    try {
      const q = url.searchParams.get("q") || "";
      const rows = await db
        .select({
          id: pessoas.id,
          nomeCompleto: pessoas.nomeCompleto,
          nascimento: pessoas.nascimento,
          celular: pessoas.celular,
          email: pessoas.email,
          instagram: pessoas.instagram,
          endereco: pessoas.endereco,
          notas: pessoas.notas,
        })
        .from(pessoas)
        .where(
          and(
            eq(pessoas.userId, userId),
            isNull(pessoas.deletedAt),
            q ? or(ilike(pessoas.nomeCompleto, `%${q}%`), ilike(pessoas.email, `%${q}%`)) : undefined,
          ),
        )
        .orderBy(pessoas.nomeCompleto)
        .limit(30);
      return ok({ total: rows.length, pessoas: rows });
    } catch (err) {
      return ok({ available: false, error: String(err) });
    }
  }

  // ── ver_folgas ────────────────────────────────────────────────────────────
  if (action === "ver_folgas") {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const rows = await db
        .select()
        .from(plannedTimeOff)
        .where(
          and(
            eq(plannedTimeOff.userId, userId),
            gte(plannedTimeOff.startDate, sixMonthsAgo.toISOString().slice(0, 10)),
          ),
        )
        .orderBy(plannedTimeOff.startDate);

      const futuras = rows.filter((r) => r.startDate >= today);
      const passadas = rows.filter((r) => r.startDate < today);
      return ok({ futuras, passadasRecentes: passadas.slice(-5), total: rows.length });
    } catch (err) {
      return ok({ available: false, error: String(err) });
    }
  }

  // ── ver_tarefas_mc ────────────────────────────────────────────────────────
  if (action === "ver_tarefas_mc") {
    try {
      const tasks = await db
        .select()
        .from(missionControlTasks)
        .where(and(eq(missionControlTasks.userId, userId), isNull(missionControlTasks.deletedAt)))
        .orderBy(missionControlTasks.createdAt);

      const grouped = {
        inbox: tasks.filter((t) => t.column === "inbox"),
        todo: tasks.filter((t) => t.column === "todo"),
        inProgress: tasks.filter((t) => t.column === "in_progress"),
        review: tasks.filter((t) => t.column === "review"),
        blocked: tasks.filter((t) => t.column === "blocked"),
        done: tasks
          .filter((t) => t.column === "done")
          .sort((a, b) => {
            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, 10),
      };

      const totalAtivas = tasks.filter((t) => t.column !== "done").length;
      return ok({ grouped, totalAtivas, totalDone: tasks.filter((t) => t.column === "done").length });
    } catch (err) {
      return ok({ available: false, error: String(err) });
    }
  }

  // ── contexto_completo ─────────────────────────────────────────────────────
  if (action === "contexto_completo") {
    const mesAtual = new Date().toISOString().slice(0, 7);
    const [year, month] = mesAtual.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const [resumoData, cotacaoData, financeiroData, promocoesData, tarefasMcData, habitosData, objetivosData] =
      await Promise.allSettled([
        // 1. Resumo processos
        (async () => {
          const [counts] = await db
            .select({
              total: sql<number>`count(*)::int`,
              inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
              awaitingDocs: sql<number>`count(*) filter (where status = 'awaiting_docs')::int`,
              draft: sql<number>`count(*) filter (where status = 'draft')::int`,
              customsClearance: sql<number>`count(*) filter (where status = 'customs_clearance')::int`,
              inTransit: sql<number>`count(*) filter (where status = 'in_transit')::int`,
            })
            .from(processes)
            .where(
              and(
                eq(processes.companyId, companyId),
                isNull(processes.deletedAt),
                or(
                  eq(processes.status, "in_progress"),
                  eq(processes.status, "awaiting_docs"),
                  eq(processes.status, "draft"),
                  eq(processes.status, "customs_clearance"),
                  eq(processes.status, "in_transit"),
                ),
              ),
            );
          const soon = await db
            .select({ id: processes.id, reference: processes.reference, eta: processes.eta, status: processes.status })
            .from(processes)
            .where(
              and(
                eq(processes.companyId, companyId),
                isNull(processes.deletedAt),
                gte(processes.eta, sql`now()`),
                lte(processes.eta, sql`now() + interval '7 days'`),
              ),
            )
            .orderBy(processes.eta)
            .limit(5);
          return { counts, arrivingSoon: soon };
        })(),
        // 2. Cotação dólar
        fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { signal: AbortSignal.timeout(5000) })
          .then((r) => r.json())
          .then(
            (d: { USDBRL?: { bid: string; ask: string; high: string; low: string; timestamp: string } }) => d.USDBRL,
          ),
        // 3. Financeiro pessoal mês atual
        (async () => {
          const rows = await db
            .select()
            .from(personalFinance)
            .where(
              and(
                eq(personalFinance.userId, userId),
                isNull(personalFinance.deletedAt),
                gte(personalFinance.date, startDate),
                lte(personalFinance.date, endDate),
              ),
            )
            .orderBy(desc(personalFinance.date))
            .limit(100);
          const receitas = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
          const despesas = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
          return { mes: mesAtual, receitas, despesas, saldo: receitas - despesas, totalTransacoes: rows.length };
        })(),
        // 4. Promoções participando
        db
          .select({
            id: promotions.id,
            name: promotions.name,
            company: promotions.company,
            endDate: promotions.endDate,
            participationStatus: promotions.participationStatus,
          })
          .from(promotions)
          .where(
            and(
              eq(promotions.userId, userId),
              isNull(promotions.deletedAt),
              eq(promotions.participationStatus, "participated"),
            ),
          )
          .orderBy(desc(promotions.endDate))
          .limit(10),
        // 5. Tarefas Mission Control
        (async () => {
          const tasks = await db
            .select()
            .from(missionControlTasks)
            .where(and(eq(missionControlTasks.userId, userId), isNull(missionControlTasks.deletedAt)))
            .orderBy(missionControlTasks.createdAt);
          return {
            inbox: tasks.filter((t) => t.column === "inbox"),
            todo: tasks.filter((t) => t.column === "todo"),
            inProgress: tasks.filter((t) => t.column === "in_progress"),
            review: tasks.filter((t) => t.column === "review"),
            blocked: tasks.filter((t) => t.column === "blocked"),
            totalAtivas: tasks.filter((t) => t.column !== "done").length,
          };
        })(),
        // 6. Hábitos com streak
        (async () => {
          const habits = await db
            .select()
            .from(seinfeldHabits)
            .where(and(eq(seinfeldHabits.userId, userId), eq(seinfeldHabits.active, true)));
          const today = new Date();
          const dateFrom = new Date(today);
          dateFrom.setDate(today.getDate() - 30);
          const logs = await db
            .select()
            .from(seinfeldLogs)
            .where(
              and(
                eq(seinfeldLogs.userId, userId),
                gte(seinfeldLogs.date, dateFrom.toISOString().slice(0, 10)),
                lte(seinfeldLogs.date, today.toISOString().slice(0, 10)),
              ),
            );
          return habits.map((habit) => {
            const habitLogs = logs
              .filter((l) => l.habitId === habit.id && l.done)
              .map((l) => l.date)
              .sort()
              .reverse();
            let streak = 0;
            const checkDate = new Date(today);
            for (let i = 0; i <= 30; i++) {
              const dateStr = checkDate.toISOString().slice(0, 10);
              if (habitLogs.includes(dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
              } else if (i === 0) {
                checkDate.setDate(checkDate.getDate() - 1);
              } else {
                break;
              }
            }
            return { id: habit.id, name: habit.name, emoji: habit.emoji, streakAtual: streak };
          });
        })(),
        // 7. Objetivos em andamento
        db
          .select({
            id: personalGoals.id,
            title: personalGoals.title,
            category: personalGoals.category,
            targetValue: personalGoals.targetValue,
            currentValue: personalGoals.currentValue,
            unit: personalGoals.unit,
            deadline: personalGoals.deadline,
            priority: personalGoals.priority,
          })
          .from(personalGoals)
          .where(and(eq(personalGoals.userId, userId), eq(personalGoals.status, "in_progress")))
          .orderBy(personalGoals.deadline)
          .limit(10),
      ]);

    return ok({
      timestamp: new Date().toISOString(),
      resumo: resumoData.status === "fulfilled" ? resumoData.value : null,
      cotacao: cotacaoData.status === "fulfilled" ? cotacaoData.value : null,
      financeiro: financeiroData.status === "fulfilled" ? financeiroData.value : null,
      promocoes: promocoesData.status === "fulfilled" ? promocoesData.value : null,
      tarefasMc: tarefasMcData.status === "fulfilled" ? tarefasMcData.value : null,
      habitos: habitosData.status === "fulfilled" ? habitosData.value : null,
      objetivos: objetivosData.status === "fulfilled" ? objetivosData.value : null,
    });
  }

  if (action === "openclaw_observability") {
    const snapshot = await getOpenClawObservabilitySnapshot(companyId);
    return ok(snapshot);
  }

  return badRequest(`Unknown action: ${action}`);
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  if (!checkAuth(request)) return unauthorized();

  const userId = getUserId();
  if (!userId) return badRequest("OPENCLAW_USER_ID not configured");
  const companyId = await getPrimaryCompanyId(userId);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const act = body.action as string;

  // ── criar_cliente ─────────────────────────────────────────────────────────
  if (act === "criar_cliente") {
    try {
      const result = await createClientFromOpenClaw({
        companyId,
        userId,
        input: body,
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }

  }

  // ── abrir_processo ────────────────────────────────────────────────────────
  if (act === "criar_deal") {
    try {
      const result = await createDealFromOpenClaw({
        companyId,
        userId,
        input: body,
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }

  }

  if (act === "atualizar_deal") {
    try {
      const result = await updateDealFromOpenClaw({
        companyId,
        userId,
        input: body,
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }

  }

  if (act === "mover_deal") {
    try {
      const result = await updateDealFromOpenClaw({
        companyId,
        userId,
        input: {
          ...body,
          stage: String(body.stage || ""),
        },
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }

  }

  if (act === "registrar_followup_deal") {
    try {
      const result = await updateDealFromOpenClaw({
        companyId,
        userId,
        input: {
          ...body,
          nextAction: body.nextAction,
          nextFollowUpAt: body.nextFollowUpAt,
        },
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }

  }

  if (act === "ganhar_deal") {
    try {
      const result = await updateDealFromOpenClaw({
        companyId,
        userId,
        input: {
          ...body,
          stage: "won",
        },
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }

  }

  if (act === "perder_deal") {
    try {
      const result = await updateDealFromOpenClaw({
        companyId,
        userId,
        input: {
          ...body,
          stage: "lost",
        },
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }

  }

  if (act === "abrir_processo") {
    try {
      const result = await openProcessFromOpenClaw({
        companyId,
        userId,
        input: body,
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }

  }

  // ── adicionar_transacao ───────────────────────────────────────────────────
  if (act === "atualizar_processo") {
    try {
      const result = await updateProcessFromOpenClaw({
        companyId,
        userId,
        input: body,
      });
      return ok(result);
    } catch (error) {
      if (error instanceof OpenClawActionError) {
        return badRequestWithDetails(error.message, error.details);
      }
      throw error;
    }
  }

  if (act === "google_criar_evento_calendario") {
    const title = String(body.title || "").trim();
    const startDateTime = String(body.startDateTime || "").trim();
    const endDateTime = String(body.endDateTime || "").trim();
    const timeZone = String(body.timeZone || "America/Sao_Paulo").trim() || "America/Sao_Paulo";
    const description = String(body.description || "").trim();
    const location = String(body.location || "").trim();
    const remindersMinutes = Array.isArray(body.remindersMinutes)
      ? body.remindersMinutes.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0)
      : [];

    if (!title || !startDateTime || !endDateTime) {
      return badRequest("title, startDateTime e endDateTime sao obrigatorios");
    }

    const created = await createGoogleCalendarEvent(userId, {
      title,
      description: description || undefined,
      location: location || undefined,
      startDateTime,
      endDateTime,
      timeZone,
      remindersMinutes,
    });

    if (!created) {
      return badRequest("Falha ao criar evento no Google Calendar");
    }

    return ok({
      success: true,
      message: `Evento '${title}' criado no Google Calendar`,
      event: {
        ...created,
        title,
        startDateTime,
        endDateTime,
        timeZone,
      },
    });
  }

  if (act === "google_criar_planilha") {
    const title = String(body.title || "").trim();
    const sheetName = String(body.sheetName || "Sheet1").trim() || "Sheet1";
    const rowsInput = Array.isArray(body.rows) ? body.rows : [];

    if (!title) {
      return badRequest("title e obrigatorio");
    }

    if (rowsInput.length === 0) {
      return badRequest("rows e obrigatorio e deve conter ao menos uma linha");
    }

    const rows = rowsInput.map((row) =>
      Array.isArray(row)
        ? row.map((cell) =>
            cell === null || cell === undefined || typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean"
              ? cell
              : JSON.stringify(cell)
          )
        : [JSON.stringify(row)],
    );

    const created = await createGoogleSheetWithRows({
      userId,
      title,
      sheetName,
      rows,
      folderId: typeof body.folderId === "string" ? body.folderId : undefined,
    });

    if (!created) {
      return badRequest("Falha ao criar planilha no Google Sheets");
    }

    return ok({
      success: true,
      message: `Planilha '${title}' criada com ${created.rowCount} linha(s)`,
      sheet: created,
    });
  }

  if (act === "registrar_run_agente") {
    const { agentId, status, provider, model } = body as Record<string, string>;
    if (!agentId) return badRequest("agentId e obrigatorio");

    const result = await recordOpenClawRun({
      companyId,
      agentId,
      agentName: (body.agentName as string) || undefined,
      agentRole: (body.agentRole as string) || undefined,
      provider,
      model,
      status: status || "running",
      input: (body.input as Record<string, unknown>) || null,
      output: (body.output as Record<string, unknown>) || null,
      errorMessage: (body.errorMessage as string) || null,
      promptTokens: typeof body.promptTokens === "number" ? body.promptTokens : null,
      completionTokens: typeof body.completionTokens === "number" ? body.completionTokens : null,
      totalTokens: typeof body.totalTokens === "number" ? body.totalTokens : null,
      startedAt: body.startedAt ? new Date(String(body.startedAt)) : undefined,
      finishedAt: body.finishedAt ? new Date(String(body.finishedAt)) : null,
      createdBy: userId,
    });
    return ok({ success: true, runId: result.id });
  }

  if (act === "registrar_heartbeat_agente") {
    const { agentId, status, provider, model, summary } = body as Record<string, string>;
    if (!agentId) return badRequest("agentId e obrigatorio");

    const result = await recordOpenClawHeartbeat({
      companyId,
      agentId,
      agentName: (body.agentName as string) || undefined,
      status: status || "healthy",
      provider,
      model,
      summary: summary || null,
      details: (body.details as Record<string, unknown>) || null,
      checkedAt: body.checkedAt ? new Date(String(body.checkedAt)) : undefined,
      createdBy: userId,
    });
    return ok({ success: true, heartbeatId: result.id });
  }

  if (act === "registrar_handoff_agente") {
    const { toAgentId, objective } = body as Record<string, string>;
    if (!toAgentId || !objective) return badRequest("toAgentId e objective sao obrigatorios");

    const result = await recordOpenClawHandoff({
      companyId,
      fromAgentId: (body.fromAgentId as string) || null,
      toAgentId,
      status: (body.status as string) || "requested",
      objective,
      context: (body.context as Record<string, unknown>) || null,
      dataConsulted: (body.dataConsulted as Record<string, unknown>) || null,
      expectedDelivery: (body.expectedDelivery as string) || null,
      criteria: (body.criteria as string) || null,
      riskKnown: (body.riskKnown as string) || null,
      result: (body.result as Record<string, unknown>) || null,
      completedAt: body.completedAt ? new Date(String(body.completedAt)) : null,
      createdBy: userId,
    });
    return ok({ success: true, handoffId: result.id });
  }

  if (act === "registrar_work_item") {
    const { agentId, title } = body as Record<string, string>;
    if (!agentId || !title) return badRequest("agentId e title sao obrigatorios");

    const result = await recordOpenClawWorkItem({
      companyId,
      agentId,
      processId: (body.processId as string) || null,
      title,
      description: (body.description as string) || null,
      status: (body.status as string) || "backlog",
      priority: (body.priority as string) || "medium",
      source: (body.source as string) || null,
      context: (body.context as Record<string, unknown>) || null,
      dueAt: body.dueAt ? new Date(String(body.dueAt)) : null,
      completedAt: body.completedAt ? new Date(String(body.completedAt)) : null,
      createdBy: userId,
    });
    return ok({ success: true, workItemId: result.id });
  }

  if (act === "atualizar_work_item") {
    const { workItemId } = body as Record<string, string>;
    if (!workItemId) return badRequest("workItemId e obrigatorio");

    await updateOpenClawWorkItem({
      companyId,
      workItemId,
      status: (body.status as string) || undefined,
      priority: (body.priority as string) || undefined,
      title: body.title as string | undefined,
      description: body.description === undefined ? undefined : (body.description as string | null),
      source: body.source === undefined ? undefined : (body.source as string | null),
      context: body.context === undefined ? undefined : (body.context as Record<string, unknown> | null),
      dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(String(body.dueAt)) : null,
      completedAt: body.completedAt === undefined ? undefined : body.completedAt ? new Date(String(body.completedAt)) : null,
    });

    return ok({ success: true });
  }

  if (act === "adicionar_transacao") {
    const { type, amount, description, category, date } = body as Record<string, unknown>;
    if (!type || !amount || !description || !category) {
      return badRequest("type, amount, description e category são obrigatórios");
    }

    await db.insert(personalFinance).values({
      userId,
      date: (date as string) || new Date().toISOString().slice(0, 10),
      type: type as string,
      category: category as string,
      description: description as string,
      amount: String(amount),
      currency: "BRL",
    });

    return ok({ success: true });
  }

  // ── ask_agent ─────────────────────────────────────────────────────────────
  if (act === "ask_agent") {
    const { agentId, message } = body as Record<string, string>;
    if (!agentId || !message) return badRequest("agentId e message são obrigatórios");

    const result = await askAgent(agentId, message, userId, { feature: "chat" });
    return ok({ success: true, agentId, response: result.content, model: result.model });
  }

  // ── criar_tarefa_mc ───────────────────────────────────────────────────────
  if (act === "criar_tarefa_mc") {
    const { title, description, priority, column } = body as Record<string, string>;
    if (!title) return badRequest("title é obrigatório");

    const [task] = await db
      .insert(missionControlTasks)
      .values({
        userId,
        title,
        description: description || null,
        priority: (priority as "low" | "medium" | "high" | "urgent") || "medium",
        column: (column as string) || "inbox",
        source: "openclaw",
        sourceAgent: "openclaw",
      })
      .returning({ id: missionControlTasks.id });

    return ok({ success: true, taskId: task.id });
  }

  // ── atualizar_tarefa_mc ───────────────────────────────────────────────────
  if (act === "atualizar_tarefa_mc") {
    const { taskId, column, notes } = body as Record<string, string>;
    if (!taskId) return badRequest("taskId é obrigatório");

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (column) updates.column = column;
    if (notes !== undefined) updates.notes = notes;
    if (column === "done") updates.completedAt = new Date();

    await db
      .update(missionControlTasks)
      .set(updates)
      .where(eq(missionControlTasks.id, taskId));

    return ok({ success: true });
  }

  // ── criar_tarefa_claude ───────────────────────────────────────────────────
  if (act === "criar_tarefa_claude") {
    const { prompt, source } = body as { prompt?: string; source?: string };
    if (!prompt) return badRequest("prompt é obrigatório");
    const [task] = await db
      .insert(claudeTasks)
      .values({ userId, prompt, source: source || "openclaw" })
      .returning({ id: claudeTasks.id, status: claudeTasks.status });
    return ok({ success: true, id: task.id, status: task.status });
  }

  // ── atualizar_tarefa_claude ───────────────────────────────────────────────
  if (act === "atualizar_tarefa_claude") {
    const { id, status, result, errorMsg } = body as { id?: string; status?: string; result?: string; errorMsg?: string };
    if (!id || !status) return badRequest("id e status são obrigatórios");
    await db
      .update(claudeTasks)
      .set({ status, result: result || null, errorMsg: errorMsg || null, updatedAt: new Date() })
      .where(and(eq(claudeTasks.id, id), eq(claudeTasks.userId, userId)));
    return ok({ success: true });
  }

  return badRequest(`Unknown action: ${act}`);
}
