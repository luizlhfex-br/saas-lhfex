/**
 * GET/POST /personal-life/clean-days
 * Dia Limpo — Streak Tracker (privado)
 *
 * Interface GitHub-contributions para rastreamento de dias limpos.
 * Sem nome de vício — apenas "Dia Limpo".
 */

import { data } from "react-router";
import type { Route } from "./+types/personal-life.clean-days";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { cleanDays } from "../../drizzle/schema/clean-days";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { ArrowLeft, Flame, Trophy, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTodayBrasilia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function getDateRange(months = 12): { start: string; end: string } {
  const end = getTodayBrasilia();
  const d = new Date(end);
  d.setMonth(d.getMonth() - months + 1);
  d.setDate(1);
  const start = d.toISOString().slice(0, 10);
  return { start, end };
}

function computeStreak(days: Array<{ date: string; isClean: boolean }>): {
  current: number;
  record: number;
} {
  const map = new Map(days.map((d) => [d.date, d.isClean]));
  const today = getTodayBrasilia();

  // Current streak — count backwards from today
  let current = 0;
  const d = new Date(today);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (map.get(key) === true) {
      current++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Record streak
  let record = 0;
  let running = 0;
  for (const day of days.sort((a, b) => a.date.localeCompare(b.date))) {
    if (day.isClean) {
      running++;
      record = Math.max(record, running);
    } else {
      running = 0;
    }
  }

  return { current, record };
}

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const { start, end } = getDateRange(13); // 13 months for full year grid

  const rows = await db
    .select({ date: cleanDays.date, isClean: cleanDays.isClean })
    .from(cleanDays)
    .where(
      and(
        eq(cleanDays.userId, user.id),
        gte(cleanDays.date, start),
        lte(cleanDays.date, end)
      )
    )
    .orderBy(desc(cleanDays.date));

  const today = getTodayBrasilia();
  const todayEntry = rows.find((r) => r.date === today);
  const { current, record } = computeStreak(rows);

  return {
    days: rows,
    today,
    todayEntry: todayEntry ?? null,
    streak: current,
    record,
    totalClean: rows.filter((r) => r.isClean).length,
  };
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const dateStr = String(form.get("date") ?? getTodayBrasilia());
  const notes = String(form.get("notes") ?? "") || null;

  if (intent === "mark_clean" || intent === "mark_relapse") {
    const isClean = intent === "mark_clean";

    // Upsert: insert or update if exists
    const existing = await db
      .select({ id: cleanDays.id })
      .from(cleanDays)
      .where(and(eq(cleanDays.userId, user.id), eq(cleanDays.date, dateStr)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(cleanDays)
        .set({ isClean, notes, updatedAt: new Date() })
        .where(and(eq(cleanDays.userId, user.id), eq(cleanDays.date, dateStr)));
    } else {
      await db.insert(cleanDays).values({
        userId: user.id,
        date: dateStr,
        isClean,
        notes,
      });
    }

    return data({ ok: true });
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}

// ── Component ─────────────────────────────────────────────────────────────────

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function CleanDaysPage() {
  const { days, today, todayEntry, streak, record, totalClean } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const [notes, setNotes] = useState("");

  const isSubmitting = fetcher.state !== "idle";

  // Build a map for quick lookup
  const dayMap = new Map(days.map((d) => [d.date, d.isClean]));

  // Generate the 12-month grid (weeks as columns, days as rows)
  const gridDays = buildGrid(today);

  function handleMark(intent: "mark_clean" | "mark_relapse") {
    fetcher.submit(
      { intent, date: today, notes },
      { method: "post" }
    );
  }

  const todayStatus = todayEntry?.isClean === true ? "clean"
    : todayEntry?.isClean === false ? "relapse"
    : "pending";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/personal-life" className="text-[var(--app-muted)] hover:text-[var(--app-text)]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--app-text)]">🌱 Dia Limpo</h1>
          <p className="text-sm text-[var(--app-muted)]">Rastreamento pessoal — privado</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-center shadow-[var(--app-card-shadow)]">
          <div className="flex items-center justify-center gap-1.5 text-orange-500 dark:text-orange-400">
            <Flame className="h-5 w-5" />
            <span className="text-2xl font-bold">{streak}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--app-muted)]">dias seguidos</p>
        </div>

        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-center shadow-[var(--app-card-shadow)]">
          <div className="flex items-center justify-center gap-1.5 text-yellow-500 dark:text-yellow-400">
            <Trophy className="h-5 w-5" />
            <span className="text-2xl font-bold">{record}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--app-muted)]">recorde</p>
        </div>

        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-center shadow-[var(--app-card-shadow)]">
          <div className="flex items-center justify-center gap-1.5 text-emerald-500 dark:text-emerald-400">
            <Calendar className="h-5 w-5" />
            <span className="text-2xl font-bold">{totalClean}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--app-muted)]">dias limpos</p>
        </div>
      </div>

      {/* Today's Action */}
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
        <h2 className="mb-3 text-sm font-semibold text-[var(--app-text)]">Hoje — {formatDate(today)}</h2>

        {todayStatus === "clean" && (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Dia limpo registrado ✅</span>
          </div>
        )}

        {todayStatus === "relapse" && (
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Recaída registrada — amanhã é um novo dia 💪</span>
          </div>
        )}

        {todayStatus === "pending" && (
          <p className="mb-4 text-sm text-[var(--app-muted)]">Como foi hoje?</p>
        )}

        <div className="mt-3 space-y-3">
          {todayStatus === "pending" && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nota opcional (opcional, privado)..."
              className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/30"
              rows={2}
            />
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={isSubmitting || todayStatus === "clean"}
              onClick={() => handleMark("mark_clean")}
              className={cn(
                "flex-1",
                todayStatus === "clean" ? "opacity-50" : ""
              )}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {todayStatus === "clean" ? "Marcado ✅" : "✅ Dia limpo"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || todayStatus === "relapse"}
              onClick={() => handleMark("mark_relapse")}
              className={cn(
                "flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20",
                todayStatus === "relapse" ? "opacity-50" : ""
              )}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {todayStatus === "relapse" ? "Registrado" : "Recaída"}
            </Button>
          </div>
        </div>
      </div>

      {/* Contribution Grid */}
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-card-shadow)]">
        <h2 className="mb-4 text-sm font-semibold text-[var(--app-text)]">Histórico — 12 meses</h2>

        <div className="overflow-x-auto">
          <div className="flex gap-1" style={{ minWidth: "600px" }}>
            {gridDays.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) =>
                  day ? (
                    <div
                      key={di}
                      title={`${day} — ${
                        dayMap.get(day) === true ? "✅ Dia limpo"
                        : dayMap.get(day) === false ? "❌ Recaída"
                        : "Não marcado"
                      }`}
                      className={cn(
                        "h-3 w-3 rounded-sm transition-colors",
                        dayMap.get(day) === true
                          ? "bg-emerald-500 dark:bg-emerald-400"
                          : dayMap.get(day) === false
                          ? "bg-red-400 dark:bg-red-500"
                          : day > today
                          ? "bg-transparent"
                          : "bg-[var(--app-border)] dark:bg-white/10"
                      )}
                    />
                  ) : (
                    <div key={di} className="h-3 w-3" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-[var(--app-muted)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--app-border)] dark:bg-white/10" />
            Não marcado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
            Dia limpo
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400 dark:bg-red-500" />
            Recaída
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Grid builder (52 semanas, coluna = semana, linha = dia da semana) ─────────

function buildGrid(today: string): Array<Array<string | null>> {
  // Gera 12 meses para trás a partir de hoje
  const end = new Date(today);
  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() + 1);

  // Ajustar para começar no domingo da semana do start
  const startDow = start.getDay(); // 0=dom
  start.setDate(start.getDate() - startDow);

  const weeks: Array<Array<string | null>> = [];
  let current = new Date(start);

  while (current <= end) {
    const week: Array<string | null> = [];
    for (let d = 0; d < 7; d++) {
      const key = current.toISOString().slice(0, 10);
      week.push(key <= today ? key : null);
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    if (current > end && current.getDay() === 0) break;
  }

  return weeks;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
