import { and, desc, eq, isNull } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  PiggyBank,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Route } from "./+types/personal-life.finances";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  formatCurrency,
  formatMonthLabel,
  getCurrentMonthKey,
  getEffectiveStatusLabel,
  isOverdue,
  PERSONAL_FINANCE_CATEGORIES,
  PERSONAL_FINANCE_PAYMENT_METHODS,
  PERSONAL_FINANCE_STATUS_OPTIONS,
  PERSONAL_FINANCE_TYPE_OPTIONS,
  toNumber,
  type PersonalFinanceStatus,
  type PersonalFinanceType,
} from "~/lib/personal-finance";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { personalFinance, personalFinanceGoals } from "../../drizzle/schema/personal-life";

const CHART_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#ec4899"];

type ActionState = {
  error?: string;
};

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-");
  return {
    start: `${year}-${monthNumber}-01`,
    end: `${year}-${monthNumber}-31`,
  };
}

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function shortMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date);
}

function parseStatus(value: FormDataEntryValue | null): PersonalFinanceStatus {
  return PERSONAL_FINANCE_STATUS_OPTIONS.some((option) => option.value === value)
    ? (value as PersonalFinanceStatus)
    : "planned";
}

function parseType(value: FormDataEntryValue | null): PersonalFinanceType {
  return PERSONAL_FINANCE_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as PersonalFinanceType)
    : "expense";
}

function parseDateValue(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const url = new URL(request.url);
  const month = url.searchParams.get("month") || getCurrentMonthKey();
  const { start, end } = getMonthRange(month);

  const records = await db
    .select()
    .from(personalFinance)
    .where(and(eq(personalFinance.userId, user.id), isNull(personalFinance.deletedAt)))
    .orderBy(desc(personalFinance.date), desc(personalFinance.createdAt));

  const [goal] = await db
    .select()
    .from(personalFinanceGoals)
    .where(
      and(
        eq(personalFinanceGoals.userId, user.id),
        eq(personalFinanceGoals.month, month),
        isNull(personalFinanceGoals.deletedAt),
      ),
    )
    .limit(1);

  const normalizedRecords = records.map((record) => ({
    ...record,
    amountNumber: toNumber(record.amount),
    statusValue: record.status as PersonalFinanceStatus,
    typeValue: record.type as PersonalFinanceType,
    isOverdue: isOverdue(record.status as PersonalFinanceStatus, record.date),
  }));

  const monthRecords = normalizedRecords.filter((record) => record.date >= start && record.date <= end);
  const settledMonthRecords = monthRecords.filter((record) => record.statusValue === "settled");
  const dueItems = monthRecords
    .filter((record) => record.statusValue === "planned" && record.typeValue === "expense")
    .sort((a, b) => a.date.localeCompare(b.date));

  const receivedIncome = settledMonthRecords
    .filter((record) => record.typeValue === "income")
    .reduce((sum, record) => sum + record.amountNumber, 0);
  const paidExpenses = settledMonthRecords
    .filter((record) => record.typeValue === "expense")
    .reduce((sum, record) => sum + record.amountNumber, 0);
  const plannedIncome = monthRecords
    .filter((record) => record.typeValue === "income" && record.statusValue !== "cancelled")
    .reduce((sum, record) => sum + record.amountNumber, 0);
  const plannedExpenses = monthRecords
    .filter((record) => record.typeValue === "expense" && record.statusValue !== "cancelled")
    .reduce((sum, record) => sum + record.amountNumber, 0);

  const categoryMap = new Map<string, number>();
  for (const record of monthRecords) {
    if (record.typeValue !== "expense" || record.statusValue === "cancelled") continue;
    categoryMap.set(record.category, (categoryMap.get(record.category) || 0) + record.amountNumber);
  }

  const categorySeries = [...categoryMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const months = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthlySeries = months.map((item) => {
    const bucket = normalizedRecords.filter(
      (record) => monthKeyFromDate(record.date) === item && record.statusValue === "settled",
    );
    const receitas = bucket
      .filter((record) => record.typeValue === "income")
      .reduce((sum, record) => sum + record.amountNumber, 0);
    const despesas = bucket
      .filter((record) => record.typeValue === "expense")
      .reduce((sum, record) => sum + record.amountNumber, 0);
    return { month: shortMonth(item), receitas, despesas };
  });

  return {
    month,
    monthLabel: formatMonthLabel(month),
    goalValues: {
      incomeGoal: toNumber(goal?.incomeGoal),
      expenseLimit: toNumber(goal?.expenseLimit),
      savingsGoal: toNumber(goal?.savingsGoal),
      notes: goal?.notes || "",
    },
    recentRecords: normalizedRecords.slice(0, 8),
    dueItems: dueItems.slice(0, 8),
    overdueCount: dueItems.filter((item) => item.isOverdue).length,
    summary: {
      receivedIncome,
      paidExpenses,
      realizedBalance: receivedIncome - paidExpenses,
      projectedBalance: plannedIncome - plannedExpenses,
      pendingBills: dueItems.reduce((sum, item) => sum + item.amountNumber, 0),
    },
    charts: {
      categorySeries,
      monthlySeries,
    },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const month = String(formData.get("month") || getCurrentMonthKey());

  if (intent === "create_entry") {
    const date = parseDateValue(formData.get("date"));
    const type = parseType(formData.get("type"));
    const status = parseStatus(formData.get("status"));
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const amount = String(formData.get("amount") || "").trim().replace(",", ".");

    if (!date || !category || !description || !amount) {
      return data<ActionState>({ error: "Preencha data, categoria, descricao e valor." }, { status: 400 });
    }

    await db.insert(personalFinance).values({
      userId: user.id,
      date,
      type,
      status,
      category,
      description,
      amount,
      currency: "BRL",
      paymentMethod: String(formData.get("paymentMethod") || "").trim() || null,
      isFixed: String(formData.get("isFixed") || "false") === "true",
      settledAt: status === "settled" ? date : null,
      notes: String(formData.get("notes") || "").trim() || null,
      updatedAt: new Date(),
    });

    return redirect(`/personal-life/finances?month=${month}`);
  }

  if (intent === "toggle_status") {
    const id = String(formData.get("id") || "");
    const currentStatus = parseStatus(formData.get("currentStatus"));
    const date = parseDateValue(formData.get("date"));

    if (id) {
      const nextStatus: PersonalFinanceStatus = currentStatus === "settled" ? "planned" : "settled";
      await db
        .update(personalFinance)
        .set({
          status: nextStatus,
          settledAt: nextStatus === "settled" ? date : null,
          updatedAt: new Date(),
        })
        .where(and(eq(personalFinance.id, id), eq(personalFinance.userId, user.id)));
    }

    return redirect(`/personal-life/finances?month=${month}`);
  }

  if (intent === "delete_entry") {
    const id = String(formData.get("id") || "");
    if (id) {
      await db
        .update(personalFinance)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(personalFinance.id, id), eq(personalFinance.userId, user.id)));
    }

    return redirect(`/personal-life/finances?month=${month}`);
  }

  if (intent === "save_goal") {
    const incomeGoal = String(formData.get("incomeGoal") || "").trim().replace(",", ".");
    const expenseLimit = String(formData.get("expenseLimit") || "").trim().replace(",", ".");
    const savingsGoal = String(formData.get("savingsGoal") || "").trim().replace(",", ".");
    const notes = String(formData.get("goalNotes") || "").trim();

    const [existing] = await db
      .select({ id: personalFinanceGoals.id })
      .from(personalFinanceGoals)
      .where(
        and(
          eq(personalFinanceGoals.userId, user.id),
          eq(personalFinanceGoals.month, month),
          isNull(personalFinanceGoals.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(personalFinanceGoals)
        .set({
          incomeGoal: incomeGoal || null,
          expenseLimit: expenseLimit || null,
          savingsGoal: savingsGoal || null,
          notes: notes || null,
          updatedAt: new Date(),
        })
        .where(eq(personalFinanceGoals.id, existing.id));
    } else {
      await db.insert(personalFinanceGoals).values({
        userId: user.id,
        month,
        incomeGoal: incomeGoal || null,
        expenseLimit: expenseLimit || null,
        savingsGoal: savingsGoal || null,
        notes: notes || null,
        updatedAt: new Date(),
      });
    }

    return redirect(`/personal-life/finances?month=${month}#metas`);
  }

  return data<ActionState>({ error: "Acao invalida." }, { status: 400 });
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  helper: string;
  tone: string;
}) {
  return (
    <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--app-muted)]">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--app-text)]">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--app-muted)]">{helper}</p>
    </div>
  );
}

function GoalProgress({
  label,
  current,
  target,
  toneClass,
  inverse = false,
}: {
  label: string;
  current: number;
  target: number;
  toneClass: string;
  inverse?: boolean;
}) {
  const progress =
    target > 0
      ? Math.max(0, Math.min(100, inverse ? ((target - current) / target) * 100 : (current / target) * 100))
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-[var(--app-text)]">{label}</p>
        <p className="text-xs text-[var(--app-muted)]">
          {target > 0 ? `${formatCurrency(current)} / ${formatCurrency(target)}` : "Meta nao definida"}
        </p>
      </div>
      <div className="h-2 rounded-full bg-[var(--app-surface-muted)]">
        <div className={`h-2 rounded-full transition-all ${toneClass}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function PersonalLifeFinancesPage() {
  const { month, monthLabel, goalValues, summary, charts, recentRecords, dueItems, overdueCount } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const incomeTarget = goalValues.incomeGoal;
  const expenseLimit = goalValues.expenseLimit;
  const savingsTarget = goalValues.savingsGoal;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-[var(--app-border)] bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_30%),linear-gradient(135deg,var(--app-surface),#0f172a)] p-6 text-white shadow-[var(--app-shadow-strong)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Link to="/personal-life" className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Vida Pessoal
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/80">Central Financeira Pessoal</p>
              <h1 className="mt-2 text-3xl font-semibold">Receitas, contas e metas sem depender de planilha</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-200">
                Controle o que vai entrar, o que vai sair, o que ja foi pago e o que ainda pressiona o caixa do mes.
              </p>
            </div>
          </div>

          <Form className="flex items-center gap-3" method="get">
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/50"
            />
            <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
              <Clock3 className="h-4 w-4" />
              Atualizar mes
            </button>
          </Form>
        </div>
      </section>

      {actionData?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {actionData.error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={TrendingUp}
          label="Receitas recebidas"
          value={formatCurrency(summary.receivedIncome)}
          helper={`Entradas liquidadas em ${monthLabel}`}
          tone="bg-emerald-500/15 text-emerald-300"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Despesas pagas"
          value={formatCurrency(summary.paidExpenses)}
          helper={`Saidas liquidadas em ${monthLabel}`}
          tone="bg-rose-500/15 text-rose-300"
        />
        <SummaryCard
          icon={Wallet}
          label="Saldo realizado"
          value={formatCurrency(summary.realizedBalance)}
          helper="Resultado real do mes"
          tone="bg-sky-500/15 text-sky-300"
        />
        <SummaryCard
          icon={PiggyBank}
          label="Saldo projetado"
          value={formatCurrency(summary.projectedBalance)}
          helper="Considera tudo que esta previsto no mes"
          tone="bg-violet-500/15 text-violet-300"
        />
        <SummaryCard
          icon={Clock3}
          label="Contas a pagar"
          value={formatCurrency(summary.pendingBills)}
          helper={`${dueItems.length} itens pendentes neste mes`}
          tone="bg-amber-500/15 text-amber-300"
        />
        <SummaryCard
          icon={Target}
          label="Meta de poupanca"
          value={formatCurrency(goalValues.savingsGoal)}
          helper="Alvo de reserva para o mes"
          tone="bg-cyan-500/15 text-cyan-300"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Evolucao mensal</h2>
            <p className="text-sm text-[var(--app-muted)]">Receitas e despesas liquidadas nos ultimos seis meses</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.monthlySeries}>
                <XAxis dataKey="month" stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(value) => formatCurrency(Number(value))}
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  width={92}
                />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[8, 8, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Despesas por categoria</h2>
            <p className="text-sm text-[var(--app-muted)]">Distribuicao do mes atual</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.categorySeries}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {charts.categorySeries.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {charts.categorySeries.length === 0 ? (
                <p className="text-sm text-[var(--app-muted)]">Nenhuma despesa prevista ou paga neste mes.</p>
              ) : (
                charts.categorySeries.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-2xl border border-[var(--app-border)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-[var(--app-text)]">{item.name}</span>
                    </div>
                    <span className="text-sm text-[var(--app-muted)]">{formatCurrency(item.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section id="lancamentos" className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Lancamentos recentes</h2>
            <p className="text-sm text-[var(--app-muted)]">Ultimos itens adicionados na sua base pessoal</p>
          </div>
          <div className="space-y-3">
            {recentRecords.length === 0 ? (
              <p className="text-sm text-[var(--app-muted)]">Ainda nao ha lancamentos cadastrados.</p>
            ) : (
              recentRecords.map((record) => {
                const statusConfig = PERSONAL_FINANCE_STATUS_OPTIONS.find((option) => option.value === record.statusValue);
                const label = getEffectiveStatusLabel(record.statusValue, record.typeValue);

                return (
                  <div key={record.id} className="rounded-[24px] border border-[var(--app-border)] bg-white/70 p-4 dark:bg-slate-950/40">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                              record.typeValue === "income"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                            }`}
                          >
                            {record.typeValue === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          </span>
                          <div>
                            <p className="font-medium text-[var(--app-text)]">{record.description}</p>
                            <p className="text-xs text-[var(--app-muted)]">
                              {new Date(`${record.date}T00:00:00`).toLocaleDateString("pt-BR")} - {record.category}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-full px-2 py-1 font-medium ${statusConfig?.badge || "bg-slate-100 text-slate-700"}`}>
                            {label}
                          </span>
                          {record.isFixed ? (
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                              Fixa
                            </span>
                          ) : null}
                          {record.isOverdue ? (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              Atrasada
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-lg font-semibold ${
                            record.typeValue === "income" ? "text-emerald-600 dark:text-emerald-300" : "text-[var(--app-text)]"
                          }`}
                        >
                          {formatCurrency(record.amountNumber)}
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                          {record.statusValue !== "cancelled" ? (
                            <Form method="post">
                              <input type="hidden" name="intent" value="toggle_status" />
                              <input type="hidden" name="id" value={record.id} />
                              <input type="hidden" name="date" value={record.date} />
                              <input type="hidden" name="month" value={month} />
                              <input type="hidden" name="currentStatus" value={record.statusValue} />
                              <button className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-xs font-medium text-[var(--app-text)] transition hover:bg-[var(--app-surface-muted)]">
                                {record.statusValue === "settled"
                                  ? "Reabrir"
                                  : record.typeValue === "income"
                                    ? "Marcar recebido"
                                    : "Marcar pago"}
                              </button>
                            </Form>
                          ) : null}
                          <Form method="post">
                            <input type="hidden" name="intent" value="delete_entry" />
                            <input type="hidden" name="id" value={record.id} />
                            <input type="hidden" name="month" value={month} />
                            <button className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30">
                              Excluir
                            </button>
                          </Form>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section
            id="metas"
            className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">Metas do mes</h2>
              <p className="text-sm text-[var(--app-muted)]">Defina alvo de receita, limite de gasto e reserva mensal</p>
            </div>

            <div className="space-y-4">
              <GoalProgress
                label="Receitas"
                current={summary.receivedIncome}
                target={incomeTarget}
                toneClass="bg-emerald-500"
              />
              <GoalProgress
                label="Despesas"
                current={summary.paidExpenses}
                target={expenseLimit}
                toneClass="bg-rose-500"
                inverse
              />
              <GoalProgress
                label="Poupanca"
                current={Math.max(summary.realizedBalance, 0)}
                target={savingsTarget}
                toneClass="bg-cyan-500"
              />
            </div>

            <Form method="post" className="mt-5 space-y-3">
              <input type="hidden" name="intent" value="save_goal" />
              <input type="hidden" name="month" value={month} />
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="text-[var(--app-muted)]">Meta de receitas</span>
                  <input
                    type="number"
                    step="0.01"
                    name="incomeGoal"
                    defaultValue={incomeTarget || ""}
                    className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-[var(--app-muted)]">Teto de despesas</span>
                  <input
                    type="number"
                    step="0.01"
                    name="expenseLimit"
                    defaultValue={expenseLimit || ""}
                    className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-[var(--app-muted)]">Meta de poupanca</span>
                  <input
                    type="number"
                    step="0.01"
                    name="savingsGoal"
                    defaultValue={savingsTarget || ""}
                    className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
                  />
                </label>
              </div>
              <label className="space-y-1 text-sm">
                <span className="text-[var(--app-muted)]">Observacoes</span>
                <textarea
                  name="goalNotes"
                  rows={3}
                  defaultValue={goalValues.notes}
                  className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
                />
              </label>
              <button
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--app-text)] px-4 py-3 text-sm font-semibold text-[var(--app-surface)] transition hover:opacity-90 disabled:opacity-60"
              >
                <Target className="h-4 w-4" />
                Salvar metas
              </button>
            </Form>
          </section>

          <section className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--app-text)]">Contas pendentes</h2>
                <p className="text-sm text-[var(--app-muted)]">Itens previstos para pagar neste mes</p>
              </div>
              {overdueCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {overdueCount} atrasada(s)
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              {dueItems.length === 0 ? (
                <p className="text-sm text-[var(--app-muted)]">Nenhuma conta pendente para este mes.</p>
              ) : (
                dueItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-[22px] border border-[var(--app-border)] px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-[var(--app-text)]">{item.description}</p>
                      <p className="text-xs text-[var(--app-muted)]">
                        {new Date(`${item.date}T00:00:00`).toLocaleDateString("pt-BR")} - {item.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--app-text)]">{formatCurrency(item.amountNumber)}</p>
                        <p className={`text-xs ${item.isOverdue ? "text-red-600 dark:text-red-300" : "text-[var(--app-muted)]"}`}>
                          {item.isOverdue ? "Atrasada" : "No prazo"}
                        </p>
                      </div>
                      <Form method="post">
                        <input type="hidden" name="intent" value="toggle_status" />
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="date" value={item.date} />
                        <input type="hidden" name="month" value={month} />
                        <input type="hidden" name="currentStatus" value={item.statusValue} />
                        <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Marcar paga
                        </button>
                      </Form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-[32px] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--app-text)]">Novo lancamento</h2>
            <p className="text-sm text-[var(--app-muted)]">
              Registre contas previstas, receitas esperadas e pagamentos que ja aconteceram.
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--app-muted)]">
            Fluxo aprovado: previsto - pago/recebido
          </p>
        </div>

        <Form method="post" className="grid gap-4 lg:grid-cols-2">
          <input type="hidden" name="intent" value="create_entry" />
          <input type="hidden" name="month" value={month} />

          <label className="space-y-1 text-sm">
            <span className="text-[var(--app-muted)]">Descricao</span>
            <input
              required
              name="description"
              placeholder="Ex.: Aluguel, salario, internet, freela"
              className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--app-muted)]">Categoria</span>
            <input
              required
              name="category"
              list="personal-finance-categories"
              placeholder="Ex.: Moradia, Alimentacao, Salario"
              className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--app-muted)]">Tipo</span>
            <select
              name="type"
              defaultValue="expense"
              className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
            >
              {PERSONAL_FINANCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--app-muted)]">Status inicial</span>
            <select
              name="status"
              defaultValue="planned"
              className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
            >
              {PERSONAL_FINANCE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--app-muted)]">Data</span>
            <input
              required
              type="date"
              name="date"
              defaultValue={`${month}-01`}
              className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--app-muted)]">Valor</span>
            <input
              required
              type="number"
              step="0.01"
              name="amount"
              placeholder="0,00"
              className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--app-muted)]">Meio de pagamento</span>
            <select
              name="paymentMethod"
              defaultValue=""
              className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
            >
              <option value="">Nao informado</option>
              {PERSONAL_FINANCE_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--app-border)] px-4 py-3 text-sm text-[var(--app-text)]">
              <input type="hidden" name="isFixed" value="false" />
              <input type="checkbox" name="isFixed" value="true" className="h-4 w-4 rounded border-[var(--app-border)]" />
              Conta fixa ou recorrente
            </label>
          </div>

          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="text-[var(--app-muted)]">Observacoes</span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Anote contexto, parcelamento, origem da receita ou qualquer detalhe util."
              className="w-full rounded-2xl border border-[var(--app-border)] bg-transparent px-4 py-3 text-[var(--app-text)] outline-none transition focus:border-emerald-400"
            />
          </label>

          <div className="lg:col-span-2">
            <button
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Salvar lancamento
            </button>
          </div>
        </Form>

        <datalist id="personal-finance-categories">
          {[...PERSONAL_FINANCE_CATEGORIES.income, ...PERSONAL_FINANCE_CATEGORIES.expense].map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </section>
    </div>
  );
}
