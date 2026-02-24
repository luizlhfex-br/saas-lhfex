/**
 * GET/POST /personal-life/goals
 * Módulo de Objetivos Pessoais — rastreamento de metas e progresso
 *
 * Gerencia objetivos de saúde, finanças, aprendizado, hobby e crescimento pessoal.
 * Suporta progresso incremental, deadlines e múltiplos status.
 */

import { data, redirect } from "react-router";
import type { Route } from "./+types/personal-life.goals";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { personalGoals } from "../../drizzle/schema/personal-life";
import { eq, and, desc, asc } from "drizzle-orm";
import { useState } from "react";
import {
  ArrowLeft,
  Target,
  Plus,
  Edit,
  Trash2,
  X,
  CheckCircle2,
  TrendingUp,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Link } from "react-router";

// ── Types ──────────────────────────────────────────────────────────────────

type GoalRow = {
  id: string;
  userId: string;
  title: string;
  category: string;
  description: string | null;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  startDate: string | null;
  deadline: string | null;
  priority: string | null;
  status: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  health: "🏃 Saúde",
  finance: "💰 Finanças",
  learning: "📚 Aprendizado",
  hobby: "🎨 Hobby",
  personal_growth: "🌱 Crescimento",
};

const CATEGORY_COLORS: Record<string, string> = {
  health: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  finance: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  learning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  hobby: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  personal_growth: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "🔴 Crítica",
  high: "🟠 Alta",
  medium: "🟡 Média",
  low: "🟢 Baixa",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "Em Progresso",
  completed: "Concluído",
  abandoned: "Abandonado",
};

const STATUS_COLORS: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  abandoned: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function progressPct(current: string | null, target: string | null): number {
  const c = parseFloat(current ?? "0");
  const t = parseFloat(target ?? "0");
  if (!t || t <= 0) return 0;
  return Math.min(100, Math.round((c / t) * 100));
}

function progressBarColor(pct: number): string {
  if (pct < 30) return "bg-red-500";
  if (pct < 70) return "bg-yellow-500";
  return "bg-green-500";
}

function deadlineBadge(deadline: string | null): { text: string; cls: string } | null {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  if (days < 0) return { text: `${Math.abs(days)}d atrasado`, cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
  if (days === 0) return { text: "Vence HOJE", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
  if (days < 7) return { text: `${days}d restantes`, cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" };
  return { text: formatDate(deadline), cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
}

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") ?? "in_progress";
  const categoryFilter = url.searchParams.get("category") ?? "all";

  const conditions: Parameters<typeof and>[0][] = [
    eq(personalGoals.userId, user.id),
  ];

  if (statusFilter !== "all") {
    conditions.push(
      eq(
        personalGoals.status,
        statusFilter as "in_progress" | "completed" | "abandoned"
      )
    );
  }

  if (categoryFilter !== "all") {
    conditions.push(
      eq(
        personalGoals.category,
        categoryFilter as "health" | "finance" | "learning" | "hobby" | "personal_growth"
      )
    );
  }

  const goals = await db
    .select()
    .from(personalGoals)
    .where(and(...conditions))
    .orderBy(desc(personalGoals.createdAt));

  return {
    goals: goals as GoalRow[],
    statusFilter,
    categoryFilter,
  };
}

// ── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const title = formData.get("title") as string;
    const category = formData.get("category") as string;
    const description = (formData.get("description") as string) || null;
    const targetValue = (formData.get("targetValue") as string) || null;
    const currentValue = (formData.get("currentValue") as string) || null;
    const unit = (formData.get("unit") as string) || null;
    const startDate = (formData.get("startDate") as string) || null;
    const deadline = (formData.get("deadline") as string) || null;
    const priority = (formData.get("priority") as string) || "medium";
    const notes = (formData.get("notes") as string) || null;

    if (!title || !category) {
      return data({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    await db.insert(personalGoals).values({
      userId: user.id,
      title,
      category: category as "health" | "finance" | "learning" | "hobby" | "personal_growth",
      description,
      targetValue: targetValue || null,
      currentValue: currentValue || "0",
      unit,
      startDate,
      deadline,
      priority: priority as "low" | "medium" | "high" | "critical",
      status: "in_progress",
      notes,
    });

    return data({ success: true, message: "Objetivo criado com sucesso!" });
  }

  if (intent === "edit") {
    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const category = formData.get("category") as string;
    const description = (formData.get("description") as string) || null;
    const targetValue = (formData.get("targetValue") as string) || null;
    const currentValue = (formData.get("currentValue") as string) || null;
    const unit = (formData.get("unit") as string) || null;
    const startDate = (formData.get("startDate") as string) || null;
    const deadline = (formData.get("deadline") as string) || null;
    const priority = (formData.get("priority") as string) || "medium";
    const status = (formData.get("status") as string) || "in_progress";
    const notes = (formData.get("notes") as string) || null;

    await db
      .update(personalGoals)
      .set({
        title,
        category: category as "health" | "finance" | "learning" | "hobby" | "personal_growth",
        description,
        targetValue: targetValue || null,
        currentValue: currentValue || null,
        unit,
        startDate,
        deadline,
        priority: priority as "low" | "medium" | "high" | "critical",
        status: status as "in_progress" | "completed" | "abandoned",
        notes,
        updatedAt: new Date(),
      })
      .where(and(eq(personalGoals.id, id), eq(personalGoals.userId, user.id)));

    return data({ success: true, message: "Objetivo atualizado!" });
  }

  if (intent === "update_progress") {
    const id = formData.get("id") as string;
    const currentValue = formData.get("currentValue") as string;

    await db
      .update(personalGoals)
      .set({
        currentValue,
        updatedAt: new Date(),
      })
      .where(and(eq(personalGoals.id, id), eq(personalGoals.userId, user.id)));

    return data({ success: true, message: "Progresso atualizado!" });
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db
      .delete(personalGoals)
      .where(and(eq(personalGoals.id, id), eq(personalGoals.userId, user.id)));

    return data({ success: true, message: "Objetivo removido." });
  }

  if (intent === "complete") {
    const id = formData.get("id") as string;

    const [goal] = await db
      .select()
      .from(personalGoals)
      .where(and(eq(personalGoals.id, id), eq(personalGoals.userId, user.id)));

    if (!goal) return data({ error: "Objetivo não encontrado" }, { status: 404 });

    await db
      .update(personalGoals)
      .set({
        status: "completed",
        currentValue: goal.targetValue ?? goal.currentValue,
        updatedAt: new Date(),
      })
      .where(eq(personalGoals.id, id));

    return data({ success: true, message: "Parabéns! Objetivo concluído!" });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

// ── GoalForm Modal Component ───────────────────────────────────────────────

function GoalForm({
  onClose,
  initial,
  isEdit = false,
}: {
  onClose: () => void;
  initial?: GoalRow;
  isEdit?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? "Editar Objetivo" : "Novo Objetivo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form method="post" className="space-y-5 p-6">
          <input type="hidden" name="intent" value={isEdit ? "edit" : "create"} />
          {isEdit && initial?.id && (
            <input type="hidden" name="id" value={initial.id} />
          )}

          {/* Título */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Título *
            </label>
            <input
              type="text"
              name="title"
              required
              defaultValue={initial?.title ?? ""}
              placeholder="Ex: Correr 5km sem parar, Ler 24 livros este ano"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Categoria + Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Categoria *
              </label>
              <select
                name="category"
                required
                defaultValue={initial?.category ?? "personal_growth"}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Prioridade
              </label>
              <select
                name="priority"
                defaultValue={initial?.priority ?? "medium"}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descrição
            </label>
            <textarea
              name="description"
              defaultValue={initial?.description ?? ""}
              rows={2}
              placeholder="Detalhe o objetivo, motivação ou estratégia..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Valor alvo + Valor atual + Unidade */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Valor Alvo
              </label>
              <input
                type="number"
                name="targetValue"
                step="0.01"
                min="0"
                defaultValue={initial?.targetValue ?? ""}
                placeholder="Ex: 5, 24, 1000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Valor Atual
              </label>
              <input
                type="number"
                name="currentValue"
                step="0.01"
                min="0"
                defaultValue={initial?.currentValue ?? "0"}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Unidade
              </label>
              <input
                type="text"
                name="unit"
                defaultValue={initial?.unit ?? ""}
                placeholder="km, livros, R$, dias"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Data início + Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data de Início
              </label>
              <input
                type="date"
                name="startDate"
                defaultValue={initial?.startDate ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Prazo (Deadline)
              </label>
              <input
                type="date"
                name="deadline"
                defaultValue={initial?.deadline ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Status (somente em edição) */}
          {isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>
              <select
                name="status"
                defaultValue={initial?.status ?? "in_progress"}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="in_progress">Em Progresso</option>
                <option value="completed">Concluído</option>
                <option value="abandoned">Abandonado</option>
              </select>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notas
            </label>
            <textarea
              name="notes"
              defaultValue={initial?.notes ?? ""}
              rows={2}
              placeholder="Observações, referências, links..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {isEdit ? "Salvar alterações" : "Criar objetivo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── QuickProgress Component ────────────────────────────────────────────────

function QuickProgress({ goal }: { goal: GoalRow }) {
  const [value, setValue] = useState(goal.currentValue ?? "0");

  return (
    <form method="post" className="flex items-center gap-1.5">
      <input type="hidden" name="intent" value="update_progress" />
      <input type="hidden" name="id" value={goal.id} />
      <input
        type="number"
        name="currentValue"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        step="0.01"
        min="0"
        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <button
        type="submit"
        title="Atualizar progresso"
        className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
      >
        <TrendingUp className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PersonalLifeGoalsPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { goals, statusFilter, categoryFilter } = loaderData;
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalRow | null>(null);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // ── KPI calculations ────────────────────────────────────────────────────
  // Calcular sobre todos os objetivos retornados (considera filtro de status já aplicado no loader)
  // Para KPIs gerais precisamos de totals — usando os dados retornados pelo loader
  const totalGoals = goals.length;
  const inProgressCount = goals.filter((g) => g.status === "in_progress").length;
  const completedCount = goals.filter((g) => g.status === "completed").length;
  const completionPct =
    totalGoals > 0 ? Math.round((completedCount / totalGoals) * 100) : 0;

  // ── Status tabs ─────────────────────────────────────────────────────────
  const statusTabs = [
    { value: "in_progress", label: "Em Progresso" },
    { value: "completed", label: "Concluídos" },
    { value: "abandoned", label: "Abandonados" },
    { value: "all", label: "Todos" },
  ];

  const categories = ["all", "health", "finance", "learning", "hobby", "personal_growth"];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/personal-life">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              🎯 Objetivos Pessoais
            </h1>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Metas, progresso e conquistas pessoais
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingGoal(null);
            setShowForm(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Objetivo
        </Button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Total de Objetivos
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {totalGoals}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            no filtro atual
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/20">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Em Andamento
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-200">
            {inProgressCount}
          </p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
            objetivos ativos
          </p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-900/50 dark:bg-green-900/20">
          <p className="text-xs font-medium uppercase tracking-wider text-green-700 dark:text-green-400">
            Concluídos
          </p>
          <p className="mt-2 text-2xl font-bold text-green-900 dark:text-green-200">
            {completedCount}
          </p>
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">
            metas alcançadas
          </p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-900/20">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            Taxa de Conclusão
          </p>
          <p className="mt-2 text-2xl font-bold text-indigo-900 dark:text-indigo-200">
            {completionPct}%
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-indigo-200 dark:bg-indigo-900">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          {statusTabs.map((tab) => (
            <a
              key={tab.value}
              href={`?status=${tab.value}&category=${categoryFilter}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>

        {/* Category filter dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCategoryFilter((s) => !s)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Target className="h-3.5 w-3.5" />
            {categoryFilter === "all"
              ? "Todas as categorias"
              : CATEGORY_LABELS[categoryFilter] ?? categoryFilter}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showCategoryFilter && (
            <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              {categories.map((cat) => (
                <a
                  key={cat}
                  href={`?status=${statusFilter}&category=${cat}`}
                  onClick={() => setShowCategoryFilter(false)}
                  className={`block px-4 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    categoryFilter === cat
                      ? "font-semibold text-indigo-600 dark:text-indigo-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {cat === "all" ? "Todas as categorias" : CATEGORY_LABELS[cat] ?? cat}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Goals List ─────────────────────────────────────────────────── */}
      {goals.length === 0 ? (
        // Empty state
        <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center dark:border-gray-700">
          <Target className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mb-1 text-base font-semibold text-gray-700 dark:text-gray-300">
            Nenhum objetivo encontrado
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {statusFilter === "in_progress"
              ? "Crie seu primeiro objetivo para começar a acompanhar seu progresso."
              : "Nenhum objetivo corresponde aos filtros selecionados."}
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              setEditingGoal(null);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar primeiro objetivo
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const pct = progressPct(goal.currentValue, goal.targetValue);
            const barColor = progressBarColor(pct);
            const dl = deadlineBadge(goal.deadline);
            const isInProgress = goal.status === "in_progress";

            return (
              <div
                key={goal.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                {/* Top row: title + badges + actions */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left: title + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {goal.title}
                      </h3>
                      {/* Category badge */}
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          CATEGORY_COLORS[goal.category] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {CATEGORY_LABELS[goal.category] ?? goal.category}
                      </span>
                      {/* Priority badge */}
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          PRIORITY_COLORS[goal.priority ?? "medium"] ?? PRIORITY_COLORS.medium
                        }`}
                      >
                        {PRIORITY_LABELS[goal.priority ?? "medium"] ?? goal.priority}
                      </span>
                      {/* Status badge */}
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[goal.status ?? "in_progress"] ?? STATUS_COLORS.in_progress
                        }`}
                      >
                        {STATUS_LABELS[goal.status ?? "in_progress"] ?? goal.status}
                      </span>
                    </div>

                    {/* Description */}
                    {goal.description && (
                      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Complete button — only in_progress */}
                    {isInProgress && (
                      <form
                        method="post"
                        onSubmit={(e) =>
                          !confirm("Marcar este objetivo como concluído?") &&
                          e.preventDefault()
                        }
                      >
                        <input type="hidden" name="intent" value="complete" />
                        <input type="hidden" name="id" value={goal.id} />
                        <button
                          type="submit"
                          title="Marcar como concluído"
                          className="rounded-lg p-1.5 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGoal(goal);
                        setShowForm(false);
                      }}
                      title="Editar objetivo"
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    {/* Delete button */}
                    <form
                      method="post"
                      onSubmit={(e) =>
                        !confirm("Remover este objetivo permanentemente?") &&
                        e.preventDefault()
                      }
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={goal.id} />
                      <button
                        type="submit"
                        title="Remover objetivo"
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Progress bar — only when targetValue is set */}
                {goal.targetValue && parseFloat(goal.targetValue) > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                      <span>
                        {parseFloat(goal.currentValue ?? "0").toLocaleString("pt-BR")} /{" "}
                        {parseFloat(goal.targetValue).toLocaleString("pt-BR")}{" "}
                        {goal.unit ?? ""}
                      </span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Bottom row: deadline + quick progress */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {/* Start date */}
                    {goal.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Início: {formatDate(goal.startDate)}
                      </span>
                    )}
                    {/* Deadline badge */}
                    {dl && (
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${dl.cls}`}
                      >
                        <Calendar className="h-3 w-3" />
                        {dl.text}
                      </span>
                    )}
                  </div>

                  {/* Quick progress update — only in_progress with target */}
                  {isInProgress && goal.targetValue && parseFloat(goal.targetValue) > 0 && (
                    <QuickProgress goal={goal} />
                  )}
                </div>

                {/* Notes */}
                {goal.notes && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                    {goal.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Form (create / edit) ──────────────────────────────────── */}
      {(showForm || editingGoal) && (
        <GoalForm
          onClose={() => {
            setShowForm(false);
            setEditingGoal(null);
          }}
          initial={editingGoal ?? undefined}
          isEdit={!!editingGoal}
        />
      )}
    </div>
  );
}
