/**
 * GET/POST /personal-life/bills
 * Módulo de Vencimentos — gestão de pagamentos recorrentes e pontuais
 *
 * Gerencia assinaturas, boletos, cartão, aluguel, seguros, etc.
 * Alertas via @lhfex_monitor_bot configuráveis por conta.
 */

import { data, redirect } from "react-router";
import type { Route } from "./+types/personal-life.bills";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { db } from "~/lib/db.server";
import { bills, billPayments } from "../../drizzle/schema/bills";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { useState } from "react";
import {
  Plus,
  Receipt,
  Calendar,
  CheckCircle,
  Edit,
  Trash2,
  AlertCircle,
  CreditCard,
  Home,
  Zap,
  Shield,
  FileText,
  MoreHorizontal,
  Bell,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────

type BillRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  amount: string;
  currency: string | null;
  dueDay: number | null;
  nextDueDate: string;
  isRecurring: boolean | null;
  recurrenceMonths: number | null;
  isAutoDebit: boolean | null;
  paymentMethod: string | null;
  alertDaysBefore: number | null;
  alertOneDayBefore: boolean | null;
  status: string | null;
  link: string | null;
  notes: string | null;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: string, currency = "BRL") {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(num);
}

function formatDate(dateStr: string) {
  // dateStr vem como "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number): string {
  if (days < 0) return "bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500";
  if (days === 0) return "bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500";
  if (days <= 3) return "bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-500";
  if (days <= 7) return "bg-orange-50 dark:bg-orange-900/10 border-l-4 border-l-orange-400";
  return "";
}

function urgencyLabel(days: number): { label: string; color: string } {
  if (days < 0) return { label: `${Math.abs(days)}d atrasado`, color: "text-red-600 dark:text-red-400 font-semibold" };
  if (days === 0) return { label: "Vence HOJE", color: "text-red-600 dark:text-red-400 font-bold" };
  if (days === 1) return { label: "Amanhã", color: "text-yellow-600 dark:text-yellow-400 font-semibold" };
  if (days <= 3) return { label: `Em ${days} dias`, color: "text-yellow-600 dark:text-yellow-400" };
  if (days <= 7) return { label: `Em ${days} dias`, color: "text-orange-600 dark:text-orange-400" };
  return { label: formatDate(new Date(Date.now() + days * 86400000).toISOString().split("T")[0] ?? ""), color: "text-gray-500 dark:text-gray-400" };
}

const CATEGORY_LABELS: Record<string, string> = {
  subscription: "Assinatura",
  rent: "Aluguel",
  credit_card: "Cartão de Crédito",
  utility: "Utilidade",
  loan: "Empréstimo",
  insurance: "Seguro",
  tax: "Imposto",
  other: "Outro",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  subscription: <Zap className="h-4 w-4" />,
  rent: <Home className="h-4 w-4" />,
  credit_card: <CreditCard className="h-4 w-4" />,
  utility: <Zap className="h-4 w-4" />,
  loan: <FileText className="h-4 w-4" />,
  insurance: <Shield className="h-4 w-4" />,
  tax: <Receipt className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  subscription: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  rent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  credit_card: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  utility: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  loan: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  insurance: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  tax: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const categoryFilter = url.searchParams.get("category") ?? "all";
  const statusFilter = url.searchParams.get("status") ?? "active";

  // Busca bills do usuário (não deletados)
  const allBills = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.userId, user.id),
        isNull(bills.deletedAt),
        ...(statusFilter !== "all" ? [eq(bills.status, statusFilter as "active" | "paused" | "cancelled")] : []),
        ...(categoryFilter !== "all" ? [eq(bills.category, categoryFilter as "subscription" | "rent" | "credit_card" | "utility" | "loan" | "insurance" | "tax" | "other")] : []),
      )
    )
    .orderBy(asc(bills.nextDueDate));

  // KPIs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Para KPIs precisamos buscar todos os ativos (sem filtro de categoria)
  const activeBills = await db
    .select()
    .from(bills)
    .where(and(eq(bills.userId, user.id), isNull(bills.deletedAt), eq(bills.status, "active")));

  const dueThisWeek = activeBills
    .filter((b) => {
      const d = new Date(b.nextDueDate + "T00:00:00");
      return d >= today && d <= weekEnd;
    })
    .reduce((sum, b) => sum + parseFloat(b.amount), 0);

  const dueThisMonth = activeBills
    .filter((b) => {
      const d = new Date(b.nextDueDate + "T00:00:00");
      return d >= today && d <= monthEnd;
    })
    .reduce((sum, b) => sum + parseFloat(b.amount), 0);

  const activeSubscriptions = activeBills.filter((b) => b.category === "subscription").length;

  const monthlyEstimate = activeBills.reduce((sum, b) => {
    const months = b.recurrenceMonths ?? 1;
    return sum + parseFloat(b.amount) / months;
  }, 0);

  return {
    user,
    bills: allBills as BillRow[],
    kpis: {
      dueThisWeek,
      dueThisMonth,
      activeSubscriptions,
      monthlyEstimate,
    },
    filters: { category: categoryFilter, status: statusFilter },
  };
}

// ── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "create") {
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const amount = formData.get("amount") as string;
    const nextDueDate = formData.get("nextDueDate") as string;
    const description = formData.get("description") as string | null;
    const currency = (formData.get("currency") as string) || "BRL";
    const dueDay = formData.get("dueDay") ? parseInt(formData.get("dueDay") as string) : null;
    const startDate = formData.get("startDate") as string | null;
    const endDate = formData.get("endDate") as string | null;
    const isRecurring = formData.get("isRecurring") === "true";
    const recurrenceMonths = parseInt((formData.get("recurrenceMonths") as string) || "1");
    const isAutoDebit = formData.get("isAutoDebit") === "on";
    const paymentMethod = formData.get("paymentMethod") as string | null;
    const alertDaysBefore = parseInt((formData.get("alertDaysBefore") as string) || "3");
    const alertOneDayBefore = formData.get("alertOneDayBefore") === "on";
    const link = formData.get("link") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!name || !category || !amount || !nextDueDate) {
      return data({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    await db.insert(bills).values({
      userId: user.id,
      name,
      category: category as "subscription" | "rent" | "credit_card" | "utility" | "loan" | "insurance" | "tax" | "other",
      description: description || null,
      amount,
      currency,
      dueDay,
      nextDueDate,
      startDate: startDate || null,
      endDate: endDate || null,
      isRecurring,
      recurrenceMonths,
      isAutoDebit,
      paymentMethod: paymentMethod || null,
      alertDaysBefore,
      alertOneDayBefore,
      status: "active",
      link: link || null,
      notes: notes || null,
    });

    return data({ success: true, message: "Vencimento criado com sucesso!" });
  }

  if (intent === "pay") {
    const billId = formData.get("billId") as string;
    const paidAt = (formData.get("paidAt") as string) || new Date().toISOString().split("T")[0];
    const paidAmount = formData.get("paidAmount") as string;
    const payNotes = formData.get("payNotes") as string | null;

    // Busca o bill
    const [bill] = await db.select().from(bills).where(and(eq(bills.id, billId), eq(bills.userId, user.id)));
    if (!bill) return data({ error: "Vencimento não encontrado" }, { status: 404 });

    // Registra pagamento
    await db.insert(billPayments).values({
      billId,
      userId: user.id,
      paidAt,
      amount: paidAmount || bill.amount,
      notes: payNotes || null,
    });

    // Avança nextDueDate por recurrenceMonths
    if (bill.isRecurring) {
      const currentDue = new Date(bill.nextDueDate + "T00:00:00");
      const months = bill.recurrenceMonths ?? 1;
      currentDue.setMonth(currentDue.getMonth() + months);
      const newDueDate = currentDue.toISOString().split("T")[0];

      await db
        .update(bills)
        .set({ nextDueDate: newDueDate!, updatedAt: new Date() })
        .where(eq(bills.id, billId));
    }

    return data({ success: true, message: "Pagamento registrado!" });
  }

  if (intent === "update") {
    const billId = formData.get("billId") as string;
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const amount = formData.get("amount") as string;
    const nextDueDate = formData.get("nextDueDate") as string;

    await db
      .update(bills)
      .set({
        name,
        category: category as "subscription" | "rent" | "credit_card" | "utility" | "loan" | "insurance" | "tax" | "other",
        amount,
        nextDueDate,
        description: (formData.get("description") as string) || null,
        currency: (formData.get("currency") as string) || "BRL",
        dueDay: formData.get("dueDay") ? parseInt(formData.get("dueDay") as string) : null,
        isRecurring: formData.get("isRecurring") === "true",
        recurrenceMonths: parseInt((formData.get("recurrenceMonths") as string) || "1"),
        isAutoDebit: formData.get("isAutoDebit") === "on",
        paymentMethod: (formData.get("paymentMethod") as string) || null,
        alertDaysBefore: parseInt((formData.get("alertDaysBefore") as string) || "3"),
        alertOneDayBefore: formData.get("alertOneDayBefore") === "on",
        status: (formData.get("status") as "active" | "paused" | "cancelled") || "active",
        link: (formData.get("link") as string) || null,
        notes: (formData.get("notes") as string) || null,
        updatedAt: new Date(),
      })
      .where(and(eq(bills.id, billId), eq(bills.userId, user.id)));

    return data({ success: true, message: "Vencimento atualizado!" });
  }

  if (intent === "delete") {
    const billId = formData.get("billId") as string;
    await db
      .update(bills)
      .set({ deletedAt: new Date() })
      .where(and(eq(bills.id, billId), eq(bills.userId, user.id)));

    return data({ success: true, message: "Vencimento removido." });
  }

  return data({ error: "Ação inválida" }, { status: 400 });
}

// ── BillForm Component ─────────────────────────────────────────────────────

function BillForm({
  onClose,
  defaultValues,
  isEdit = false,
}: {
  onClose: () => void;
  defaultValues?: Partial<BillRow>;
  isEdit?: boolean;
}) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {isEdit ? "Editar Vencimento" : "Novo Vencimento"}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form method="post" className="space-y-4">
        <input type="hidden" name="_intent" value={isEdit ? "update" : "create"} />
        {isEdit && defaultValues?.id && (
          <input type="hidden" name="billId" value={defaultValues.id} />
        )}

        {/* Linha 1: Nome + Categoria */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Nome *
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={defaultValues?.name}
              placeholder="Ex: Netflix, Aluguel Virtual"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Categoria *
            </label>
            <select
              name="category"
              required
              defaultValue={defaultValues?.category ?? "subscription"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha 2: Valor + Moeda + Próx. Vencimento */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Valor *
            </label>
            <input
              type="number"
              name="amount"
              required
              step="0.01"
              min="0.01"
              defaultValue={defaultValues?.amount}
              placeholder="0,00"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Moeda
            </label>
            <select
              name="currency"
              defaultValue={defaultValues?.currency ?? "BRL"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="BRL">BRL (R$)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Próximo Vencimento *
            </label>
            <input
              type="date"
              name="nextDueDate"
              required
              defaultValue={defaultValues?.nextDueDate}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Linha 3: Recorrência */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Tipo
            </label>
            <select
              name="isRecurring"
              defaultValue={defaultValues?.isRecurring === false ? "false" : "true"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="true">Recorrente</option>
              <option value="false">Pontual (única vez)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              A cada (meses)
            </label>
            <select
              name="recurrenceMonths"
              defaultValue={defaultValues?.recurrenceMonths ?? 1}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="1">Mensal</option>
              <option value="3">Trimestral</option>
              <option value="6">Semestral</option>
              <option value="12">Anual</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Dia do Mês (fixo)
            </label>
            <input
              type="number"
              name="dueDay"
              min="1"
              max="31"
              defaultValue={defaultValues?.dueDay ?? ""}
              placeholder="Ex: 15"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Linha 4: Pagamento */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Método de Pagamento
            </label>
            <input
              type="text"
              name="paymentMethod"
              defaultValue={defaultValues?.paymentMethod ?? ""}
              placeholder="Ex: Nubank, Inter, Boleto, Pix"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="isAutoDebit"
                defaultChecked={defaultValues?.isAutoDebit ?? false}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Débito automático
            </label>
          </div>
        </div>

        {/* Linha 5: Alertas */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Alertar X dias antes
            </label>
            <select
              name="alertDaysBefore"
              defaultValue={defaultValues?.alertDaysBefore ?? 3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="1">1 dia antes</option>
              <option value="2">2 dias antes</option>
              <option value="3">3 dias antes</option>
              <option value="5">5 dias antes</option>
              <option value="7">7 dias antes (1 semana)</option>
              <option value="15">15 dias antes</option>
            </select>
          </div>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="alertOneDayBefore"
                defaultChecked={defaultValues?.alertOneDayBefore ?? true}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Sempre alertar 1 dia antes
            </label>
          </div>
        </div>

        {/* Linha 6: Datas início/fim */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Data Início
            </label>
            <input
              type="date"
              name="startDate"
              defaultValue={defaultValues?.notes ?? ""}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Data Fim (contrato)
            </label>
            <input
              type="date"
              name="endDate"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Linha 7: Link + Status (em edição) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Link (site/portal)
            </label>
            <input
              type="url"
              name="link"
              defaultValue={defaultValues?.link ?? ""}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          {isEdit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>
              <select
                name="status"
                defaultValue={defaultValues?.status ?? "active"}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          )}
        </div>

        {/* Linha 8: Observações */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Observações
          </label>
          <textarea
            name="notes"
            defaultValue={defaultValues?.notes ?? ""}
            rows={2}
            placeholder="Informações adicionais..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">
            {isEdit ? "Salvar alterações" : "Adicionar vencimento"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── PayModal Component ─────────────────────────────────────────────────────

function PayModal({
  bill,
  onClose,
}: {
  bill: BillRow;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Registrar Pagamento
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          <strong>{bill.name}</strong>
        </p>
        <form method="post" onSubmit={onClose} className="space-y-4">
          <input type="hidden" name="_intent" value="pay" />
          <input type="hidden" name="billId" value={bill.id} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Data do Pagamento
            </label>
            <input
              type="date"
              name="paidAt"
              defaultValue={today}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Valor Pago
            </label>
            <input
              type="number"
              name="paidAmount"
              step="0.01"
              defaultValue={bill.amount}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Observação (opcional)
            </label>
            <input
              type="text"
              name="payNotes"
              placeholder="Ex: pago com desconto, atrasado..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="mr-1.5 h-4 w-4" />
              Confirmar Pagamento
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function BillsPage({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { bills: billRows, kpis, filters } = loaderData;
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<BillRow | null>(null);
  const [payingBill, setPayingBill] = useState<BillRow | null>(null);

  const CATEGORIES = ["all", "subscription", "rent", "credit_card", "utility", "loan", "insurance", "tax", "other"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📋 Vencimentos
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Assinaturas, boletos e pagamentos recorrentes — alertas via @lhfex_monitor_bot
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingBill(null); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Vencimento
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
          <p className="text-xs font-medium uppercase text-yellow-700 dark:text-yellow-400">Vence esta semana</p>
          <p className="mt-2 text-2xl font-bold text-yellow-900 dark:text-yellow-200">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(kpis.dueThisWeek)}
          </p>
          <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">próximos 7 dias</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
          <p className="text-xs font-medium uppercase text-blue-700 dark:text-blue-400">Vence este mês</p>
          <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-200">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(kpis.dueThisMonth)}
          </p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">até fim do mês</p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/50 dark:bg-purple-900/20">
          <p className="text-xs font-medium uppercase text-purple-700 dark:text-purple-400">Assinaturas ativas</p>
          <p className="mt-2 text-2xl font-bold text-purple-900 dark:text-purple-200">
            {kpis.activeSubscriptions}
          </p>
          <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">serviços contratados</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/20">
          <p className="text-xs font-medium uppercase text-green-700 dark:text-green-400">Custo mensal estimado</p>
          <p className="mt-2 text-2xl font-bold text-green-900 dark:text-green-200">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(kpis.monthlyEstimate)}
          </p>
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">todos os ativos</p>
        </div>
      </div>

      {/* Formulário inline (add/edit) */}
      {(showForm || editingBill) && (
        <BillForm
          onClose={() => { setShowForm(false); setEditingBill(null); }}
          defaultValues={editingBill ?? undefined}
          isEdit={!!editingBill}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <a
            key={cat}
            href={`?category=${cat}&status=${filters.status}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filters.category === cat
                ? "bg-indigo-600 text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            {cat === "all" ? "Todas" : CATEGORY_LABELS[cat] ?? cat}
          </a>
        ))}
        <div className="ml-auto flex gap-2">
          {["active", "paused", "cancelled", "all"].map((s) => (
            <a
              key={s}
              href={`?category=${filters.category}&status=${s}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filters.status === s
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {s === "active" ? "Ativos" : s === "paused" ? "Pausados" : s === "cancelled" ? "Cancelados" : "Todos"}
            </a>
          ))}
        </div>
      </div>

      {/* Info de alertas */}
      <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-300">
        <Bell className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>
          Alertas enviados todo dia às 8h via <strong>@lhfex_monitor_bot</strong>.
          Relatório semanal completo toda domingo às 9h.
        </span>
      </div>

      {/* Tabela / Lista */}
      {billRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">Nenhum vencimento cadastrado.</p>
          <Button className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar primeiro vencimento
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Categoria</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Vencimento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Frequência</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Débito</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Alerta</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {billRows.map((bill) => {
                  const days = daysUntil(bill.nextDueDate);
                  const { label, color } = urgencyLabel(days);
                  const rowClass = urgencyClass(days);
                  return (
                    <tr
                      key={bill.id}
                      className={`bg-white transition-colors hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900 ${rowClass}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{bill.name}</div>
                        {bill.paymentMethod && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{bill.paymentMethod}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[bill.category] ?? CATEGORY_COLORS.other}`}>
                          {CATEGORY_ICONS[bill.category]}
                          {CATEGORY_LABELS[bill.category] ?? bill.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(bill.amount, bill.currency ?? "BRL")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatDate(bill.nextDueDate)}
                        </div>
                        <div className={`text-xs ${color}`}>{label}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {bill.isRecurring
                          ? bill.recurrenceMonths === 1
                            ? "Mensal"
                            : bill.recurrenceMonths === 12
                            ? "Anual"
                            : `A cada ${bill.recurrenceMonths}m`
                          : "Pontual"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {bill.isAutoDebit ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            ✅ Auto
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Bell className="h-3 w-3" />
                          {bill.alertDaysBefore}d antes
                          {bill.alertOneDayBefore && " + 1d"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {bill.link && (
                            <a
                              href={bill.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              Pagar
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setPayingBill(bill)}
                            title="Registrar pagamento"
                            className="rounded p-1 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingBill(bill); setShowForm(false); }}
                            title="Editar"
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <form method="post" onSubmit={(e) => !confirm("Remover este vencimento?") && e.preventDefault()}>
                            <input type="hidden" name="_intent" value="delete" />
                            <input type="hidden" name="billId" value={bill.id} />
                            <button
                              type="submit"
                              title="Remover"
                              className="rounded p-1 text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-3 lg:hidden">
            {billRows.map((bill) => {
              const days = daysUntil(bill.nextDueDate);
              const { label, color } = urgencyLabel(days);
              const rowClass = urgencyClass(days);
              return (
                <div
                  key={bill.id}
                  className={`rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 ${rowClass.includes("border-l-4") ? rowClass : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{bill.name}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[bill.category] ?? CATEGORY_COLORS.other}`}>
                          {CATEGORY_LABELS[bill.category] ?? bill.category}
                        </span>
                        {bill.isAutoDebit && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            ✅ Auto
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {formatCurrency(bill.amount, bill.currency ?? "BRL")}
                        </span>
                        <span>
                          <span className="text-gray-500">Vence:</span>{" "}
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatDate(bill.nextDueDate)}
                          </span>
                          {" — "}
                          <span className={color}>{label}</span>
                        </span>
                      </div>
                      {bill.paymentMethod && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          via {bill.paymentMethod}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPayingBill(bill)}
                        className="rounded p-1.5 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingBill(bill); setShowForm(false); }}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <form method="post" onSubmit={(e) => !confirm("Remover?") && e.preventDefault()}>
                        <input type="hidden" name="_intent" value="delete" />
                        <input type="hidden" name="billId" value={bill.id} />
                        <button
                          type="submit"
                          className="rounded p-1.5 text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal de Pagamento */}
      {payingBill && (
        <PayModal bill={payingBill} onClose={() => setPayingBill(null)} />
      )}
    </div>
  );
}
