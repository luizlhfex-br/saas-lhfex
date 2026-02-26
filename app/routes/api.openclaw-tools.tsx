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
import {
  clients,
  contacts,
  processes,
  processTimeline,
  personalFinance,
  promotions,
  missionControlTasks,
} from "../../drizzle/schema";
import { eq, desc, ilike, or, and, isNull, sql, gte, lte } from "drizzle-orm";
import { askAgent } from "~/lib/ai.server";

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

function checkAuth(request: Request): boolean {
  const key = request.headers.get("X-OpenClaw-Key");
  const expected = process.env.OPENCLAW_TOOLS_API_KEY;
  if (!expected) return false;
  return key === expected;
}

function getUserId(): string {
  return process.env.OPENCLAW_USER_ID || "";
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  if (!checkAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";
  const userId = getUserId();

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
          isNull(processes.deletedAt),
          gte(processes.eta, sql`now()`),
          lte(processes.eta, sql`now() + interval '7 days'`),
        ),
      )
      .orderBy(processes.eta)
      .limit(5);

    return ok({ counts, arrivingSoon: soon });
  }

  // ── buscar_processos ──────────────────────────────────────────────────────
  if (action === "buscar_processos") {
    const q = url.searchParams.get("q") || "";
    const status = url.searchParams.get("status") || "";

    const conditions: ReturnType<typeof eq>[] = [isNull(processes.deletedAt) as ReturnType<typeof eq>];
    if (status) conditions.push(eq(processes.status, status) as ReturnType<typeof eq>);

    const rows = await db
      .select({
        id: processes.id,
        reference: processes.reference,
        processType: processes.processType,
        status: processes.status,
        description: processes.description,
        totalValue: processes.totalValue,
        currency: processes.currency,
        incoterm: processes.incoterm,
        eta: processes.eta,
        clientName: clients.razaoSocial,
        createdAt: processes.createdAt,
      })
      .from(processes)
      .leftJoin(clients, eq(processes.clientId, clients.id))
      .where(
        and(
          ...conditions,
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
      .limit(20);

    return ok(rows);
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
  if (action === "system_status") {
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

    return ok({
      openclawVersion: process.env.OPENCLAW_VERSION ?? "unknown",
      saasVersion: process.env.npm_package_version ?? "unknown",
      openrouter,
      timestamp: new Date().toISOString(),
    });
  }

  return badRequest(`Unknown action: ${action}`);
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  if (!checkAuth(request)) return unauthorized();

  const userId = getUserId();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const act = body.action as string;

  // ── criar_cliente ─────────────────────────────────────────────────────────
  if (act === "criar_cliente") {
    const { cnpj, razaoSocial, nomeFantasia, clientType, contato, telefone, email } = body as Record<string, string>;
    if (!razaoSocial) return badRequest("razaoSocial obrigatório");

    // Check duplicate CNPJ
    if (cnpj) {
      const existing = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.cnpj, cnpj), isNull(clients.deletedAt)))
        .limit(1);
      if (existing.length > 0) return badRequest(`Cliente com CNPJ ${cnpj} já existe`);
    }

    const [client] = await db
      .insert(clients)
      .values({
        cnpj: cnpj || "",
        razaoSocial,
        nomeFantasia: nomeFantasia || null,
        clientType: (clientType as "importer" | "exporter" | "both") || "importer",
        status: "active",
        createdBy: userId,
      })
      .returning({ id: clients.id, reference: clients.razaoSocial });

    // Create primary contact if provided
    if (contato || telefone || email) {
      await db.insert(contacts).values({
        clientId: client.id,
        name: contato || razaoSocial,
        phone: telefone || null,
        email: email || null,
        isPrimary: true,
        createdBy: userId,
      });
    }

    return ok({ success: true, clientId: client.id, razaoSocial });
  }

  // ── abrir_processo ────────────────────────────────────────────────────────
  if (act === "abrir_processo") {
    const { processType, clientSearch, description, incoterm, totalValue, currency } = body as Record<string, unknown>;
    if (!processType || !clientSearch) return badRequest("processType e clientSearch são obrigatórios");

    // Find client
    const clientRows = await db
      .select({ id: clients.id, razaoSocial: clients.razaoSocial })
      .from(clients)
      .where(
        and(
          isNull(clients.deletedAt),
          or(
            ilike(clients.razaoSocial, `%${clientSearch}%`),
            ilike(clients.nomeFantasia, `%${clientSearch}%`),
            ilike(clients.cnpj, `%${clientSearch}%`),
          ),
        ),
      )
      .limit(3);

    if (clientRows.length === 0) return badRequest(`Nenhum cliente encontrado: ${clientSearch}`);
    if (clientRows.length > 1) {
      return badRequest(`Múltiplos clientes encontrados: ${clientRows.map((c) => c.razaoSocial).join(", ")}. Seja mais específico.`);
    }

    const client = clientRows[0];
    const typePrefix = processType === "import" ? "IMP" : processType === "export" ? "EXP" : "SRV";
    const year = new Date().getFullYear();

    // Generate next reference number
    const [{ maxRef }] = await db
      .select({ maxRef: sql<number>`coalesce(max(cast(split_part(reference, '-', 3) as integer)), 0)` })
      .from(processes)
      .where(ilike(processes.reference, `${typePrefix}-${year}-%`));

    const nextNum = String((maxRef || 0) + 1).padStart(4, "0");
    const reference = `${typePrefix}-${year}-${nextNum}`;

    const [proc] = await db
      .insert(processes)
      .values({
        reference,
        processType: processType as "import" | "export" | "services",
        status: "draft",
        clientId: client.id,
        description: (description as string) || null,
        incoterm: (incoterm as string) || null,
        totalValue: totalValue ? String(totalValue) : null,
        currency: (currency as string) || "USD",
        createdBy: userId,
      })
      .returning({ id: processes.id });

    await db.insert(processTimeline).values({
      processId: proc.id,
      event: "Processo criado via OpenClaw",
      createdBy: userId,
    });

    return ok({ success: true, processId: proc.id, reference, clientName: client.razaoSocial });
  }

  // ── adicionar_transacao ───────────────────────────────────────────────────
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

  return badRequest(`Unknown action: ${act}`);
}
