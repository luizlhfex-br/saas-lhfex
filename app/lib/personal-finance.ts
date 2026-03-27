export type PersonalFinanceStatus = "planned" | "settled" | "cancelled";
export type PersonalFinanceType = "income" | "expense";

export const PERSONAL_FINANCE_STATUS_OPTIONS: {
  value: PersonalFinanceStatus;
  label: string;
  badge: string;
}[] = [
  { value: "planned", label: "Previsto", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "settled", label: "Liquidado", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { value: "cancelled", label: "Cancelado", badge: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
];

export const PERSONAL_FINANCE_TYPE_OPTIONS: {
  value: PersonalFinanceType;
  label: string;
}[] = [
  { value: "income", label: "Receita" },
  { value: "expense", label: "Despesa" },
];

export const PERSONAL_FINANCE_CATEGORIES = {
  income: [
    "Salario",
    "Freela",
    "Pro-labore",
    "Comissao",
    "Cashback",
    "Dividendos",
    "Juros",
    "Venda",
    "Reembolso",
    "Outros",
  ],
  expense: [
    "Moradia",
    "Condominio",
    "Energia",
    "Agua",
    "Internet",
    "Telefone",
    "Assinaturas",
    "Alimentacao",
    "Mercado",
    "Transporte",
    "Saude",
    "Educacao",
    "Lazer",
    "Compras",
    "Impostos",
    "Seguros",
    "Pets",
    "Viagens",
    "Presentes",
    "Outros",
  ],
} as const;

export const PERSONAL_FINANCE_PAYMENT_METHODS = [
  "PIX",
  "Debito",
  "Credito",
  "Boleto",
  "Dinheiro",
  "Transferencia",
  "Automatico",
  "Outro",
] as const;

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-");
  return {
    start: `${year}-${monthNumber}-01`,
    end: `${year}-${monthNumber}-31`,
  };
}

export function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

export function getEffectiveStatusLabel(status: PersonalFinanceStatus, type: PersonalFinanceType) {
  if (status === "settled") return type === "income" ? "Recebido" : "Pago";
  if (status === "planned") return type === "income" ? "A receber" : "A pagar";
  return "Cancelado";
}

export function isOverdue(status: PersonalFinanceStatus, date: string) {
  if (status !== "planned") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`).getTime() < today.getTime();
}
