import type {
  processTaxExpenses,
  processTaxItems,
  processTaxWorkbooks,
} from "../../drizzle/schema";

type WorkbookRow = typeof processTaxWorkbooks.$inferSelect;
type ItemRow = typeof processTaxItems.$inferSelect;
type ExpenseRow = typeof processTaxExpenses.$inferSelect;

export type AllocationBasis = "net_weight" | "fob" | "equal";

export type TaxMemoryComputation = {
  allocationBasis: AllocationBasis;
  totals: {
    totalFobUsd: number;
    totalFreightUsd: number;
    totalCifUsd: number;
    totalCifBrl: number;
    totalNetWeightKg: number;
    totalIiBrl: number;
    totalIpiBrl: number;
    totalPisBrl: number;
    totalCofinsBrl: number;
    totalIcmsBrl: number;
    totalBaseExpensesBrl: number;
    totalFinalExpensesBrl: number;
    totalImportCostBrl: number;
    totalLandedCostBrl: number;
  };
  items: Array<{
    id: string;
    partNumber: string;
    description: string;
    ncm: string;
    quantity: number;
    fobUsd: number;
    netWeightKg: number;
    freightUsd: number;
    cifUsd: number;
    cifBrl: number;
    iiRate: number;
    ipiRate: number;
    pisRate: number;
    cofinsRate: number;
    icmsRate: number;
    iiBrl: number;
    ipiBrl: number;
    pisBrl: number;
    cofinsBrl: number;
    baseExpensesBrl: number;
    finalExpensesBrl: number;
    baseIcmsBrl: number;
    icmsBrl: number;
    importCostBrl: number;
    landedCostBrl: number;
  }>;
  ncmSummary: Array<{
    ncm: string;
    itemCount: number;
    quantity: number;
    netWeightKg: number;
    fobUsd: number;
    cifBrl: number;
    iiBrl: number;
    ipiBrl: number;
    pisBrl: number;
    cofinsBrl: number;
    icmsBrl: number;
    baseExpensesBrl: number;
    finalExpensesBrl: number;
    landedCostBrl: number;
  }>;
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function getAllocationBasis(items: ItemRow[]): AllocationBasis {
  const totalNetWeight = items.reduce((sum, item) => sum + Math.max(0, toNumber(item.netWeightKg)), 0);
  if (totalNetWeight > 0) return "net_weight";

  const totalFob = items.reduce((sum, item) => sum + Math.max(0, toNumber(item.fobUsd)), 0);
  if (totalFob > 0) return "fob";

  return "equal";
}

function getShare(item: ItemRow, items: ItemRow[], basis: AllocationBasis): number {
  if (items.length === 0) return 0;

  if (basis === "net_weight") {
    const total = items.reduce((sum, current) => sum + Math.max(0, toNumber(current.netWeightKg)), 0);
    return total > 0 ? Math.max(0, toNumber(item.netWeightKg)) / total : 0;
  }

  if (basis === "fob") {
    const total = items.reduce((sum, current) => sum + Math.max(0, toNumber(current.fobUsd)), 0);
    return total > 0 ? Math.max(0, toNumber(item.fobUsd)) / total : 0;
  }

  return 1 / items.length;
}

export function calculateProcessTaxMemory(params: {
  workbook: WorkbookRow | null;
  items: ItemRow[];
  expenses: ExpenseRow[];
}): TaxMemoryComputation {
  const { workbook, items, expenses } = params;
  const allocationBasis = getAllocationBasis(items);
  const exchangeRate = Math.max(0, toNumber(workbook?.exchangeRate));
  const freightTotalUsd = Math.max(0, toNumber(workbook?.freightTotalUsd));
  const defaultIcmsRate = Math.max(0, toNumber(workbook?.stateIcmsRate));
  const baseExpenses = expenses.filter((expense) => expense.kind === "tax_base");
  const finalExpenses = expenses.filter((expense) => expense.kind === "final");
  const totalBaseExpensesBrl = round2(baseExpenses.reduce((sum, expense) => sum + Math.max(0, toNumber(expense.amountBrl)), 0));
  const totalFinalExpensesBrl = round2(finalExpenses.reduce((sum, expense) => sum + Math.max(0, toNumber(expense.amountBrl)), 0));

  const computedItems = items.map((item) => {
    const share = getShare(item, items, allocationBasis);
    const fobUsd = round2(Math.max(0, toNumber(item.fobUsd)));
    const netWeightKg = round3(Math.max(0, toNumber(item.netWeightKg)));
    const freightUsd = round2(freightTotalUsd * share);
    const cifUsd = round2(fobUsd + freightUsd);
    const cifBrl = round2(cifUsd * exchangeRate);
    const iiRate = Math.max(0, toNumber(item.iiRate));
    const ipiRate = Math.max(0, toNumber(item.ipiRate));
    const pisRate = Math.max(0, toNumber(item.pisRate));
    const cofinsRate = Math.max(0, toNumber(item.cofinsRate));
    const icmsRate = Math.max(0, toNumber(item.icmsRate) || defaultIcmsRate);

    const iiBrl = round2(cifBrl * (iiRate / 100));
    const ipiBase = cifBrl + iiBrl;
    const ipiBrl = round2(ipiBase * (ipiRate / 100));
    const pisCofinsBase = cifBrl + iiBrl + ipiBrl;
    const pisBrl = round2(pisCofinsBase * (pisRate / 100));
    const cofinsBrl = round2(pisCofinsBase * (cofinsRate / 100));
    const baseExpensesBrl = round2(totalBaseExpensesBrl * share);
    const finalExpensesBrl = round2(totalFinalExpensesBrl * share);
    const icmsSeed = cifBrl + iiBrl + ipiBrl + pisBrl + cofinsBrl + baseExpensesBrl;
    const baseIcmsBrl = icmsRate < 100 ? round2(icmsSeed / (1 - icmsRate / 100)) : 0;
    const icmsBrl = round2(baseIcmsBrl * (icmsRate / 100));
    const importCostBrl = round2(baseIcmsBrl);
    const landedCostBrl = round2(importCostBrl + finalExpensesBrl);

    return {
      id: item.id,
      partNumber: item.partNumber || "",
      description: item.description || "",
      ncm: item.ncm || "",
      quantity: round3(Math.max(0, toNumber(item.quantity))),
      fobUsd,
      netWeightKg,
      freightUsd,
      cifUsd,
      cifBrl,
      iiRate,
      ipiRate,
      pisRate,
      cofinsRate,
      icmsRate,
      iiBrl,
      ipiBrl,
      pisBrl,
      cofinsBrl,
      baseExpensesBrl,
      finalExpensesBrl,
      baseIcmsBrl,
      icmsBrl,
      importCostBrl,
      landedCostBrl,
    };
  });

  const totals = computedItems.reduce(
    (acc, item) => {
      acc.totalFobUsd += item.fobUsd;
      acc.totalFreightUsd += item.freightUsd;
      acc.totalCifUsd += item.cifUsd;
      acc.totalCifBrl += item.cifBrl;
      acc.totalNetWeightKg += item.netWeightKg;
      acc.totalIiBrl += item.iiBrl;
      acc.totalIpiBrl += item.ipiBrl;
      acc.totalPisBrl += item.pisBrl;
      acc.totalCofinsBrl += item.cofinsBrl;
      acc.totalIcmsBrl += item.icmsBrl;
      acc.totalImportCostBrl += item.importCostBrl;
      acc.totalLandedCostBrl += item.landedCostBrl;
      return acc;
    },
    {
      totalFobUsd: 0,
      totalFreightUsd: 0,
      totalCifUsd: 0,
      totalCifBrl: 0,
      totalNetWeightKg: 0,
      totalIiBrl: 0,
      totalIpiBrl: 0,
      totalPisBrl: 0,
      totalCofinsBrl: 0,
      totalIcmsBrl: 0,
      totalBaseExpensesBrl,
      totalFinalExpensesBrl,
      totalImportCostBrl: 0,
      totalLandedCostBrl: 0,
    },
  );

  const ncmMap = new Map<string, TaxMemoryComputation["ncmSummary"][number]>();
  for (const item of computedItems) {
    const key = item.ncm || "Sem NCM";
    const current = ncmMap.get(key) || {
      ncm: key,
      itemCount: 0,
      quantity: 0,
      netWeightKg: 0,
      fobUsd: 0,
      cifBrl: 0,
      iiBrl: 0,
      ipiBrl: 0,
      pisBrl: 0,
      cofinsBrl: 0,
      icmsBrl: 0,
      baseExpensesBrl: 0,
      finalExpensesBrl: 0,
      landedCostBrl: 0,
    };

    current.itemCount += 1;
    current.quantity += item.quantity;
    current.netWeightKg += item.netWeightKg;
    current.fobUsd += item.fobUsd;
    current.cifBrl += item.cifBrl;
    current.iiBrl += item.iiBrl;
    current.ipiBrl += item.ipiBrl;
    current.pisBrl += item.pisBrl;
    current.cofinsBrl += item.cofinsBrl;
    current.icmsBrl += item.icmsBrl;
    current.baseExpensesBrl += item.baseExpensesBrl;
    current.finalExpensesBrl += item.finalExpensesBrl;
    current.landedCostBrl += item.landedCostBrl;
    ncmMap.set(key, current);
  }

  return {
    allocationBasis,
    totals: {
      totalFobUsd: round2(totals.totalFobUsd),
      totalFreightUsd: round2(totals.totalFreightUsd),
      totalCifUsd: round2(totals.totalCifUsd),
      totalCifBrl: round2(totals.totalCifBrl),
      totalNetWeightKg: round3(totals.totalNetWeightKg),
      totalIiBrl: round2(totals.totalIiBrl),
      totalIpiBrl: round2(totals.totalIpiBrl),
      totalPisBrl: round2(totals.totalPisBrl),
      totalCofinsBrl: round2(totals.totalCofinsBrl),
      totalIcmsBrl: round2(totals.totalIcmsBrl),
      totalBaseExpensesBrl: round2(totals.totalBaseExpensesBrl),
      totalFinalExpensesBrl: round2(totals.totalFinalExpensesBrl),
      totalImportCostBrl: round2(totals.totalImportCostBrl),
      totalLandedCostBrl: round2(totals.totalLandedCostBrl),
    },
    items: computedItems,
    ncmSummary: Array.from(ncmMap.values()).map((row) => ({
      ...row,
      quantity: round3(row.quantity),
      netWeightKg: round3(row.netWeightKg),
      fobUsd: round2(row.fobUsd),
      cifBrl: round2(row.cifBrl),
      iiBrl: round2(row.iiBrl),
      ipiBrl: round2(row.ipiBrl),
      pisBrl: round2(row.pisBrl),
      cofinsBrl: round2(row.cofinsBrl),
      icmsBrl: round2(row.icmsBrl),
      baseExpensesBrl: round2(row.baseExpensesBrl),
      finalExpensesBrl: round2(row.finalExpensesBrl),
      landedCostBrl: round2(row.landedCostBrl),
    })),
  };
}

export function getSuggestedBaseExpenses(scenario: WorkbookRow["scenario"] | null | undefined): string[] {
  if (scenario === "air") return ["Taxa Siscomex", "Armazenagem"];
  if (scenario === "sea") return ["Taxa Siscomex", "Armazenagem", "AFRMM"];
  return ["Taxa Siscomex", "Armazenagem"];
}
