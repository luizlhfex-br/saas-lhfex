/**
 * GET /personal-life/finances/analytics
 * Análise gráfica das finanças pessoais (Recharts)
 */

import { Link, useLoaderData } from "react-router";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  companyProfile,
  fireflyAccounts,
  fireflyTransactions,
} from "../../drizzle/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BarChart2, ArrowLeft } from "lucide-react";

const PIE_COLORS = [
  "#6366f1", "#3b82f6", "#14b8a6", "#22c55e",
  "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
  "#06b6d4", "#84cc16",
];

export async function loader({ request }: { request: Request }) {
  await requireAuth(request);

  const [company] = await db.select().from(companyProfile).limit(1);
  if (!company) return { company: null, monthly: [], categories: [], accounts: [], totalBalance: 0 };

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [monthlyRows, categoryRows, accounts] = await Promise.all([
    // Monthly totals by count and amount (last 6 months)
    db.select({
      month: sql<string>`to_char(${fireflyTransactions.transactionDate}, 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
      total: sql<number>`sum(${fireflyTransactions.amount})::numeric`,
    })
      .from(fireflyTransactions)
      .where(
        and(
          eq(fireflyTransactions.companyId, company.id),
          gte(fireflyTransactions.transactionDate, sixMonthsAgo)
        )
      )
      .groupBy(sql`to_char(${fireflyTransactions.transactionDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${fireflyTransactions.transactionDate}, 'YYYY-MM')`),

    // Top categories by total amount
    db.select({
      category: fireflyTransactions.category,
      count: sql<number>`count(*)::int`,
      total: sql<number>`sum(${fireflyTransactions.amount})::numeric`,
    })
      .from(fireflyTransactions)
      .where(
        and(
          eq(fireflyTransactions.companyId, company.id),
          gte(fireflyTransactions.transactionDate, sixMonthsAgo)
        )
      )
      .groupBy(fireflyTransactions.category)
      .orderBy(desc(sql`sum(${fireflyTransactions.amount})`))
      .limit(10),

    // Accounts with balance
    db.select().from(fireflyAccounts)
      .where(and(eq(fireflyAccounts.companyId, company.id), eq(fireflyAccounts.isActive, true))),
  ]);

  // Format month labels (YYYY-MM → Abr/25)
  const MONTH_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthly = monthlyRows.map(row => {
    const [year, month] = row.month.split("-");
    const monthLabel = MONTH_PT[Number(month) - 1] ?? row.month;
    return {
      month: `${monthLabel}/${String(year).slice(2)}`,
      count: row.count,
      total: Number(Number(row.total).toFixed(2)),
    };
  });

  const categories = categoryRows.map(r => ({
    name: r.category || "Sem categoria",
    count: r.count,
    total: Number(Number(r.total).toFixed(2)),
  }));

  const totalBalance = accounts
    .filter(a => a.accountType === "asset")
    .reduce((s, a) => s + Number(a.currentBalance), 0);

  const totalLiability = accounts
    .filter(a => a.accountType === "liability")
    .reduce((s, a) => s + Number(a.currentBalance), 0);

  return {
    company,
    monthly,
    categories,
    accounts: accounts.map(a => ({
      name: a.name,
      type: a.accountType,
      balance: Number(a.currentBalance),
    })),
    totalBalance,
    totalLiability,
    netWorth: totalBalance - totalLiability,
  };
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function FinancesAnalyticsPage() {
  const { company, monthly, categories, accounts, totalBalance, totalLiability, netWorth } =
    useLoaderData<typeof loader>();

  if (!company) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure o perfil da empresa em Configurações para ativar as finanças.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/personal-life/finances"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <BarChart2 className="h-6 w-6 text-indigo-500" />
            Analytics Financeiro
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Últimos 6 meses</p>
        </div>
      </div>

      {/* Patrimônio Líquido */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase text-gray-500">Ativos Totais</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{fmtBRL(totalBalance)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase text-gray-500">Passivos Totais</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{fmtBRL(totalLiability)}</p>
        </div>
        <div className={`rounded-xl border p-5 ${
          netWorth >= 0
            ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20"
            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
        }`}>
          <p className="text-xs font-medium uppercase text-gray-500">Patrimônio Líquido</p>
          <p className={`mt-1 text-2xl font-bold ${netWorth >= 0 ? "text-indigo-600" : "text-red-600"}`}>
            {fmtBRL(netWorth)}
          </p>
        </div>
      </div>

      {/* Monthly bar chart */}
      {monthly.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Volume de Lançamentos por Mês
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={v => fmtBRL(v)}
                width={80}
              />
              <Tooltip
                formatter={(v: number) => [fmtBRL(v), "Total"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Categories pie */}
        {categories.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Lançamentos por Categoria (6 meses)
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={11}
                >
                  {categories.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top categories table */}
        {categories.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Top Categorias — Total (6 meses)
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2 text-right">Lançamentos</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {categories.map((c, idx) => (
                  <tr key={idx}>
                    <td className="py-2 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      {c.name}
                    </td>
                    <td className="py-2 text-right text-gray-500">{c.count}</td>
                    <td className="py-2 text-right font-medium">{fmtBRL(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account balances */}
      {accounts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Saldos por Conta</h2>
          <div className="space-y-2">
            {accounts.map((a, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.name}</span>
                  <span className="ml-2 text-xs uppercase text-gray-400">{a.type}</span>
                </div>
                <span className={`text-sm font-semibold ${a.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmtBRL(a.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {monthly.length === 0 && categories.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
          <BarChart2 className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Nenhum lançamento nos últimos 6 meses para analisar
          </p>
        </div>
      )}
    </div>
  );
}
