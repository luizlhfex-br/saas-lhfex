import { and, eq } from "drizzle-orm";
import { db } from "~/lib/db.server";
import { cashMovements } from "../../drizzle/schema";

export type CashMovementType = "income" | "expense";
export type CashMovementStatus = "planned" | "settled" | "cancelled";

export interface CashMovementDTO {
  id: string;
  date: string;
  type: CashMovementType;
  status: CashMovementStatus;
  category: string;
  subcategory: string | null;
  description: string | null;
  amount: number;
  hasInvoice: "S" | "N";
  settlementDate: string | null;
  paymentMethod: string | null;
  costCenter: string | null;
  effectiveDate: string;
  isPending: boolean;
  isOverdue: boolean;
  projectedBalance: number;
}

export interface CategorySummary {
  category: string;
  income: number;
  expense: number;
  net: number;
}

export interface CashflowMonthlyPoint {
  month: string;
  settledIncome: number;
  settledExpense: number;
  projectedNet: number;
}

export interface CashFlowSummary {
  movements: CashMovementDTO[];
  pendingMovements: CashMovementDTO[];
  byCategory: CategorySummary[];
  monthlySeries: CashflowMonthlyPoint[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
  currentBalance: number;
  openingBalance: number;
  settledIncome: number;
  settledExpense: number;
  plannedIncome: number;
  plannedExpense: number;
  realizedClosingBalance: number;
  projectedClosingBalance: number;
  pendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  year: number;
  month: number;
}

export type CashflowQuickPeriod = "this_month" | "last_month" | "this_year" | "custom";

interface CashFlowFilters {
  companyId: string;
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

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function getMonthKey(dateISO: string) {
  return dateISO.slice(0, 7);
}

function getShortMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
    new Date(Number(year), Number(month) - 1, 1),
  );
}

function signedAmount(type: CashMovementType, amount: number) {
  return type === "income" ? amount : -amount;
}

function normalizeStatus(status: string | null | undefined): CashMovementStatus {
  if (status === "planned" || status === "settled" || status === "cancelled") {
    return status;
  }
  return "settled";
}

function compareMovements(a: { date: string; effectiveDate: string }, b: { date: string; effectiveDate: string }) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.effectiveDate.localeCompare(b.effectiveDate);
}

export async function getCashFlowForMonth(year: number, month: number, filters?: CashFlowFilters): Promise<CashFlowSummary> {
  if (!filters?.companyId) {
    throw new Error("companyId is required for cashflow queries");
  }

  const { startISO, endISO, year: resolvedYear, month: resolvedMonth } = getRangeForFilters(year, month, filters);
  const todayISO = getTodayISO();

  const records = await db
    .select({
      id: cashMovements.id,
      date: cashMovements.date,
      type: cashMovements.type,
      status: cashMovements.status,
      category: cashMovements.category,
      subcategory: cashMovements.subcategory,
      description: cashMovements.description,
      amount: cashMovements.amount,
      hasInvoice: cashMovements.hasInvoice,
      settlementDate: cashMovements.settlementDate,
      paymentMethod: cashMovements.paymentMethod,
      costCenter: cashMovements.costCenter,
      createdAt: cashMovements.createdAt,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.companyId, filters.companyId),
        filters.userId ? eq(cashMovements.createdBy, filters.userId) : undefined,
      ),
    )
    .orderBy(cashMovements.date, cashMovements.createdAt);

  const normalized = records.map((record) => {
    const amount = Number(record.amount);
    const status = normalizeStatus(record.status);
    const effectiveDate = record.settlementDate || record.date;
    const isPending = status === "planned";
    return {
      id: record.id,
      date: record.date,
      type: record.type as CashMovementType,
      status,
      category: record.category,
      subcategory: record.subcategory,
      description: record.description,
      amount,
      hasInvoice: (record.hasInvoice as "S" | "N") || "N",
      settlementDate: record.settlementDate,
      paymentMethod: record.paymentMethod,
      costCenter: record.costCenter,
      effectiveDate,
      isPending,
      isOverdue: isPending && record.date < todayISO,
      createdAt: record.createdAt,
    };
  });

  const periodRecords = normalized.filter((record) => record.date >= startISO && record.date <= endISO);
  const activePeriodRecords = periodRecords.filter((record) => record.status !== "cancelled");
  const settledBeforePeriod = normalized.filter(
    (record) => record.status === "settled" && record.effectiveDate < startISO,
  );
  const settledUpToToday = normalized.filter(
    (record) => record.status === "settled" && record.effectiveDate <= todayISO,
  );
  const settledInPeriod = periodRecords.filter((record) => record.status === "settled");

  const openingBalance = settledBeforePeriod.reduce(
    (sum, record) => sum + signedAmount(record.type, record.amount),
    0,
  );
  const currentBalance = settledUpToToday.reduce(
    (sum, record) => sum + signedAmount(record.type, record.amount),
    0,
  );

  const plannedIncome = activePeriodRecords
    .filter((record) => record.type === "income")
    .reduce((sum, record) => sum + record.amount, 0);
  const plannedExpense = activePeriodRecords
    .filter((record) => record.type === "expense")
    .reduce((sum, record) => sum + record.amount, 0);
  const settledIncome = settledInPeriod
    .filter((record) => record.type === "income")
    .reduce((sum, record) => sum + record.amount, 0);
  const settledExpense = settledInPeriod
    .filter((record) => record.type === "expense")
    .reduce((sum, record) => sum + record.amount, 0);

  const pendingMovementsBase = periodRecords
    .filter((record) => record.status === "planned")
    .sort(compareMovements);

  const overdueMovements = pendingMovementsBase.filter((record) => record.isOverdue);
  const overdueAmount = overdueMovements.reduce((sum, record) => sum + record.amount, 0);

  const projectedRows = activePeriodRecords
    .slice()
    .sort(compareMovements);

  let runningProjectedBalance = openingBalance;
  const projectedBalanceMap = new Map<string, number>();
  for (const record of projectedRows) {
    runningProjectedBalance += signedAmount(record.type, record.amount);
    projectedBalanceMap.set(record.id, runningProjectedBalance);
  }

  const movements: CashMovementDTO[] = periodRecords
    .slice()
    .sort(compareMovements)
    .map((record) => ({
      id: record.id,
      date: record.date,
      type: record.type,
      status: record.status,
      category: record.category,
      subcategory: record.subcategory,
      description: record.description,
      amount: record.amount,
      hasInvoice: record.hasInvoice,
      settlementDate: record.settlementDate,
      paymentMethod: record.paymentMethod,
      costCenter: record.costCenter,
      effectiveDate: record.effectiveDate,
      isPending: record.isPending,
      isOverdue: record.isOverdue,
      projectedBalance: projectedBalanceMap.get(record.id) ?? openingBalance,
    }));

  const pendingMovements = movements.filter((record) => record.status === "planned");

  const categoryMap = new Map<string, { income: number; expense: number }>();
  for (const record of activePeriodRecords) {
    const entry = categoryMap.get(record.category) || { income: 0, expense: 0 };
    if (record.type === "income") {
      entry.income += record.amount;
    } else {
      entry.expense += record.amount;
    }
    categoryMap.set(record.category, entry);
  }

  const byCategory: CategorySummary[] = Array.from(categoryMap.entries())
    .map(([category, totals]) => ({
      category,
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const monthKeys = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthlySeries: CashflowMonthlyPoint[] = monthKeys.map((monthKey) => {
    const bucket = normalized.filter((record) => getMonthKey(record.date) === monthKey);
    const activeBucket = bucket.filter((record) => record.status !== "cancelled");
    const settledBucket = bucket.filter((record) => record.status === "settled");
    return {
      month: getShortMonthLabel(monthKey),
      settledIncome: settledBucket
        .filter((record) => record.type === "income")
        .reduce((sum, record) => sum + record.amount, 0),
      settledExpense: settledBucket
        .filter((record) => record.type === "expense")
        .reduce((sum, record) => sum + record.amount, 0),
      projectedNet: activeBucket.reduce((sum, record) => sum + signedAmount(record.type, record.amount), 0),
    };
  });

  const realizedClosingBalance = openingBalance + settledIncome - settledExpense;
  const projectedClosingBalance = openingBalance + plannedIncome - plannedExpense;

  return {
    movements,
    pendingMovements,
    byCategory,
    monthlySeries,
    totalIncome: plannedIncome,
    totalExpense: plannedExpense,
    balance: projectedClosingBalance,
    currentBalance,
    openingBalance,
    settledIncome,
    settledExpense,
    plannedIncome,
    plannedExpense,
    realizedClosingBalance,
    projectedClosingBalance,
    pendingAmount: pendingMovements.reduce((sum, record) => sum + record.amount, 0),
    overdueCount: overdueMovements.length,
    overdueAmount,
    year: resolvedYear,
    month: resolvedMonth,
  };
}

export function parseBrazilianCurrency(value: string): number {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned);
}

export function formatBrazilianCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
