/**
 * GET/POST /personal-life/tasks
 * Módulo TO-DO com prioridades, prazos e notificações Telegram
 */

import { Form, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { useState } from "react";
import { db } from "~/lib/db.server";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { personalTasks } from "../../drizzle/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { redirect, data } from "react-router";
import {
  CheckSquare,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  RotateCcw,
  Trash2,
  Calendar,
  Flag,
  Bell,
  BellOff,
  ListTodo,
} from "lucide-react";
import { Button } from "~/components/ui/button";

type Task = typeof personalTasks.$inferSelect;

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "pending";

  const baseWhere = and(eq(personalTasks.userId, user.id), isNull(personalTasks.deletedAt));

  const [allTasks, kpiRows] = await Promise.all([
    db.select().from(personalTasks)
      .where(baseWhere)
      .orderBy(
        sql`CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
        asc(personalTasks.dueDate),
        desc(personalTasks.createdAt)
      ),
    db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`sum(case when ${personalTasks.status} IN ('pending','in_progress') then 1 else 0 end)::int`,
      done_today: sql<number>`sum(case when ${personalTasks.status} = 'done' and date(${personalTasks.completedAt}) = current_date then 1 else 0 end)::int`,
      overdue: sql<number>`sum(case when ${personalTasks.status} IN ('pending','in_progress') and ${personalTasks.dueDate} < current_date then 1 else 0 end)::int`,
    }).from(personalTasks).where(baseWhere),
  ]);

  const kpi = kpiRows[0] ?? { total: 0, pending: 0, done_today: 0, overdue: 0 };

  const today = new Date().toISOString().split("T")[0]!;

  const filtered = filter === "all"
    ? allTasks
    : filter === "done"
    ? allTasks.filter(t => t.status === "done")
    : filter === "in_progress"
    ? allTasks.filter(t => t.status === "in_progress")
    : allTasks.filter(t => t.status === "pending" || t.status === "in_progress");

  return { tasks: filtered, kpi, filter, today, userId: user.id };
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "create") {
    const title = String(formData.get("title") || "").trim();
    if (!title) return data({ error: "Título obrigatório" }, { status: 400 });

    await db.insert(personalTasks).values({
      userId: user.id,
      title,
      description: String(formData.get("description") || "").trim() || null,
      dueDate: String(formData.get("dueDate") || "").trim() || null,
      priority: String(formData.get("priority") || "medium"),
      category: String(formData.get("category") || "personal"),
      notifyTelegram: String(formData.get("notifyTelegram") || "true") === "true",
      notifyDaysBefore: Number(formData.get("notifyDaysBefore") || 1),
      updatedAt: new Date(),
    });
    return redirect("/personal-life/tasks");
  }

  if (intent === "complete") {
    const id = String(formData.get("id") || "");
    await db.update(personalTasks)
      .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(personalTasks.id, id), eq(personalTasks.userId, user.id)));
    return redirect("/personal-life/tasks");
  }

  if (intent === "reopen") {
    const id = String(formData.get("id") || "");
    await db.update(personalTasks)
      .set({ status: "pending", completedAt: null, updatedAt: new Date() })
      .where(and(eq(personalTasks.id, id), eq(personalTasks.userId, user.id)));
    return redirect("/personal-life/tasks");
  }

  if (intent === "toggle_notify") {
    const id = String(formData.get("id") || "");
    const current = String(formData.get("current") || "true") === "true";
    await db.update(personalTasks)
      .set({ notifyTelegram: !current, updatedAt: new Date() })
      .where(and(eq(personalTasks.id, id), eq(personalTasks.userId, user.id)));
    return redirect("/personal-life/tasks");
  }

  if (intent === "delete") {
    const id = String(formData.get("id") || "");
    await db.update(personalTasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(personalTasks.id, id), eq(personalTasks.userId, user.id)));
    return redirect("/personal-life/tasks");
  }

  return redirect("/personal-life/tasks");
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  critical: { label: "Crítico", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "🔴" },
  high:     { label: "Alto",    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", dot: "🟠" },
  medium:   { label: "Médio",   color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", dot: "🟡" },
  low:      { label: "Baixo",   color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", dot: "⚪" },
};

const CATEGORY_LABELS: Record<string, string> = {
  work: "Trabalho",
  personal: "Pessoal",
  financial: "Financeiro",
  health: "Saúde",
  errand: "Recado",
  other: "Outro",
};

function DueBadge({ dueDate, isDone }: { dueDate: string | null; isDone: boolean }) {
  if (!dueDate || isDone) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertCircle className="h-3 w-3" />
        Atrasada {Math.abs(diffDays)} dia{Math.abs(diffDays) !== 1 ? "s" : ""}
      </span>
    );
  }
  if (diffDays === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        <Clock className="h-3 w-3" />
        Vence hoje
      </span>
    );
  }
  if (diffDays === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <Calendar className="h-3 w-3" />
        Amanhã
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <Calendar className="h-3 w-3" />
      {diffDays} dias
    </span>
  );
}

function TaskCard({ task }: { task: Task }) {
  const priority = PRIORITY_CONFIG[task.priority ?? "medium"] ?? PRIORITY_CONFIG.medium!;
  const isDone = task.status === "done";
  const dueStr = task.dueDate ? String(task.dueDate) : null;

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isDone
        ? "border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 opacity-60"
        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    }`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {isDone ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : task.status === "in_progress" ? (
            <Clock className="h-5 w-5 text-blue-500" />
          ) : (
            <Circle className="h-5 w-5 text-gray-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-medium ${isDone ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
              {priority.dot} {task.title}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priority.color}`}>
              {priority.label}
            </span>
            {task.category && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {CATEGORY_LABELS[task.category] ?? task.category}
              </span>
            )}
          </div>

          {task.description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{task.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DueBadge dueDate={dueStr} isDone={isDone} />
            {isDone && task.completedAt && (
              <span className="text-xs text-gray-400">
                Concluída em {new Date(task.completedAt).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Toggle notify */}
          <Form method="post">
            <input type="hidden" name="intent" value="toggle_notify" />
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="current" value={String(task.notifyTelegram ?? true)} />
            <button
              type="submit"
              title={task.notifyTelegram ? "Desativar notificação" : "Ativar notificação"}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              {task.notifyTelegram ? <Bell className="h-4 w-4 text-blue-500" /> : <BellOff className="h-4 w-4" />}
            </button>
          </Form>

          {/* Complete / Reopen */}
          {!isDone ? (
            <Form method="post">
              <input type="hidden" name="intent" value="complete" />
              <input type="hidden" name="id" value={task.id} />
              <button
                type="submit"
                title="Marcar como concluída"
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30"
              >
                <CheckSquare className="h-4 w-4" />
              </button>
            </Form>
          ) : (
            <Form method="post">
              <input type="hidden" name="intent" value="reopen" />
              <input type="hidden" name="id" value={task.id} />
              <button
                type="submit"
                title="Reabrir tarefa"
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </Form>
          )}

          {/* Delete */}
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={task.id} />
            <button
              type="submit"
              title="Excluir tarefa"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
              onClick={(e) => { if (!confirm("Excluir esta tarefa?")) e.preventDefault(); }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default function PersonalLifeTasksPage() {
  const { tasks, kpi, filter, today } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  const filterOptions = [
    { key: "pending", label: "A Fazer" },
    { key: "in_progress", label: "Em andamento" },
    { key: "done", label: "Concluídas" },
    { key: "all", label: "Todas" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ListTodo className="h-7 w-7 text-blue-500" />
            TO-DO
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tarefas pessoais com alertas diários às 8h via Telegram
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "A Fazer", value: kpi.pending ?? 0, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Atrasadas", value: kpi.overdue ?? 0, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: "Concluídas hoje", value: kpi.done_today ?? 0, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Total ativas", value: kpi.total ?? 0, color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-50 dark:bg-gray-800" },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl p-4 ${k.bg}`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-900/10">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Nova Tarefa</h2>
          <Form method="post" className="space-y-3" onSubmit={() => setShowForm(false)}>
            <input type="hidden" name="intent" value="create" />
            <input
              type="text"
              name="title"
              placeholder="Título da tarefa *"
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <textarea
              name="description"
              placeholder="Descrição (opcional)"
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Prazo</label>
                <input
                  type="date"
                  name="dueDate"
                  min={today}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Prioridade</label>
                <select
                  name="priority"
                  defaultValue="medium"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="low">⚪ Baixo</option>
                  <option value="medium">🟡 Médio</option>
                  <option value="high">🟠 Alto</option>
                  <option value="critical">🔴 Crítico</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Categoria</label>
                <select
                  name="category"
                  defaultValue="personal"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="personal">Pessoal</option>
                  <option value="work">Trabalho</option>
                  <option value="financial">Financeiro</option>
                  <option value="health">Saúde</option>
                  <option value="errand">Recado</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Notif. Telegram</label>
                <select
                  name="notifyTelegram"
                  defaultValue="true"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="true">🔔 Sim</option>
                  <option value="false">🔕 Não</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </Form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set("filter", opt.key);
              setSearchParams(params);
            }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === opt.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
          <Flag className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
            {filter === "done" ? "Nenhuma tarefa concluída ainda" : "Nenhuma tarefa aqui"}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {filter !== "done" && "Clique em \"Nova Tarefa\" para adicionar"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task as Task} />
          ))}
        </div>
      )}
    </div>
  );
}
