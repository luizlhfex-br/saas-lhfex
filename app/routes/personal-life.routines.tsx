/**
 * GET/POST /personal-life/routines
 * Módulo de Rotinas & Hábitos Pessoais
 *
 * Seções:
 *   1. Hoje — checklist diário com streak
 *   2. Semana — grade 7 dias por rotina
 *   3. Gerenciar — lista completa + CRUD
 */

import { data } from "react-router";
import type { Route } from "./+types/personal-life.routines";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { personalRoutines, routineTracking } from "../../drizzle/schema/personal-life";
import { eq, and, desc, asc, gte } from "drizzle-orm";
import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Plus,
  X,
  Edit,
  Trash2,
  CheckCircle2,
  Circle,
  Heart,
  Calendar,
  Flame,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "~/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────

type RoutineRow = {
  id: string;
  userId: string;
  routineType: string;
  name: string;
  description: string | null;
  frequency: string;
  targetValue: string | null;
  unit: string | null;
  startDate: string | null;
  isActive: boolean | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TrackingRow = {
  id: string;
  routineId: string;
  userId: string;
  date: string;
  completed: boolean;
  value: string | null;
  notes: string | null;
  createdAt: Date;
};

// ── Constants ──────────────────────────────────────────────────────────────

const ROUTINE_TYPE_LABELS: Record<string, string> = {
  exercise: "Exercício",
  meditation: "Meditação",
  reading: "Leitura",
  sleep: "Sono",
  nutrition: "Nutrição",
  learning: "Aprendizado",
  hobby: "Hobby",
};

const ROUTINE_TYPE_EMOJIS: Record<string, string> = {
  exercise: "🏃",
  meditation: "🧘",
  reading: "📚",
  sleep: "😴",
  nutrition: "🥗",
  learning: "💡",
  hobby: "🎨",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Diário",
  weekdays: "Dias úteis",
  weekends: "Fins de semana",
  weekly: "Semanal",
};

const UNIT_LABELS: Record<string, string> = {
  minutes: "minutos",
  pages: "páginas",
  km: "km",
  hours: "horas",
  times: "vezes",
};

const DAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

function formatDisplayDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatTodayFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return DAY_HEADERS[date.getDay()] ?? "—";
}

function calcStreak(
  routineId: string,
  weekTracking: TrackingRow[],
  today: string
): number {
  const sorted = weekTracking
    .filter((t) => t.routineId === routineId && t.completed)
    .map((t) => t.date)
    .sort((a, b) => (a > b ? -1 : 1));

  if (sorted.length === 0) return 0;

  let streak = 0;
  let current = today;

  for (let i = 0; i < 7; i++) {
    if (sorted.includes(current)) {
      streak++;
      const d = new Date(current + "T12:00:00");
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      current = `${y}-${mo}-${day}`;
    } else {
      break;
    }
  }
  return streak;
}

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const today = getTodayString();
  const last7 = getLastNDates(7);
  const sevenDaysAgo = last7[0]!;

  // All active routines for user
  const routines = await db
    .select()
    .from(personalRoutines)
    .where(and(eq(personalRoutines.userId, user.id), eq(personalRoutines.isActive, true)))
    .orderBy(asc(personalRoutines.createdAt));

  // All routines (active + inactive) for manage tab
  const allRoutines = await db
    .select()
    .from(personalRoutines)
    .where(eq(personalRoutines.userId, user.id))
    .orderBy(desc(personalRoutines.createdAt));

  // Today's tracking
  const todayTrackingRaw = await db
    .select()
    .from(routineTracking)
    .where(
      and(
        eq(routineTracking.userId, user.id),
        eq(routineTracking.date, today)
      )
    );

  // Last 7 days tracking
  const weekTrackingRaw = await db
    .select()
    .from(routineTracking)
    .where(
      and(
        eq(routineTracking.userId, user.id),
        gte(routineTracking.date, sevenDaysAgo)
      )
    )
    .orderBy(asc(routineTracking.date));

  // Build todayTracking map: routineId → record
  const todayTracking: Record<string, TrackingRow> = {};
  for (const record of todayTrackingRaw) {
    todayTracking[record.routineId] = record as TrackingRow;
  }

  return {
    user,
    routines: routines as RoutineRow[],
    allRoutines: allRoutines as RoutineRow[],
    todayTracking,
    weekTracking: weekTrackingRaw as TrackingRow[],
    weekDates: last7,
    today,
  };
}

// ── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "create_routine") {
    const name = formData.get("name") as string;
    const routineType = formData.get("routineType") as string;
    const frequency = formData.get("frequency") as string;
    const description = (formData.get("description") as string) || null;
    const targetValueRaw = formData.get("targetValue") as string;
    const targetValue = targetValueRaw ? targetValueRaw : null;
    const unit = (formData.get("unit") as string) || null;
    const startDate = getTodayString();

    if (!name || !routineType || !frequency) {
      return data({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    await db.insert(personalRoutines).values({
      userId: user.id,
      routineType,
      name,
      description,
      frequency,
      targetValue,
      unit,
      startDate,
      isActive: true,
      notes: null,
    });

    return data({ success: true, message: "Rotina criada com sucesso!" });
  }

  if (intent === "edit_routine") {
    const routineId = formData.get("routineId") as string;
    const name = formData.get("name") as string;
    const routineType = formData.get("routineType") as string;
    const frequency = formData.get("frequency") as string;
    const description = (formData.get("description") as string) || null;
    const targetValueRaw = formData.get("targetValue") as string;
    const targetValue = targetValueRaw ? targetValueRaw : null;
    const unit = (formData.get("unit") as string) || null;

    await db
      .update(personalRoutines)
      .set({
        name,
        routineType,
        frequency,
        description,
        targetValue,
        unit,
        updatedAt: new Date(),
      })
      .where(and(eq(personalRoutines.id, routineId), eq(personalRoutines.userId, user.id)));

    return data({ success: true, message: "Rotina atualizada!" });
  }

  if (intent === "toggle_routine") {
    const routineId = formData.get("routineId") as string;
    const currentActive = formData.get("isActive") === "true";

    await db
      .update(personalRoutines)
      .set({ isActive: !currentActive, updatedAt: new Date() })
      .where(and(eq(personalRoutines.id, routineId), eq(personalRoutines.userId, user.id)));

    return data({ success: true });
  }

  if (intent === "delete_routine") {
    const routineId = formData.get("routineId") as string;

    // Delete tracking records first
    await db
      .delete(routineTracking)
      .where(
        and(
          eq(routineTracking.routineId, routineId),
          eq(routineTracking.userId, user.id)
        )
      );

    await db
      .delete(personalRoutines)
      .where(and(eq(personalRoutines.id, routineId), eq(personalRoutines.userId, user.id)));

    return data({ success: true, message: "Rotina removida." });
  }

  if (intent === "check_today") {
    const routineId = formData.get("routineId") as string;
    const valueRaw = formData.get("value") as string;
    const value = valueRaw && valueRaw !== "" ? valueRaw : null;
    const today = getTodayString();

    // Check if a record already exists for today
    const existing = await db
      .select()
      .from(routineTracking)
      .where(
        and(
          eq(routineTracking.routineId, routineId),
          eq(routineTracking.userId, user.id),
          eq(routineTracking.date, today)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(routineTracking)
        .set({ completed: true, value })
        .where(eq(routineTracking.id, existing[0]!.id));
    } else {
      await db.insert(routineTracking).values({
        routineId,
        userId: user.id,
        date: today,
        completed: true,
        value,
        notes: null,
      });
    }

    return data({ success: true });
  }

  if (intent === "uncheck_today") {
    const routineId = formData.get("routineId") as string;
    const today = getTodayString();

    await db
      .update(routineTracking)
      .set({ completed: false })
      .where(
        and(
          eq(routineTracking.routineId, routineId),
          eq(routineTracking.userId, user.id),
          eq(routineTracking.date, today)
        )
      );

    return data({ success: true });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

// ── Modal Component ─────────────────────────────────────────────────────────

function RoutineModal({
  onClose,
  editTarget,
}: {
  onClose: () => void;
  editTarget: RoutineRow | null;
}) {
  const isEdit = !!editTarget;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? "Editar Rotina" : "Nova Rotina"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form method="post" className="space-y-4 px-6 py-5">
          <input type="hidden" name="_intent" value={isEdit ? "edit_routine" : "create_routine"} />
          {isEdit && (
            <input type="hidden" name="routineId" value={editTarget.id} />
          )}

          {/* Nome */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={editTarget?.name ?? ""}
              placeholder="Ex: Corrida matinal, Meditação, Leitura noturna..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-green-400"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              name="routineType"
              required
              defaultValue={editTarget?.routineType ?? "exercise"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="exercise">🏃 Exercício</option>
              <option value="meditation">🧘 Meditação</option>
              <option value="reading">📚 Leitura</option>
              <option value="sleep">😴 Sono</option>
              <option value="nutrition">🥗 Nutrição</option>
              <option value="learning">💡 Aprendizado</option>
              <option value="hobby">🎨 Hobby</option>
            </select>
          </div>

          {/* Frequência */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Frequência <span className="text-red-500">*</span>
            </label>
            <select
              name="frequency"
              required
              defaultValue={editTarget?.frequency ?? "daily"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="daily">Diário</option>
              <option value="weekdays">Dias úteis (Seg–Sex)</option>
              <option value="weekends">Fins de semana (Sáb–Dom)</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>

          {/* Meta (valor + unidade) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Meta (opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="targetValue"
                min="0"
                step="0.01"
                defaultValue={editTarget?.targetValue ?? ""}
                placeholder="Ex: 30"
                className="w-1/2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
              <select
                name="unit"
                defaultValue={editTarget?.unit ?? "minutes"}
                className="w-1/2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="minutes">minutos</option>
                <option value="pages">páginas</option>
                <option value="km">km</option>
                <option value="hours">horas</option>
                <option value="times">vezes</option>
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descrição (opcional)
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={editTarget?.description ?? ""}
              placeholder="Detalhes ou observações sobre esta rotina..."
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
            >
              {isEdit ? "Salvar alterações" : "Criar rotina"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Today Tab ───────────────────────────────────────────────────────────────

function TodayTab({
  routines,
  todayTracking,
  weekTracking,
  today,
}: {
  routines: RoutineRow[];
  todayTracking: Record<string, TrackingRow>;
  weekTracking: TrackingRow[];
  today: string;
}) {
  const displayDate = formatTodayFull(today);
  const completedCount = routines.filter((r) => todayTracking[r.id]?.completed).length;

  return (
    <div className="space-y-4">
      {/* Header + progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-900/50 dark:bg-green-900/20">
        <div>
          <h2 className="text-lg font-bold text-green-900 dark:text-green-200">
            Hoje — {displayDate}
          </h2>
          <p className="mt-0.5 text-sm text-green-700 dark:text-green-400">
            {completedCount} de {routines.length} rotinas concluídas
          </p>
        </div>
        {routines.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-32 overflow-hidden rounded-full bg-green-200 dark:bg-green-800">
              <div
                className="h-full rounded-full bg-green-500 transition-all dark:bg-green-400"
                style={{ width: `${routines.length > 0 ? (completedCount / routines.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">
              {routines.length > 0 ? Math.round((completedCount / routines.length) * 100) : 0}%
            </span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {routines.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <Heart className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-600 dark:text-gray-400">Nenhuma rotina ativa</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Vá para a aba "Gerenciar" para criar sua primeira rotina.
          </p>
        </div>
      )}

      {/* Routine checklist */}
      <div className="space-y-3">
        {routines.map((routine) => {
          const tracking = todayTracking[routine.id];
          const isCompleted = tracking?.completed ?? false;
          const streak = calcStreak(routine.id, weekTracking, today);
          const emoji = ROUTINE_TYPE_EMOJIS[routine.routineType] ?? "⭐";
          const hasTarget = routine.targetValue && routine.unit;

          return (
            <div
              key={routine.id}
              className={`rounded-xl border p-4 transition-all ${
                isCompleted
                  ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/15"
                  : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div className="flex-shrink-0 pt-0.5">
                  {isCompleted ? (
                    <form method="post">
                      <input type="hidden" name="_intent" value="uncheck_today" />
                      <input type="hidden" name="routineId" value={routine.id} />
                      <button
                        type="submit"
                        title="Desmarcar"
                        className="rounded-full text-green-500 transition-transform hover:scale-110 hover:text-green-600 dark:text-green-400"
                      >
                        <CheckCircle2 className="h-7 w-7" />
                      </button>
                    </form>
                  ) : (
                    <form method="post" className="flex items-center gap-2">
                      <input type="hidden" name="_intent" value="check_today" />
                      <input type="hidden" name="routineId" value={routine.id} />
                      {hasTarget && (
                        <input
                          type="number"
                          name="value"
                          min="0"
                          step="0.01"
                          placeholder={`Meta: ${routine.targetValue} ${UNIT_LABELS[routine.unit!] ?? routine.unit}`}
                          className="w-32 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        />
                      )}
                      <button
                        type="submit"
                        title="Marcar como concluído"
                        className="flex-shrink-0 rounded-full text-gray-300 transition-transform hover:scale-110 hover:text-green-500 dark:text-gray-600 dark:hover:text-green-400"
                      >
                        <Circle className="h-7 w-7" />
                      </button>
                    </form>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-gray-900 dark:text-white">
                      {emoji} {routine.name}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {FREQUENCY_LABELS[routine.frequency] ?? routine.frequency}
                    </span>
                    {isCompleted && tracking?.value && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        {tracking.value} {UNIT_LABELS[routine.unit!] ?? routine.unit}
                      </span>
                    )}
                  </div>
                  {routine.description && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                      {routine.description}
                    </p>
                  )}
                  {hasTarget && !isCompleted && (
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      Meta: {routine.targetValue} {UNIT_LABELS[routine.unit!] ?? routine.unit}
                    </p>
                  )}
                </div>

                {/* Streak */}
                {streak > 0 && (
                  <div className="flex-shrink-0 flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                    <Flame className="h-3.5 w-3.5" />
                    {streak}d
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week Tab ─────────────────────────────────────────────────────────────────

function WeekTab({
  routines,
  weekTracking,
  weekDates,
  today,
}: {
  routines: RoutineRow[];
  weekTracking: TrackingRow[];
  weekDates: string[];
  today: string;
}) {
  // Build a lookup: routineId + date -> TrackingRow
  const trackingMap: Record<string, TrackingRow> = {};
  for (const t of weekTracking) {
    trackingMap[`${t.routineId}::${t.date}`] = t;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Últimos 7 dias
        </h2>
      </div>

      {routines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma rotina ativa para exibir.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 min-w-[160px]">
                  Rotina
                </th>
                {weekDates.map((date) => (
                  <th
                    key={date}
                    className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide min-w-[52px] ${
                      date === today
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div>{getDayName(date)}</div>
                    <div className={`text-[10px] font-normal mt-0.5 ${date === today ? "text-indigo-500" : "text-gray-400 dark:text-gray-500"}`}>
                      {formatDisplayDate(date)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {routines.map((routine) => {
                const emoji = ROUTINE_TYPE_EMOJIS[routine.routineType] ?? "⭐";
                return (
                  <tr
                    key={routine.id}
                    className="bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white truncate max-w-[160px]">
                        {emoji} {routine.name}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {ROUTINE_TYPE_LABELS[routine.routineType] ?? routine.routineType}
                      </div>
                    </td>
                    {weekDates.map((date) => {
                      const record = trackingMap[`${routine.id}::${date}`];
                      const isToday = date === today;
                      const isFuture = date > today;

                      let cell: React.ReactNode;
                      if (isFuture) {
                        cell = <span className="text-gray-300 dark:text-gray-600 text-base">○</span>;
                      } else if (!record) {
                        cell = <span className="text-red-400 dark:text-red-500 text-base">❌</span>;
                      } else if (record.completed) {
                        cell = <span className="text-green-500 dark:text-green-400 text-base">✅</span>;
                      } else {
                        cell = <span className="text-red-400 dark:text-red-500 text-base">❌</span>;
                      }

                      return (
                        <td
                          key={date}
                          className={`px-2 py-3 text-center ${
                            isToday
                              ? "bg-indigo-50 dark:bg-indigo-900/15"
                              : ""
                          }`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span>✅</span> Concluída
        </span>
        <span className="flex items-center gap-1.5">
          <span>❌</span> Não concluída
        </span>
        <span className="flex items-center gap-1.5">
          <span>○</span> Futuro / sem registro
        </span>
        <span className="flex items-center gap-1.5 rounded bg-indigo-100 px-2 py-0.5 dark:bg-indigo-900/30 dark:text-indigo-300">
          Fundo azul = hoje
        </span>
      </div>
    </div>
  );
}

// ── Manage Tab ───────────────────────────────────────────────────────────────

function ManageTab({
  allRoutines,
  onAdd,
  onEdit,
}: {
  allRoutines: RoutineRow[];
  onAdd: () => void;
  onEdit: (r: RoutineRow) => void;
}) {
  const active = allRoutines.filter((r) => r.isActive);
  const inactive = allRoutines.filter((r) => !r.isActive);

  const RoutineCard = ({ routine }: { routine: RoutineRow }) => {
    const emoji = ROUTINE_TYPE_EMOJIS[routine.routineType] ?? "⭐";
    const isActive = routine.isActive ?? false;

    return (
      <div
        className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
          isActive
            ? "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            : "border-gray-100 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/50"
        }`}
      >
        {/* Type badge */}
        <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 text-xl dark:from-green-900/30 dark:to-emerald-900/30">
          {emoji}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">
              {routine.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                isActive
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {isActive ? "Ativa" : "Pausada"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>{ROUTINE_TYPE_LABELS[routine.routineType] ?? routine.routineType}</span>
            <span>·</span>
            <span>{FREQUENCY_LABELS[routine.frequency] ?? routine.frequency}</span>
            {routine.targetValue && routine.unit && (
              <>
                <span>·</span>
                <span>
                  Meta: {routine.targetValue} {UNIT_LABELS[routine.unit] ?? routine.unit}
                </span>
              </>
            )}
          </div>
          {routine.description && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
              {routine.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {/* Toggle active */}
          <form method="post">
            <input type="hidden" name="_intent" value="toggle_routine" />
            <input type="hidden" name="routineId" value={routine.id} />
            <input type="hidden" name="isActive" value={String(isActive)} />
            <button
              type="submit"
              title={isActive ? "Pausar rotina" : "Ativar rotina"}
              className={`rounded-lg p-2 transition-colors ${
                isActive
                  ? "text-green-500 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
                  : "text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
              }`}
            >
              {isActive ? (
                <ToggleRight className="h-5 w-5" />
              ) : (
                <ToggleLeft className="h-5 w-5" />
              )}
            </button>
          </form>

          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(routine)}
            title="Editar"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <Edit className="h-4 w-4" />
          </button>

          {/* Delete */}
          <form
            method="post"
            onSubmit={(e) => {
              if (!confirm(`Remover a rotina "${routine.name}" e todo seu histórico?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="_intent" value="delete_routine" />
            <input type="hidden" name="routineId" value={routine.id} />
            <button
              type="submit"
              title="Remover"
              className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Gerenciar Rotinas
        </h2>
        <Button
          type="button"
          onClick={onAdd}
          className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Rotina
        </Button>
      </div>

      {/* Empty state */}
      {allRoutines.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <Heart className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-600 dark:text-gray-400">
            Nenhuma rotina cadastrada ainda
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Crie sua primeira rotina para começar a rastrear seus hábitos.
          </p>
          <Button
            type="button"
            className="mt-4 bg-green-600 text-white hover:bg-green-700"
            onClick={onAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar primeira rotina
          </Button>
        </div>
      )}

      {/* Active routines */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Ativas ({active.length})
          </h3>
          {active.map((r) => (
            <RoutineCard key={r.id} routine={r} />
          ))}
        </div>
      )}

      {/* Inactive routines */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Pausadas ({inactive.length})
          </h3>
          {inactive.map((r) => (
            <RoutineCard key={r.id} routine={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PersonalLifeRoutinesPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { routines, allRoutines, todayTracking, weekTracking, weekDates, today } = loaderData;

  const [activeTab, setActiveTab] = useState<"today" | "week" | "manage">("today");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<RoutineRow | null>(null);

  function openAdd() {
    setEditTarget(null);
    setShowModal(true);
  }

  function openEdit(routine: RoutineRow) {
    setEditTarget(routine);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
  }

  const tabBaseClass =
    "px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none";
  const tabActive =
    "bg-green-600 text-white shadow-sm dark:bg-green-600";
  const tabInactive =
    "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800";

  const completedToday = routines.filter((r) => todayTracking[r.id]?.completed).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/personal-life">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              ❤️ Rotinas & Hábitos
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Construa consistência diária — {completedToday}/{routines.length} hoje
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={openAdd}
          className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Rotina
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900/40 dark:bg-green-900/15">
          <p className="text-xs font-medium text-green-700 dark:text-green-400">Ativas</p>
          <p className="mt-1 text-2xl font-bold text-green-900 dark:text-green-200">{routines.length}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/40 dark:bg-indigo-900/15">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Concluídas hoje</p>
          <p className="mt-1 text-2xl font-bold text-indigo-900 dark:text-indigo-200">{completedToday}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-900/15">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Maior streak</p>
          <p className="mt-1 text-2xl font-bold text-orange-900 dark:text-orange-200">
            {routines.length > 0
              ? Math.max(...routines.map((r) => calcStreak(r.id, weekTracking, today)))
              : 0}
            d
          </p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/40 dark:bg-purple-900/15">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Total cadastradas</p>
          <p className="mt-1 text-2xl font-bold text-purple-900 dark:text-purple-200">{allRoutines.length}</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/50 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("today")}
          className={`${tabBaseClass} ${activeTab === "today" ? tabActive : tabInactive}`}
        >
          ✅ Hoje
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("week")}
          className={`${tabBaseClass} ${activeTab === "week" ? tabActive : tabInactive}`}
        >
          📅 Semana
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("manage")}
          className={`${tabBaseClass} ${activeTab === "manage" ? tabActive : tabInactive}`}
        >
          ⚙️ Gerenciar
        </button>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "today" && (
          <TodayTab
            routines={routines}
            todayTracking={todayTracking}
            weekTracking={weekTracking}
            today={today}
          />
        )}
        {activeTab === "week" && (
          <WeekTab
            routines={routines}
            weekTracking={weekTracking}
            weekDates={weekDates}
            today={today}
          />
        )}
        {activeTab === "manage" && (
          <ManageTab
            allRoutines={allRoutines}
            onAdd={openAdd}
            onEdit={openEdit}
          />
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <RoutineModal onClose={closeModal} editTarget={editTarget} />
      )}
    </div>
  );
}
