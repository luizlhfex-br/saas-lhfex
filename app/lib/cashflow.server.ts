/**
 * Cashflow Service - Controle de Caixa
 * 
 * Fornece funções para análise de fluxo de caixa mensal:
 * - Lançamentos do mês (receitas e despesas)
 * - Totalizadores (receita total, despesa total, saldo)
 * - Agrupamento por categoria
 */

import { db } from "~/lib/db.server";
import { cashMovements } from "~/drizzle/schema";
import { gte, lte, eq, sql } from "drizzle-orm";

// --- Types ---

export interface CashMovementDTO {
  id: string;
  date: string; // ISO date string
  type: "income" | "expense";
  category: string;
  description: string | null;
  amount: number; // Parsed as number
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

// --- Main Function: Get Cash Flow for Month ---

/**
 * Retorna resumo financeiro do mês
 * @param year - Ano (ex: 2026)
 * @param month - Mês (1-12)
 * @returns Resumo com lançamentos, totais e agrupamento por categoria
 */
export async function getCashFlowForMonth(year: number, month: number): Promise<CashFlowSummary> {
  // Calcular início e fim do mês
  const startDate = new Date(year, month - 1, 1); // month - 1 porque Date usa 0-11
  const endDate = new Date(year, month, 0); // Dia 0 do próximo mês = último dia do mês atual

  const startISO = startDate.toISOString().split("T")[0];
  const endISO = endDate.toISOString().split("T")[0];

  // Buscar todos os lançamentos do mês
  const movements = await db
    .select({
      id: cashMovements.id,
      date: cashMovements.date,
      type: cashMovements.type,
      category: cashMovements.category,
      description: cashMovements.description,
      amount: cashMovements.amount,
      paymentMethod: cashMovements.paymentMethod,
      costCenter: cashMovements.costCenter,
    })
    .from(cashMovements)
    .where(
      sql`${cashMovements.date} >= ${startISO} AND ${cashMovements.date} <= ${endISO}`
    )
    .orderBy(cashMovements.date, cashMovements.createdAt);

  // Converter para DTO (amount como número)
  const movementDTOs: CashMovementDTO[] = movements.map((m) => ({
    id: m.id,
    date: m.date,
    type: m.type as "income" | "expense",
    category: m.category,
    description: m.description,
    amount: parseFloat(m.amount),
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
    year,
    month,
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
