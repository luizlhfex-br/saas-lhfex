import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients, processes, invoices, notifications } from "../../drizzle/schema";
import { isNull, eq, sql, and, notInArray, desc } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { DollarSign, FileText, Users, TrendingUp, Bot, Bell, Clock, BarChart3, Server, ExternalLink } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

// Exchange rate cache
let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchExchangeRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate && now - cachedRate.timestamp < CACHE_TTL) return cachedRate.rate;

  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const rate = parseFloat(data.USDBRL.bid);
    cachedRate = { rate, timestamp: now };
    return rate;
  } catch {
    return cachedRate?.rate ?? 5.50;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  // Parallel queries
  const [
    clientCountResult,
    processCountResult,
    revenueResult,
    recentProcs,
    dollarRate,
    receivables30,
    receivables60,
    receivables90,
    payables30,
    payables60,
    payables90,
    recentNotifs,
    unreadNotifCount,
    cashflowData,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(clients).where(isNull(clients.deletedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(processes).where(
      and(isNull(processes.deletedAt), notInArray(processes.status, ["completed", "cancelled"]))
    ),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(
      and(eq(invoices.type, "receivable"), eq(invoices.status, "paid"),
        sql`date_trunc('month', ${invoices.paidDate}::date) = date_trunc('month', current_date)`)
    ),
    db.select({
      id: processes.id, reference: processes.reference, status: processes.status,
      processType: processes.processType, eta: processes.eta,
    }).from(processes).where(isNull(processes.deletedAt)).orderBy(desc(processes.createdAt)).limit(5),
    fetchExchangeRate(),
    // Receivables by period
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(
      and(eq(invoices.type, "receivable"), notInArray(invoices.status, ["paid", "cancelled"]),
        sql`${invoices.dueDate}::date <= current_date + interval '30 days'`)
    ),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(
      and(eq(invoices.type, "receivable"), notInArray(invoices.status, ["paid", "cancelled"]),
        sql`${invoices.dueDate}::date > current_date + interval '30 days' AND ${invoices.dueDate}::date <= current_date + interval '60 days'`)
    ),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(
      and(eq(invoices.type, "receivable"), notInArray(invoices.status, ["paid", "cancelled"]),
        sql`${invoices.dueDate}::date > current_date + interval '60 days' AND ${invoices.dueDate}::date <= current_date + interval '90 days'`)
    ),
    // Payables by period
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(
      and(eq(invoices.type, "payable"), notInArray(invoices.status, ["paid", "cancelled"]),
        sql`${invoices.dueDate}::date <= current_date + interval '30 days'`)
    ),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(
      and(eq(invoices.type, "payable"), notInArray(invoices.status, ["paid", "cancelled"]),
        sql`${invoices.dueDate}::date > current_date + interval '30 days' AND ${invoices.dueDate}::date <= current_date + interval '60 days'`)
    ),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(
      and(eq(invoices.type, "payable"), notInArray(invoices.status, ["paid", "cancelled"]),
        sql`${invoices.dueDate}::date > current_date + interval '60 days' AND ${invoices.dueDate}::date <= current_date + interval '90 days'`)
    ),
    // Recent notifications
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(5),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(
      and(eq(notifications.userId, user.id), eq(notifications.read, false))
    ),
    // Cashflow — last 30 days by week
    db.select({
      week: sql<string>`to_char(date_trunc('week', ${invoices.dueDate}::date), 'DD/MM')`,
      receivable: sql<number>`coalesce(sum(case when ${invoices.type} = 'receivable' then ${invoices.total}::numeric else 0 end), 0)`,
      payable: sql<number>`coalesce(sum(case when ${invoices.type} = 'payable' then ${invoices.total}::numeric else 0 end), 0)`,
    }).from(invoices).where(
      and(notInArray(invoices.status, ["cancelled"]),
        sql`${invoices.dueDate}::date >= current_date - interval '30 days'`,
        sql`${invoices.dueDate}::date <= current_date + interval '30 days'`)
    ).groupBy(sql`date_trunc('week', ${invoices.dueDate}::date)`)
      .orderBy(sql`date_trunc('week', ${invoices.dueDate}::date)`),
  ]);

  const financialChart = [
    { period: "0-30d", receber: Number(receivables30[0]?.total ?? 0), pagar: Number(payables30[0]?.total ?? 0) },
    { period: "30-60d", receber: Number(receivables60[0]?.total ?? 0), pagar: Number(payables60[0]?.total ?? 0) },
    { period: "60-90d", receber: Number(receivables90[0]?.total ?? 0), pagar: Number(payables90[0]?.total ?? 0) },
  ];

  const cashflow = cashflowData.map((row) => ({
    week: row.week,
    entrada: Number(row.receivable),
    saida: Number(row.payable),
    saldo: Number(row.receivable) - Number(row.payable),
  }));

  return {
    user: { id: user.id, name: user.name, locale: user.locale },
    locale,
    stats: {
      dollarRate,
      activeProcesses: processCountResult[0]?.count ?? 0,
      activeClients: clientCountResult[0]?.count ?? 0,
      monthlyRevenue: Number(revenueResult[0]?.total ?? 0),
    },
    recentProcesses: recentProcs,
    financialChart,
    cashflow,
    recentNotifications: recentNotifs,
    unreadNotifCount: unreadNotifCount[0]?.count ?? 0,
  };
}

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default", in_progress: "info", awaiting_docs: "warning", customs_clearance: "warning",
  in_transit: "info", delivered: "success", completed: "success", cancelled: "danger",
};

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { user, locale, stats, recentProcesses, financialChart, cashflow, recentNotifications, unreadNotifCount } = loaderData;
  const i18n = t(locale);

  const statusLabels: Record<string, string> = {
    draft: i18n.processes.draft, in_progress: i18n.processes.inProgress,
    awaiting_docs: i18n.processes.awaitingDocs, customs_clearance: i18n.processes.customsClearance,
    in_transit: i18n.processes.inTransit, delivered: i18n.processes.delivered,
    completed: i18n.processes.completed, cancelled: i18n.processes.cancelled,
  };

  const statCards = [
    { label: i18n.dashboard.dollarRate, value: `R$ ${stats.dollarRate.toFixed(2)}`, icon: DollarSign, color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20" },
    { label: i18n.dashboard.activeProcesses, value: stats.activeProcesses.toString(), icon: FileText, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20" },
    { label: i18n.dashboard.activeClients, value: stats.activeClients.toString(), icon: Users, color: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20" },
    { label: i18n.dashboard.monthlyRevenue, value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.monthlyRevenue), icon: TrendingUp, color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20" },
  ];

  const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

  const agents = [
    { name: i18n.agents.airton, status: "online" as const },
    { name: i18n.agents.iana, status: "online" as const },
    { name: i18n.agents.maria, status: "online" as const },
    { name: i18n.agents.iago, status: "online" as const },
  ];

  const typeIcon: Record<string, string> = {
    process_status: "📦", invoice_due: "💰", eta_approaching: "🚢", automation: "⚡", system: "🔔",
  };

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.dashboard.greeting(user.name)}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Financial chart — Receivables vs Payables */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">A Receber vs A Pagar</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialChart} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip formatter={(v) => fmtBRL(Number(v ?? 0))} labelStyle={{ color: "#374151" }} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <Legend />
                <Bar dataKey="receber" name="A Receber" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pagar" name="A Pagar" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cashflow Line Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Fluxo de Caixa (30 dias)</h2>
          </div>
          <div className="h-64">
            {cashflow.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip formatter={(v) => fmtBRL(Number(v ?? 0))} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                  <Legend />
                  <Line type="monotone" dataKey="entrada" name="Entradas" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="saida" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Sem dados financeiros para o período
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Processes */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{i18n.dashboard.recentProcesses}</h2>
          </div>
          {recentProcesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-700" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.dashboard.noProcesses}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProcesses.map((proc) => (
                <Link key={proc.id} to={`/processes/${proc.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{proc.reference}</p>
                      {proc.eta && <p className="text-xs text-gray-500">ETA: {new Date(proc.eta).toLocaleDateString("pt-BR")}</p>}
                    </div>
                  </div>
                  <Badge variant={statusColors[proc.status]}>{statusLabels[proc.status] || proc.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Notifications */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {i18n.dashboard.alerts}
                  {unreadNotifCount > 0 && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      {unreadNotifCount}
                    </span>
                  )}
                </h2>
              </div>
            </div>
            {recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-700" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.dashboard.noAlerts}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentNotifications.map((notif) => (
                  <div key={notif.id} className={`rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-800 ${!notif.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">{typeIcon[notif.type] || "🔔"}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`${notif.read ? "text-gray-600 dark:text-gray-400" : "font-medium text-gray-900 dark:text-gray-100"}`}>{notif.title}</p>
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{notif.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VPS quick links */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Servidor</h2>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <a href="https://app.lhfex.com.br" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
                <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                  <span className="text-lg">🐳</span> Coolify Dashboard
                </span>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
              <a href="https://hpanel.hostinger.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
                <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                  <span className="text-lg">🖥️</span> Hostinger (VPS)
                </span>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
              <a href="https://app.lhfex.com.br" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
                <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                  <span className="text-lg">⚙️</span> Coolify (Deploy)
                </span>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
            </div>
          </div>

          {/* AI Agents */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{i18n.dashboard.aiAgents}</h2>
            </div>
            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.name} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {i18n.agents.online}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
