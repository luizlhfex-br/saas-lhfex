/**
 * GET/POST /personal-life/timeoff
 * Módulo de Férias & Viagens Planejadas
 *
 * Gerencia viagens planejadas, férias, staycations e retiros.
 * Exibe contagem regressiva, orçamento vs gasto real, e histórico.
 */

import { data } from "react-router";
import type { Route } from "./+types/personal-life.timeoff";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { plannedTimeOff } from "../../drizzle/schema/personal-life";
import { eq, desc, gte } from "drizzle-orm";
import { useState } from "react";
import { useNavigation, Form, Link } from "react-router";
import {
  ArrowLeft,
  Plus,
  X,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  DollarSign,
  Plane,
  ChevronDown,
  ChevronUp,
  Umbrella,
} from "lucide-react";
import { Button } from "~/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────

type TimeOff = typeof plannedTimeOff.$inferSelect;

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "R$ 0,00";
  const num = parseFloat(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

// ── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; badgeClass: string }
> = {
  vacation: {
    label: "✈️ Viagem",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  weekend_trip: {
    label: "🚗 Final de Semana",
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    badgeClass:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  staycation: {
    label: "🏠 Staycation",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
    badgeClass:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  retreat: {
    label: "🧘 Retiro",
    color: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    border: "border-teal-200 dark:border-teal-800",
    badgeClass:
      "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  },
};

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const today = new Date().toISOString().split("T")[0]!;

  const allTimeOff = await db
    .select()
    .from(plannedTimeOff)
    .where(eq(plannedTimeOff.userId, user.id))
    .orderBy(desc(plannedTimeOff.startDate));

  const upcoming = allTimeOff.filter((t) => t.startDate >= today);
  const past = allTimeOff.filter((t) => t.startDate < today);

  // Next upcoming trip (smallest startDate that is still in the future)
  const nextTrip =
    upcoming.length > 0
      ? upcoming.reduce((closest, curr) =>
          curr.startDate < closest.startDate ? curr : closest
        )
      : null;

  return { upcoming, past, nextTrip, user };
}

// ── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "create") {
    const title = formData.get("title") as string;
    const type = (formData.get("type") as string) || "vacation";
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const location = (formData.get("location") as string) || null;
    const estimatedBudget = formData.get("estimatedBudget")
      ? (formData.get("estimatedBudget") as string)
      : null;
    const actualSpend = formData.get("actualSpend")
      ? (formData.get("actualSpend") as string)
      : null;
    const accommodation = (formData.get("accommodation") as string) || null;
    const activities = (formData.get("activities") as string) || null;
    const notes = (formData.get("notes") as string) || null;

    if (!title || !startDate || !endDate) {
      return data({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    await db.insert(plannedTimeOff).values({
      userId: user.id,
      title,
      type,
      startDate,
      endDate,
      location,
      estimatedBudget,
      actualSpend,
      accommodation,
      activities,
      notes,
    });

    return data({ success: true });
  }

  if (intent === "edit") {
    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const type = formData.get("type") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const location = (formData.get("location") as string) || null;
    const estimatedBudget = formData.get("estimatedBudget")
      ? (formData.get("estimatedBudget") as string)
      : null;
    const actualSpend = formData.get("actualSpend")
      ? (formData.get("actualSpend") as string)
      : null;
    const accommodation = (formData.get("accommodation") as string) || null;
    const activities = (formData.get("activities") as string) || null;
    const notes = (formData.get("notes") as string) || null;

    await db
      .update(plannedTimeOff)
      .set({
        title,
        type,
        startDate,
        endDate,
        location,
        estimatedBudget,
        actualSpend,
        accommodation,
        activities,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(plannedTimeOff.id, id));

    return data({ success: true });
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db
      .delete(plannedTimeOff)
      .where(eq(plannedTimeOff.id, id));

    return data({ success: true });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

// ── Sub-components ──────────────────────────────────────────────────────────

function BudgetBar({
  estimated,
  actual,
}: {
  estimated: string | null;
  actual: string | null;
}) {
  const est = estimated ? parseFloat(estimated) : 0;
  const act = actual ? parseFloat(actual) : 0;

  if (est === 0 && act === 0) return null;

  const max = Math.max(est, act, 1);
  const estPct = Math.min((est / max) * 100, 100);
  const actPct = Math.min((act / max) * 100, 100);
  const isOver = act > est && est > 0;

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Orçamento</span>
        <span>
          {formatCurrency(actual || "0")} / {formatCurrency(estimated || "0")}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-blue-400 dark:bg-blue-500 transition-all"
          style={{ width: `${estPct}%` }}
        />
        {act > 0 && (
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all ${
              isOver
                ? "bg-red-500 dark:bg-red-400"
                : "bg-green-500 dark:bg-green-400"
            }`}
            style={{ width: `${actPct}%` }}
          />
        )}
      </div>
      {isOver && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          {formatCurrency(String(act - est))} acima do orçamento
        </p>
      )}
    </div>
  );
}

function TripCard({
  trip,
  onEdit,
  onDelete,
  muted = false,
}: {
  trip: TimeOff;
  onEdit: (t: TimeOff) => void;
  onDelete: (id: string) => void;
  muted?: boolean;
}) {
  const cfg = TYPE_CONFIG[trip.type] ?? TYPE_CONFIG["vacation"]!;
  const days = daysUntil(trip.startDate);
  const tripDays = Math.max(
    1,
    Math.round(
      (new Date(trip.endDate + "T00:00:00").getTime() -
        new Date(trip.startDate + "T00:00:00").getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );

  return (
    <div
      className={`rounded-xl border p-5 transition-all hover:shadow-md ${
        muted
          ? "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 opacity-75"
          : `${cfg.border} ${cfg.bg}`
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`truncate text-base font-semibold ${
                muted
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {trip.title}
            </h3>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badgeClass}`}
            >
              {cfg.label}
            </span>
          </div>

          {/* Dates + duration */}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {tripDays} {tripDays === 1 ? "dia" : "dias"}
            </span>
          </div>

          {/* Location */}
          {trip.location && (
            <div className="mt-1 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-3.5 w-3.5" />
              {trip.location}
            </div>
          )}

          {/* Countdown badge for future trips */}
          {!muted && days >= 0 && (
            <div className="mt-2">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  days === 0
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    : days <= 7
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {days === 0
                  ? "Começa hoje!"
                  : days === 1
                  ? "Amanhã!"
                  : `Em ${days} dias`}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(trip)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(trip.id)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Budget bar */}
      <BudgetBar estimated={trip.estimatedBudget} actual={trip.actualSpend} />

      {/* Notes / activities preview */}
      {(trip.activities || trip.notes) && (
        <p className="mt-2 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
          {trip.activities || trip.notes}
        </p>
      )}
    </div>
  );
}

function TripModal({
  trip,
  onClose,
  isSubmitting,
}: {
  trip: TimeOff | null;
  onClose: () => void;
  isSubmitting: boolean;
}) {
  const isEdit = !!trip;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? "Editar Viagem" : "Nova Viagem"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <Form method="post" className="space-y-5 p-6">
          <input
            type="hidden"
            name="_intent"
            value={isEdit ? "edit" : "create"}
          />
          {isEdit && <input type="hidden" name="id" value={trip.id} />}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              defaultValue={trip?.title ?? ""}
              placeholder="Ex: Férias em Florianópolis"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo
            </label>
            <select
              name="type"
              defaultValue={trip?.type ?? "vacation"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="vacation">✈️ Viagem</option>
              <option value="weekend_trip">🚗 Final de Semana</option>
              <option value="staycation">🏠 Staycation</option>
              <option value="retreat">🧘 Retiro</option>
            </select>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de início <span className="text-red-500">*</span>
              </label>
              <input
                name="startDate"
                type="date"
                required
                defaultValue={trip?.startDate ?? ""}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de fim <span className="text-red-500">*</span>
              </label>
              <input
                name="endDate"
                type="date"
                required
                defaultValue={trip?.endDate ?? ""}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          {/* Local */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Local
            </label>
            <input
              name="location"
              type="text"
              defaultValue={trip?.location ?? ""}
              placeholder="Ex: Florianópolis, SC"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Orçamento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Orçamento previsto (R$)
              </label>
              <input
                name="estimatedBudget"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  trip?.estimatedBudget
                    ? parseFloat(trip.estimatedBudget).toFixed(2)
                    : ""
                }
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gasto real (R$)
              </label>
              <input
                name="actualSpend"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  trip?.actualSpend
                    ? parseFloat(trip.actualSpend).toFixed(2)
                    : ""
                }
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Hospedagem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hospedagem
            </label>
            <input
              name="accommodation"
              type="text"
              defaultValue={trip?.accommodation ?? ""}
              placeholder="Ex: Airbnb Centro, Hotel Beira Mar"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Atividades */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Atividades planejadas
            </label>
            <textarea
              name="activities"
              rows={3}
              defaultValue={trip?.activities ?? ""}
              placeholder="Ex: Praia, passeio de barco, trilha..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 resize-none"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={trip?.notes ?? ""}
              placeholder="Observações gerais..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 resize-none"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar viagem"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function PersonalLifeTimeoffPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { upcoming, past, nextTrip } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [showModal, setShowModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TimeOff | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Close modal after successful submission
  const isIdle = navigation.state === "idle";
  // We use a key trick: close on idle after submitting
  const wasPreviouslySubmitting =
    navigation.state === "submitting" || navigation.state === "loading";

  function handleOpenCreate() {
    setEditingTrip(null);
    setShowModal(true);
  }

  function handleOpenEdit(trip: TimeOff) {
    setEditingTrip(trip);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingTrip(null);
  }

  // Close modal when navigation completes
  if (isIdle && showModal && !wasPreviouslySubmitting) {
    // do nothing
  }

  const nextDays = nextTrip ? daysUntil(nextTrip.startDate) : null;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/personal-life">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              🏖️ Férias & Viagens
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Planejamento de viagens, férias e pausas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Viagem
        </button>
      </div>

      {/* Hero: Próxima Viagem */}
      {nextTrip ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 p-7 text-white shadow-lg">
          {/* Decorative background shapes */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 -left-4 h-32 w-32 rounded-full bg-white/10" />

          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal-100">
                  Próxima viagem
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {nextTrip.type === "retreat" ? "🧘" :
                   nextTrip.type === "staycation" ? "🏠" :
                   nextTrip.type === "weekend_trip" ? "🚗" : "🏖️"}{" "}
                  {nextTrip.title}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-teal-100">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDate(nextTrip.startDate)} → {formatDate(nextTrip.endDate)}
                  </span>
                  {nextTrip.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {nextTrip.location}
                    </span>
                  )}
                  {nextTrip.estimatedBudget && (
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4" />
                      {formatCurrency(nextTrip.estimatedBudget)}
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown circle */}
              <div className="flex flex-col items-center rounded-2xl bg-white/20 px-5 py-3 backdrop-blur-sm">
                <Umbrella className="h-6 w-6 mb-1" />
                <span className="text-3xl font-bold leading-none">
                  {nextDays === 0 ? "Hoje!" : nextDays === 1 ? "Amanhã!" : nextDays}
                </span>
                {nextDays !== null && nextDays > 1 && (
                  <span className="mt-1 text-xs text-teal-100">
                    {nextDays === 1 ? "dia" : "dias"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 py-12 text-center dark:border-teal-800 dark:bg-teal-900/10">
          <Plane className="mb-3 h-10 w-10 text-teal-400" />
          <p className="text-base font-medium text-teal-700 dark:text-teal-300">
            Nenhuma viagem planejada
          </p>
          <p className="mt-1 text-sm text-teal-500 dark:text-teal-400">
            Adicione sua próxima aventura!
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Planejar viagem
          </button>
        </div>
      )}

      {/* Section: Próximas Viagens */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Próximas Viagens{" "}
            {upcoming.length > 0 && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                {upcoming.length}
              </span>
            )}
          </h2>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-8 text-center dark:border-gray-800 dark:bg-gray-900/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhuma viagem futura planejada.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onEdit={handleOpenEdit}
                onDelete={(id) => setDeletingId(id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section: Viagens Passadas (collapsed) */}
      {past.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:bg-gray-800/60 transition-colors"
          >
            <span>
              Viagens Passadas{" "}
              <span className="ml-1 text-gray-400 dark:text-gray-500">
                ({past.length})
              </span>
            </span>
            {showPast ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {showPast && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {past.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onEdit={handleOpenEdit}
                  onDelete={(id) => setDeletingId(id)}
                  muted
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <TripModal
          trip={editingTrip}
          onClose={handleCloseModal}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeletingId(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Confirmar exclusão
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Tem certeza que deseja excluir esta viagem? Essa ação não pode
              ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <Form method="post" onSubmit={() => setDeletingId(null)}>
                <input type="hidden" name="_intent" value="delete" />
                <input type="hidden" name="id" value={deletingId} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  Excluir
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
