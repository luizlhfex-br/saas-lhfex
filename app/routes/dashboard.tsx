import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients, invoices, notifications, processes } from "../../drizzle/schema";
import { and, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Clock3,
  DollarSign,
  ExternalLink,
  FileText,
  Radar,
  Server,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

let cachedRate: { rate: number; rateDate: string; source: string; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchExchangeRate(request: Request): Promise<{ rate: number; rateDate: string; source: string }> {
  const now = Date.now();
  if (cachedRate && now - cachedRate.timestamp < CACHE_TTL) {
    return { rate: cachedRate.rate, rateDate: cachedRate.rateDate, source: cachedRate.source };
  }

  try {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/exchange-rate`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("API error");
    const payload = await response.json();
    const rate = Number(payload?.rate);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid rate");
    const rateDate = payload?.timestamp ? new Date(payload.timestamp).toLocaleDateString("pt-BR") : "";
    const source = String(payload?.source || "exchange_api");
    cachedRate = { rate, rateDate, source, timestamp: now };
    return { rate, rateDate, source };
  } catch {
    return {
      rate: cachedRate?.rate ?? 5.2006,
      rateDate: cachedRate?.rateDate ?? "",
      source: cachedRate?.source ?? "fallback",
    };
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;
  const companyId = await getPrimaryCompanyId(user.id);

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
    db.select({ count: sql<number>`count(*)::int` }).from(clients).where(and(isNull(clients.deletedAt), eq(clients.companyId, companyId))),
    db.select({ count: sql<number>`count(*)::int` }).from(processes).where(and(isNull(processes.deletedAt), eq(processes.companyId, companyId), notInArray(processes.status, ["completed", "cancelled"]))),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(and(eq(invoices.type, "receivable"), eq(invoices.status, "paid"), eq(invoices.companyId, companyId), sql`date_trunc('month', ${invoices.paidDate}::date) = date_trunc('month', current_date)`)),
    db.select({ id: processes.id, reference: processes.reference, status: processes.status, processType: processes.processType, eta: processes.eta }).from(processes).where(and(isNull(processes.deletedAt), eq(processes.companyId, companyId))).orderBy(desc(processes.createdAt)).limit(5),
    fetchExchangeRate(request),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(and(eq(invoices.type, "receivable"), eq(invoices.companyId, companyId), notInArray(invoices.status, ["paid", "cancelled"]), sql`${invoices.dueDate}::date <= current_date + interval '30 days'`)),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(and(eq(invoices.type, "receivable"), eq(invoices.companyId, companyId), notInArray(invoices.status, ["paid", "cancelled"]), sql`${invoices.dueDate}::date > current_date + interval '30 days' AND ${invoices.dueDate}::date <= current_date + interval '60 days'`)),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(and(eq(invoices.type, "receivable"), eq(invoices.companyId, companyId), notInArray(invoices.status, ["paid", "cancelled"]), sql`${invoices.dueDate}::date > current_date + interval '60 days' AND ${invoices.dueDate}::date <= current_date + interval '90 days'`)),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(and(eq(invoices.type, "payable"), eq(invoices.companyId, companyId), notInArray(invoices.status, ["paid", "cancelled"]), sql`${invoices.dueDate}::date <= current_date + interval '30 days'`)),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(and(eq(invoices.type, "payable"), eq(invoices.companyId, companyId), notInArray(invoices.status, ["paid", "cancelled"]), sql`${invoices.dueDate}::date > current_date + interval '30 days' AND ${invoices.dueDate}::date <= current_date + interval '60 days'`)),
    db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(and(eq(invoices.type, "payable"), eq(invoices.companyId, companyId), notInArray(invoices.status, ["paid", "cancelled"]), sql`${invoices.dueDate}::date > current_date + interval '60 days' AND ${invoices.dueDate}::date <= current_date + interval '90 days'`)),
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(5),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), eq(notifications.read, false))),
    db.select({ week: sql<string>`to_char(date_trunc('week', ${invoices.dueDate}::date), 'DD/MM')`, receivable: sql<number>`coalesce(sum(case when ${invoices.type} = 'receivable' then ${invoices.total}::numeric else 0 end), 0)`, payable: sql<number>`coalesce(sum(case when ${invoices.type} = 'payable' then ${invoices.total}::numeric else 0 end), 0)` }).from(invoices).where(and(eq(invoices.companyId, companyId), notInArray(invoices.status, ["cancelled"]), sql`${invoices.dueDate}::date >= current_date - interval '30 days'`, sql`${invoices.dueDate}::date <= current_date + interval '30 days'`)).groupBy(sql`date_trunc('week', ${invoices.dueDate}::date)`).orderBy(sql`date_trunc('week', ${invoices.dueDate}::date)`),
  ]);

  return {
    user: { id: user.id, name: user.name, locale: user.locale },
    locale,
    stats: {
      dollarRate: dollarRate.rate,
      dollarRateDate: dollarRate.rateDate,
      dollarRateSource: dollarRate.source,
      activeProcesses: processCountResult[0]?.count ?? 0,
      activeClients: clientCountResult[0]?.count ?? 0,
      monthlyRevenue: Number(revenueResult[0]?.total ?? 0),
    },
    recentProcesses: recentProcs,
    financialChart: [
      { period: "0-30d", receber: Number(receivables30[0]?.total ?? 0), pagar: Number(payables30[0]?.total ?? 0) },
      { period: "30-60d", receber: Number(receivables60[0]?.total ?? 0), pagar: Number(payables60[0]?.total ?? 0) },
      { period: "60-90d", receber: Number(receivables90[0]?.total ?? 0), pagar: Number(payables90[0]?.total ?? 0) },
    ],
    cashflow: cashflowData.map((row) => ({
      week: row.week,
      entrada: Number(row.receivable),
      saida: Number(row.payable),
      saldo: Number(row.receivable) - Number(row.payable),
    })),
    recentNotifications: recentNotifs,
    unreadNotifCount: unreadNotifCount[0]?.count ?? 0,
  };
}

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default",
  in_progress: "info",
  awaiting_docs: "warning",
  customs_clearance: "warning",
  in_transit: "info",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
};

const notificationIcons: Record<string, string> = {
  process_status: "PROC",
  invoice_due: "FIN",
  eta_approaching: "ETA",
  automation: "AUTO",
  system: "SYS",
};

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

function useChartFrame() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      const nextWidth = Math.round(element.getBoundingClientRect().width);
      const nextHeight = Math.round(element.getBoundingClientRect().height);
      setSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(element);
    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  return { ref, width: size.width, height: size.height };
}

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { user, locale, stats, recentProcesses, financialChart, cashflow, recentNotifications, unreadNotifCount } = loaderData;
  const [chartsReady, setChartsReady] = useState(false);
  const financialChartFrame = useChartFrame();
  const cashflowChartFrame = useChartFrame();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setChartsReady(true);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const i18n = t(locale);
  const statusLabels: Record<string, string> = {
    draft: i18n.processes.draft,
    in_progress: i18n.processes.inProgress,
    awaiting_docs: i18n.processes.awaitingDocs,
    customs_clearance: i18n.processes.customsClearance,
    in_transit: i18n.processes.inTransit,
    delivered: i18n.processes.delivered,
    completed: i18n.processes.completed,
    cancelled: i18n.processes.cancelled,
  };

  const receivablesTotal = financialChart.reduce((sum, row) => sum + row.receber, 0);
  const payablesTotal = financialChart.reduce((sum, row) => sum + row.pagar, 0);
  const projectedBalance = receivablesTotal - payablesTotal;
  const quickActions = [
    { label: "Abrir processo", to: "/processes/new" },
    { label: "Novo cliente", to: "/crm/new" },
    { label: "Calcular impostos", to: "/calculator" },
    { label: "Ver financeiro", to: "/financial" },
  ];
  const statCards = [
    { label: "Cambio referencia", value: `R$ ${stats.dollarRate.toFixed(4)}`, sub: stats.dollarRateDate ? `${String(stats.dollarRateSource || "ptax").toUpperCase()} | ${stats.dollarRateDate}` : String(stats.dollarRateSource || "ptax").toUpperCase(), icon: DollarSign, iconClass: "border-emerald-300/20 bg-emerald-400/15 text-emerald-100" },
    { label: "Processos ativos", value: String(stats.activeProcesses), sub: "Fluxos em execucao agora", icon: FileText, iconClass: "border-sky-300/20 bg-sky-400/15 text-sky-100" },
    { label: "Clientes ativos", value: String(stats.activeClients), sub: "Base comercial monitorada", icon: Users, iconClass: "border-fuchsia-300/20 bg-fuchsia-400/15 text-fuchsia-100" },
    { label: "Receita do mes", value: formatBrl(stats.monthlyRevenue), sub: "Titulos pagos no periodo", icon: TrendingUp, iconClass: "border-amber-300/20 bg-amber-400/15 text-amber-100" },
  ];
  const serverLinks = [
    { label: "Coolify Dashboard", href: "https://app.lhfex.com.br" },
    { label: "Hostinger VPS", href: "https://hpanel.hostinger.com" },
    { label: "Deploys", href: "https://app.lhfex.com.br" },
  ];
  const agentCards = [
    { name: i18n.agents.airton, role: "Execucao operacional", className: "border-cyan-300/18 bg-cyan-400/12 text-cyan-100" },
    { name: i18n.agents.iana, role: "Comex e classificacao", className: "border-emerald-300/18 bg-emerald-400/12 text-emerald-100" },
    { name: i18n.agents.maria, role: "Financeiro e caixa", className: "border-amber-300/18 bg-amber-400/12 text-amber-100" },
    { name: i18n.agents.iago, role: "Infra e confiabilidade", className: "border-violet-300/18 bg-violet-400/12 text-violet-100" },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="relative overflow-hidden rounded-[30px] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,#081222_0%,#142235_55%,#241638_100%)] px-6 py-6 text-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.16)] lg:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.15),transparent_28%)]" />
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100">LHFEX control room</span>
              <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs text-slate-200">
                {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}
              </span>
            </div>
            <div className="mt-5 grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
              <div>
                <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                  Operacao central da LHFEX, com foco em processo, caixa e ritmo comercial.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  {i18n.dashboard.greeting(user.name)}. Este painel concentra os sinais mais relevantes do dia para decidir rapido o proximo movimento.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Cambio base</p>
                    <p className="mt-2 text-2xl font-semibold text-white">R$ {stats.dollarRate.toFixed(4)}</p>
                    <p className="mt-1 text-xs text-slate-400">{String(stats.dollarRateSource || "ptax").toUpperCase()}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Operacoes</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{stats.activeProcesses}</p>
                    <p className="mt-1 text-xs text-slate-400">Processos ativos agora</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Alertas</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{unreadNotifCount}</p>
                    <p className="mt-1 text-xs text-slate-400">Pendencias nao lidas</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  {quickActions.map((action) => (
                    <Link key={action.to} to={action.to} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10">
                      {action.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ))}
                </div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-slate-950/28 p-5 backdrop-blur">
                <div className="flex items-center gap-2">
                  <Radar className="h-5 w-5 text-cyan-200" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">Radar operacional</h3>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-emerald-400/16 bg-emerald-400/8 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">A receber 90d</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatBrl(receivablesTotal)}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-400/16 bg-rose-400/8 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-rose-100/70">A pagar 90d</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatBrl(payablesTotal)}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-400/16 bg-amber-400/8 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">Saldo projetado</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatBrl(projectedBalance)}</p>
                  </div>
                  {recentProcesses[0] && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ultimo processo</p>
                      <p className="mt-2 text-lg font-semibold text-white">{recentProcesses[0].reference}</p>
                      <p className="mt-1 text-sm text-slate-300">{statusLabels[recentProcesses[0].status] || recentProcesses[0].status}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-[26px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-5 shadow-[var(--app-card-shadow)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">{card.label}</p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--app-text)]">{card.value}</p>
                    <p className="mt-1 text-sm text-[var(--app-muted)]">{card.sub}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${card.iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-6 shadow-[var(--app-card-shadow)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/18 bg-emerald-400/10 text-emerald-600 dark:text-emerald-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--app-text)]">Receber vs pagar</h3>
              <p className="text-sm text-[var(--app-muted)]">Janela de 90 dias para pressao de caixa.</p>
            </div>
          </div>
          <div ref={financialChartFrame.ref} className="h-72 min-w-0">
            {chartsReady && financialChartFrame.width > 0 && financialChartFrame.height > 0 ? (
              <BarChart width={financialChartFrame.width} height={Math.max(financialChartFrame.height, 240)} data={financialChart} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip formatter={(value) => formatBrl(Number(value ?? 0))} labelStyle={{ color: "#0f172a" }} contentStyle={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.2)", boxShadow: "0 16px 40px rgba(15,23,42,0.12)" }} />
                <Legend />
                <Bar dataKey="receber" name="A receber" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="pagar" name="A pagar" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--app-border-strong)] text-sm text-[var(--app-muted)]">
                Carregando grafico financeiro...
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-6 shadow-[var(--app-card-shadow)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/18 bg-cyan-400/10 text-cyan-600 dark:text-cyan-300">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--app-text)]">Fluxo de caixa</h3>
              <p className="text-sm text-[var(--app-muted)]">Entradas, saidas e saldo em sequencia semanal.</p>
            </div>
          </div>
          <div ref={cashflowChartFrame.ref} className="h-72 min-w-0">
            {chartsReady && cashflow.length > 0 && cashflowChartFrame.width > 0 && cashflowChartFrame.height > 0 ? (
              <LineChart width={cashflowChartFrame.width} height={Math.max(cashflowChartFrame.height, 240)} data={cashflow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip formatter={(value) => formatBrl(Number(value ?? 0))} contentStyle={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.2)", boxShadow: "0 16px 40px rgba(15,23,42,0.12)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="entrada" name="Entradas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="saida" name="Saidas" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="5 5" />
                </LineChart>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--app-border-strong)] text-sm text-[var(--app-muted)]">
                {chartsReady ? "Sem dados financeiros para o periodo." : "Carregando fluxo de caixa..."}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[1.65fr_1fr]">
        <div className="rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-6 shadow-[var(--app-card-shadow)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-400/18 bg-slate-400/8 text-slate-600 dark:text-slate-200">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--app-text)]">{i18n.dashboard.recentProcesses}</h3>
                <p className="text-sm text-[var(--app-muted)]">Lista curta para retomar contexto rapido.</p>
              </div>
            </div>
            <Link to="/processes" className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-2)]">
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {recentProcesses.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-6 text-center">
              <FileText className="mb-4 h-12 w-12 text-[var(--app-muted)]" />
              <p className="text-sm text-[var(--app-muted)]">{i18n.dashboard.noProcesses}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProcesses.map((process, index) => (
                <Link key={process.id} to={`/processes/${process.id}`} className="group flex flex-col gap-4 rounded-[24px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--app-border-strong)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/16 bg-cyan-400/10 text-cyan-600 dark:text-cyan-300">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-[var(--app-text)]">{process.reference}</p>
                        {index === 0 && (
                          <span className="rounded-full border border-cyan-400/18 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-200">
                            Mais recente
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--app-muted)]">
                        {process.processType || "Processo"} {process.eta ? `| ETA ${new Date(process.eta).toLocaleDateString("pt-BR")}` : "| ETA nao informado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusColors[process.status]}>{statusLabels[process.status] || process.status}</Badge>
                    <ArrowRight className="h-4 w-4 text-[var(--app-muted)] transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-2))] p-6 shadow-[var(--app-card-shadow)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/18 bg-rose-400/10 text-rose-600 dark:text-rose-300">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--app-text)]">Alertas</h3>
                  <p className="text-sm text-[var(--app-muted)]">Eventos recentes e pendencias.</p>
                </div>
              </div>
              {unreadNotifCount > 0 && (
                <span className="rounded-full border border-rose-400/18 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-200">
                  {unreadNotifCount} nao lidos
                </span>
              )}
            </div>

            {recentNotifications.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-6 text-center">
                <Bell className="mb-4 h-10 w-10 text-[var(--app-muted)]" />
                <p className="text-sm text-[var(--app-muted)]">{i18n.dashboard.noAlerts}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentNotifications.map((notification) => (
                  <div key={notification.id} className="rounded-[22px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {notificationIcons[notification.type] || "SYS"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--app-text)]">{notification.title}</p>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">{notification.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link to="/notifications" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-700 transition-colors hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">
              Ver centro de notificacoes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] p-6 text-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-100">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Infraestrutura</h3>
                <p className="text-sm text-slate-400">Links diretos para operacao do host e deploy.</p>
              </div>
            </div>
            <div className="space-y-2">
              {serverLinks.map((item) => (
                <a key={item.href + item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.08]">
                  <span>{item.label}</span>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,#10172a_0%,#1f1530_100%)] p-6 text-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-100">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{i18n.dashboard.aiAgents}</h3>
                <p className="text-sm text-slate-400">Especialistas mais usados no fluxo diario.</p>
              </div>
            </div>
            <div className="space-y-3">
              {agentCards.map((agent) => (
                <div key={agent.name} className={`rounded-2xl border px-4 py-3 ${agent.className}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{agent.name}</p>
                      <p className="mt-1 text-xs opacity-80">{agent.role}</p>
                    </div>
                    <span className="rounded-full bg-emerald-400/14 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                      Online
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
