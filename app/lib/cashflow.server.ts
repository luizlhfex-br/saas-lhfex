/**
 * Cashflow Service - Controle de Caixa
 * 
 * Fornece funções para análise de fluxo de caixa mensal:
 * - Lançamentos do mês (receitas e despesas)
 * - Totalizadores (receita total, despesa total, saldo)
 * - Agrupamento por categoria
 */

import { db } from "~/lib/db.server";
import { cashMovements } from "../../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";

// --- Types ---

export interface CashMovementDTO {
  id: string;
  date: string; // ISO date string
  type: "income" | "expense";
  category: string;
  subcategory: string | null;
  description: string | null;
  amount: number; // Parsed as number
  hasInvoice: "S" | "N";
  settlementDate: string | null;
  paymentMethod: string | null;
  costCenter: string | null;
}

export interface CategorySummary {
  category: string;
  income: number;
  expense: number;
  net: number;
}

export interface CashFlowSummary {
  movements: CashMovementDTO[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: CategorySummary[];
  year: number;
  month: number;
}

export type CashflowQuickPeriod = "this_month" | "last_month" | "this_year" | "custom";

interface CashFlowFilters {
  userId?: string;
  period?: CashflowQuickPeriod;
  startDate?: string;
  endDate?: string;
}

interface DateRange {
  startISO: string;
  endISO: string;
  year: number;
  month: number;
}

function getRangeForFilters(year: number, month: number, filters?: CashFlowFilters): DateRange {
  const now = new Date();
  const period = filters?.period;

  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startISO: start.toISOString().split("T")[0],
      endISO: end.toISOString().split("T")[0],
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  if (period === "last_month") {
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const start = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
    const end = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);
    return {
      startISO: start.toISOString().split("T")[0],
      endISO: end.toISOString().split("T")[0],
      year: lastMonthDate.getFullYear(),
      month: lastMonthDate.getMonth() + 1,
    };
  }

  if (period === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return {
      startISO: start.toISOString().split("T")[0],
      endISO: end.toISOString().split("T")[0],
      year: now.getFullYear(),
      month: 0,
    };
  }

  if (period === "custom" && filters?.startDate && filters?.endDate) {
    const customStart = new Date(filters.startDate);
    return {
      startISO: filters.startDate,
      endISO: filters.endDate,
      year: customStart.getFullYear(),
      month: customStart.getMonth() + 1,
    };
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  return {
    startISO: startDate.toISOString().split("T")[0],
    endISO: endDate.toISOString().split("T")[0],
    year,
    month,
  };
}

// --- Main Function: Get Cash Flow for Month ---

/**
 * Retorna resumo financeiro do mês
 * @param year - Ano (ex: 2026)
 * @param month - Mês (1-12)
 * @returns Resumo com lançamentos, totais e agrupamento por categoria
 */
export async function getCashFlowForMonth(year: number, month: number, filters?: CashFlowFilters): Promise<CashFlowSummary> {
  const { startISO, endISO, year: resolvedYear, month: resolvedMonth } = getRangeForFilters(year, month, filters);

  // Buscar todos os lançamentos do mês
  const movements = await db
    .select({
      id: cashMovements.id,
      date: cashMovements.date,
      type: cashMovements.type,
      category: cashMovements.category,
      subcategory: cashMovements.subcategory,
      description: cashMovements.description,
      amount: cashMovements.amount,
      hasInvoice: cashMovements.hasInvoice,
      settlementDate: cashMovements.settlementDate,
      paymentMethod: cashMovements.paymentMethod,
      costCenter: cashMovements.costCenter,
    })
    .from(cashMovements)
    .where(and(
      sql`${cashMovements.date} >= ${startISO} AND ${cashMovements.date} <= ${endISO}`,
      filters?.userId ? eq(cashMovements.createdBy, filters.userId) : undefined,
    ))
    .orderBy(cashMovements.date, cashMovements.createdAt);

  // Converter para DTO (amount como número)
  const movementDTOs: CashMovementDTO[] = movements.map((m) => ({
    id: m.id,
    date: m.date,
    type: m.type as "income" | "expense",
    category: m.category,
    subcategory: m.subcategory,
    description: m.description,
    amount: parseFloat(m.amount),
    hasInvoice: (m.hasInvoice as "S" | "N") || "N",
    settlementDate: m.settlementDate,
    paymentMethod: m.paymentMethod,
    costCenter: m.costCenter,
  }));

  // Calcular totais
  let totalIncome = 0;
  let totalExpense = 0;

  for (const movement of movementDTOs) {
    if (movement.type === "income") {
      totalIncome += movement.amount;
    } else {
      totalExpense += movement.amount;
    }
  }

  const balance = totalIncome - totalExpense;

  // Agrupar por categoria
  const categoryMap = new Map<string, { income: number; expense: number }>();

  for (const movement of movementDTOs) {
    if (!categoryMap.has(movement.category)) {
      categoryMap.set(movement.category, { income: 0, expense: 0 });
    }

    const entry = categoryMap.get(movement.category)!;

    if (movement.type === "income") {
      entry.income += movement.amount;
    } else {
      entry.expense += movement.amount;
    }
  }

  const byCategory: CategorySummary[] = Array.from(categoryMap.entries())
    .map(([category, totals]) => ({
      category,
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)); // Ordenar por impacto absoluto

  return {
    movements: movementDTOs,
    totalIncome,
    totalExpense,
    balance,
    byCategory,
    year: resolvedYear,
    month: resolvedMonth,
  };
}

/**
 * Utilitário: Parse de valor monetário brasileiro (1.234,56 → 1234.56)
 * @param value - String no formato brasileiro
 * @returns Número parseado
 */
export function parseBrazilianCurrency(value: string): number {
  // Remove pontos de milhar, troca vírgula por ponto
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned);
}

/**
 * Utilitário: Formata número para moeda brasileira (1234.56 → "1.234,56")
 * @param value - Número
 * @returns String formatada
 */
export function formatBrazilianCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
