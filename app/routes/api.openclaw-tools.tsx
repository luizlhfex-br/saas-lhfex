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
  claudeTasks,
  personalInvestments,
  seinfeldHabits,
  seinfeldLogs,
  personalGoals,
  pessoas,
  plannedTimeOff,
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

    const summary = `Processos ativos: ${counts.inProgress} em andamento, ${counts.awaitingDocs} aguardando docs, ${counts.customsClearance} em desembaraço, ${counts.inTransit} em trânsito, ${counts.draft} rascunhos. Chegando em 7 dias: ${soon.length}.`;
    return ok({ counts, arrivingSoon: soon, summary });
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
        eta: processes.eta,
        clientName: clients.razaoSocial,
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

    return ok({
      openclawVersion: process.env.OPENCLAW_VERSION ?? "unknown",
      saasVersion: process.env.npm_package_version ?? "unknown",
      openrouter,
      timestamp: new Date().toISOString(),
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
