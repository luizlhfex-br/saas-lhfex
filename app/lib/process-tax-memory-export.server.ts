import * as XLSX from "xlsx";
import type {
  processTaxExpenses,
  processTaxItems,
  processTaxWorkbooks,
} from "../../drizzle/schema";
import type { TaxMemoryComputation } from "./process-tax-memory.server";

type WorkbookRow = typeof processTaxWorkbooks.$inferSelect;
type ItemRow = typeof processTaxItems.$inferSelect;
type ExpenseRow = typeof processTaxExpenses.$inferSelect;

type ProcessContext = {
  reference: string;
  processType: string;
  totalWeight: string | null;
  clientName: string | null;
  clientRazao: string | null;
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scenarioLabel(value: WorkbookRow["scenario"] | null | undefined): string {
  if (value === "air") return "Aéreo";
  if (value === "sea") return "Marítimo";
  return "Outro";
}

function allocationLabel(value: TaxMemoryComputation["allocationBasis"]): string {
  if (value === "net_weight") return "Peso líquido";
  if (value === "fob") return "FOB";
  return "Igualitário";
}

function applyColumnWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
}

export function buildProcessTaxMemoryWorkbook(params: {
  process: ProcessContext;
  workbook: WorkbookRow | null;
  items: ItemRow[];
  expenses: ExpenseRow[];
  calculation: TaxMemoryComputation;
}): Buffer {
  const { process, workbook, expenses, calculation } = params;
  const baseExpenses = expenses.filter((expense) => expense.kind === "tax_base");
  const finalExpenses = expenses.filter((expense) => expense.kind === "final");

  const paramRows: Array<Array<string | number>> = [
    ["Memória de Impostos", process.reference],
    ["Cliente", process.clientName || process.clientRazao || ""],
    ["Tipo", process.processType === "import" ? "Importação" : process.processType],
    [],
    ["Parâmetro", "Valor"],
    ["Perfil de despesas", scenarioLabel(workbook?.scenario)],
    ["Moeda base", workbook?.currency || "USD"],
    ["Cotação USD/BRL", toNumber(workbook?.exchangeRate)],
    ["Frete total (USD)", toNumber(workbook?.freightTotalUsd)],
    ["ICMS (%)", toNumber(workbook?.stateIcmsRate)],
    ["Data da cotação", formatDate(workbook?.quoteDate)],
    ["Peso total do processo (kg)", toNumber(process.totalWeight)],
    ["Base de rateio", allocationLabel(calculation.allocationBasis)],
    ["Observações", workbook?.notes || ""],
    [],
    ["Despesas na base do ICMS"],
    ["Descrição", "Valor (BRL)", "Observações"],
    ...baseExpenses.map((expense) => [expense.label, toNumber(expense.amountBrl), expense.notes || ""]),
    [],
    ["Despesas finais do processo"],
    ["Descrição", "Valor (BRL)", "Observações"],
    ...finalExpenses.map((expense) => [expense.label, toNumber(expense.amountBrl), expense.notes || ""]),
    [],
    ["Totais", "Valor"],
    ["FOB total (USD)", calculation.totals.totalFobUsd],
    ["Frete total (USD)", calculation.totals.totalFreightUsd],
    ["CIF total (USD)", calculation.totals.totalCifUsd],
    ["CIF total (BRL)", calculation.totals.totalCifBrl],
    ["Peso líquido total (kg)", calculation.totals.totalNetWeightKg],
    ["II total (BRL)", calculation.totals.totalIiBrl],
    ["IPI total (BRL)", calculation.totals.totalIpiBrl],
    ["PIS total (BRL)", calculation.totals.totalPisBrl],
    ["COFINS total (BRL)", calculation.totals.totalCofinsBrl],
    ["ICMS total (BRL)", calculation.totals.totalIcmsBrl],
    ["Despesas base total (BRL)", calculation.totals.totalBaseExpensesBrl],
    ["Despesas finais total (BRL)", calculation.totals.totalFinalExpensesBrl],
    ["Custo importação total (BRL)", calculation.totals.totalImportCostBrl],
    ["Custo final total (BRL)", calculation.totals.totalLandedCostBrl],
  ];

  const detailRows: Array<Array<string | number>> = [
    [
      "Part Number",
      "Descrição",
      "NCM",
      "Quantidade",
      "Peso líquido (kg)",
      "FOB USD",
      "Frete USD",
      "CIF USD",
      "CIF BRL",
      "II %",
      "II BRL",
      "IPI %",
      "IPI BRL",
      "PIS %",
      "PIS BRL",
      "COFINS %",
      "COFINS BRL",
      "ICMS %",
      "Base ICMS BRL",
      "ICMS BRL",
      "Despesas base BRL",
      "Despesas finais BRL",
      "Custo importação BRL",
      "Custo final BRL",
    ],
    ...calculation.items.map((item) => [
      item.partNumber,
      item.description,
      item.ncm,
      item.quantity,
      item.netWeightKg,
      item.fobUsd,
      item.freightUsd,
      item.cifUsd,
      item.cifBrl,
      item.iiRate,
      item.iiBrl,
      item.ipiRate,
      item.ipiBrl,
      item.pisRate,
      item.pisBrl,
      item.cofinsRate,
      item.cofinsBrl,
      item.icmsRate,
      item.baseIcmsBrl,
      item.icmsBrl,
      item.baseExpensesBrl,
      item.finalExpensesBrl,
      item.importCostBrl,
      item.landedCostBrl,
    ]),
  ];

  const summaryRows: Array<Array<string | number>> = [
    [
      "NCM",
      "Itens",
      "Quantidade",
      "Peso líquido (kg)",
      "FOB USD",
      "CIF BRL",
      "II BRL",
      "IPI BRL",
      "PIS BRL",
      "COFINS BRL",
      "ICMS BRL",
      "Despesas base BRL",
      "Despesas finais BRL",
      "Custo final BRL",
    ],
    ...calculation.ncmSummary.map((row) => [
      row.ncm,
      row.itemCount,
      row.quantity,
      row.netWeightKg,
      row.fobUsd,
      row.cifBrl,
      row.iiBrl,
      row.ipiBrl,
      row.pisBrl,
      row.cofinsBrl,
      row.icmsBrl,
      row.baseExpensesBrl,
      row.finalExpensesBrl,
      row.landedCostBrl,
    ]),
  ];

  const workbookOutput = XLSX.utils.book_new();
  const paramSheet = XLSX.utils.aoa_to_sheet(paramRows);
  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

  applyColumnWidths(paramSheet, [28, 24, 38]);
  applyColumnWidths(detailSheet, [18, 32, 14, 12, 16, 12, 12, 12, 12, 10, 12, 10, 12, 10, 12, 12, 12, 10, 14, 12, 16, 16, 18, 18]);
  applyColumnWidths(summarySheet, [16, 10, 12, 16, 12, 12, 12, 12, 12, 12, 12, 16, 16, 18]);

  XLSX.utils.book_append_sheet(workbookOutput, paramSheet, "Parametros");
  XLSX.utils.book_append_sheet(workbookOutput, detailSheet, "Detalhamento por Item");
  XLSX.utils.book_append_sheet(workbookOutput, summarySheet, "Resumo por NCM");

  return Buffer.from(
    XLSX.write(workbookOutput, {
      type: "buffer",
      bookType: "xlsx",
      compression: true,
    }),
  );
}
