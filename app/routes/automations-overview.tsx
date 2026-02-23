/**
 * GET /automations/overview
 * Visão Geral de Automações — lista unificada de tudo que está ativo
 *
 * Consolida:
 * - Cron jobs hardcoded (cron.server.ts) — metadata estática
 * - Automações dinâmicas do banco (automations table, enabled = true)
 * - Status de cada cron job via /api/automations-cron-health
 */

import { Link } from "react-router";
import type { Route } from "./+types/automations-overview";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  Zap,
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Bot,
  Newspaper,
  Bell,
  DollarSign,
  Receipt,
  Ship,
  Building2,
  Server,
  BarChart3,
  Layers,
  Radio,
} from "lucide-react";

// ── Catálogo estático de cron jobs ────────────────────────────────────────

type CronEntry = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  output: string;
  category: "pessoal" | "lhfex" | "infra";
  icon: React.ReactNode;
};

const CRON_CATALOG: CronEntry[] = [
  // ── Pessoal ──────────────────────────────────────────────────────
  {
    id: "news_daily_digest",
    name: "Resumo de Notícias",
    description:
      "Busca notícias do dia por tema (tecnologia, IA, mercado financeiro) via GNews API, resume com IA e envia às 7h.",
    schedule: "Diário às 7h",
    output: "@lhfex_noticias_bot",
    category: "pessoal",
    icon: <Newspaper className="h-5 w-5" />,
  },
  {
    id: "bills_alert",
    name: "Alertas de Vencimentos",
    description:
      "Verifica contas a vencer e envia lista priorizada com urgência (hoje, amanhã, em X dias). Só dispara se houver vencimentos próximos.",
    schedule: "Diário às 8h",
    output: "@lhfex_monitor_bot",
    category: "pessoal",
    icon: <Bell className="h-5 w-5" />,
  },
  {
    id: "personal_finance_weekly",
    name: "Resumo Financeiro Pessoal",
    description:
      "Consolida receitas, despesas e saldo da semana anterior, agrupados por categoria. Só envia se houver transações no período.",
    schedule: "Segunda-feira às 8h",
    output: "@lhfex_openclaw_bot",
    category: "pessoal",
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    id: "radio_monitor",
    name: "Monitor de Rádio",
    description:
      "Captura segmentos de streams de rádio, transcreve com Groq Whisper e detecta palavras-chave de promoções e sorteios.",
    schedule: "A cada 2 horas",
    output: "@lhfex_openclaw_bot",
    category: "pessoal",
    icon: <Radio className="h-5 w-5" />,
  },
  // ── LHFEX ────────────────────────────────────────────────────────
  {
    id: "invoice_due_soon",
    name: "Alertas de Cobranças",
    description:
      "Verifica faturas vencendo nos próximos 3 dias e dispara automações configuradas (notificação interna, email ou webhook).",
    schedule: "9h, 12h, 15h e 18h",
    output: "Automações / Email",
    category: "lhfex",
    icon: <Receipt className="h-5 w-5" />,
  },
  {
    id: "process_eta_approaching",
    name: "Alertas de ETA de Processos",
    description:
      "Monitora processos logísticos com ETA nas próximas 48h e dispara automações de notificação ou webhook configuradas.",
    schedule: "A cada 6 horas",
    output: "Automações / Webhook",
    category: "lhfex",
    icon: <Ship className="h-5 w-5" />,
  },
  {
    id: "cnpj_enrichment",
    name: "Enriquecimento de CNPJ",
    description:
      "Busca dados de CNPJ/CNAE de clientes cadastrados nos últimos 7 dias que ainda não têm informações e preenche automaticamente.",
    schedule: "Domingo às 2h",
    output: "Banco de dados",
    category: "lhfex",
    icon: <Building2 className="h-5 w-5" />,
  },
  // ── Infra ─────────────────────────────────────────────────────────
  {
    id: "vps_monitor",
    name: "Monitor de VPS",
    description:
      "Mede uso de RAM, CPU e Disco do servidor a cada hora. Envia alerta apenas se algum recurso ultrapassar 80% de utilização.",
    schedule: "A cada 1 hora",
    output: "@lhfex_monitor_bot",
    category: "infra",
    icon: <Server className="h-5 w-5" />,
  },
  {
    id: "vps_weekly_report",
    name: "Relatório Semanal da VPS",
    description:
      "Envia relatório completo com barras de progresso ASCII (RAM, CPU, Disco, Uptime) todo domingo às 9h. Sempre envia, independente do status.",
    schedule: "Domingo às 9h",
    output: "@lhfex_monitor_bot",
    category: "infra",
    icon: <BarChart3 className="h-5 w-5" />,
  },
];

const CATEGORY_CONFIG = {
  pessoal: {
    label: "👤 Pessoal",
    color: "border-purple-200 bg-purple-50 dark:border-purple-900/30 dark:bg-purple-900/10",
    headerColor: "text-purple-700 dark:text-purple-400",
    badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  },
  lhfex: {
    label: "🏢 LHFEX",
    color: "border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10",
    headerColor: "text-blue-700 dark:text-blue-400",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  },
  infra: {
    label: "🖥️ Infraestrutura",
    color: "border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10",
    headerColor: "text-green-700 dark:text-green-400",
    badgeColor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    iconBg: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
  },
} as const;

// ── Types ──────────────────────────────────────────────────────────────────

type CronHealth = {
  name: string;
  status: "active" | "idle";
  lastRunMinutesAgo: number | null;
  lastExecutedAt: string | null;
};

// ── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  // Automações dinâmicas do banco (habilitadas)
  const dbAutomations = await db
    .select()
    .from(automations)
    .where(eq(automations.enabled, true));

  // Health dos cron jobs via API interna
  let cronHealthMap: Record<string, CronHealth> = {};
  try {
    const url = new URL(request.url);
    const origin = url.origin;
    const cookieHeader = request.headers.get("cookie") ?? "";
    const res = await fetch(`${origin}/api/automations-cron-health`, {
      headers: { cookie: cookieHeader },
    });
    if (res.ok) {
      const healthData = await res.json() as { jobs: CronHealth[] };
      for (const job of healthData.jobs ?? []) {
        cronHealthMap[job.name] = job;
      }
    }
  } catch {
    // Health API indisponível — continua sem status
  }

  return {
    dbAutomations,
    cronHealthMap,
  };
}

// ── Helper ─────────────────────────────────────────────────────────────────

function formatLastRun(minutesAgo: number | null): string {
  if (minutesAgo === null) return "Nunca executado";
  if (minutesAgo < 2) return "Agora mesmo";
  if (minutesAgo < 60) return `${minutesAgo} min atrás`;
  const h = Math.floor(minutesAgo / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

const TRIGGER_LABELS: Record<string, string> = {
  process_status_change: "Processo mudou de status",
  invoice_due_soon: "Fatura próxima do vencimento",
  new_client: "Novo cliente cadastrado",
  eta_approaching: "ETA se aproximando",
  scheduled: "Agendado (horário fixo)",
};

const ACTION_LABELS: Record<string, string> = {
  send_email: "Enviar e-mail",
  create_notification: "Notificação interna",
  call_agent: "Chamar agente IA",
  webhook: "Webhook externo",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function AutomationsOverviewPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { dbAutomations, cronHealthMap } = loaderData;

  const totalActive = CRON_CATALOG.length + dbAutomations.length;

  // Agrupar cron catalog por categoria
  const byCategory = {
    pessoal: CRON_CATALOG.filter((j) => j.category === "pessoal"),
    lhfex: CRON_CATALOG.filter((j) => j.category === "lhfex"),
    infra: CRON_CATALOG.filter((j) => j.category === "infra"),
  } as const;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/automations"
              className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              🤖 Visão Geral de Automações
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {totalActive} automações
            </span>{" "}
            trabalhando por você agora
          </p>
        </div>
        <Link
          to="/automations"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ← Gerenciar Automações
        </Link>
      </div>

      {/* Seções por categoria */}
      {(["pessoal", "lhfex", "infra"] as const).map((category) => {
        const cfg = CATEGORY_CONFIG[category];
        const entries = byCategory[category];
        return (
          <section key={category}>
            <h2 className={`mb-3 text-sm font-bold uppercase tracking-wider ${cfg.headerColor}`}>
              {cfg.label} — {entries.length} cron job{entries.length !== 1 ? "s" : ""}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((job) => {
                const health = cronHealthMap[job.id];
                const isActive = health?.status === "active";
                const hasHealth = !!health;
                return (
                  <div
                    key={job.id}
                    className={`rounded-xl border p-4 ${cfg.color}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${cfg.iconBg}`}>
                        {job.icon}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-white text-sm">
                            {job.name}
                          </span>
                          {/* Status dot */}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                              hasHealth
                                ? isActive
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                hasHealth
                                  ? isActive
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                                  : "bg-blue-500"
                              }`}
                            />
                            {hasHealth ? (isActive ? "Ativo" : "Aguardando") : "Ativo"}
                          </span>
                        </div>

                        <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {job.description}
                        </p>

                        {/* Badges */}
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-900/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                            <Clock className="h-3 w-3" />
                            {job.schedule}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${cfg.badgeColor}`}>
                            → {job.output}
                          </span>
                        </div>

                        {/* Last run */}
                        {health && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                            Última execução: {formatLastRun(health.lastRunMinutesAgo)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Seção: Automações Dinâmicas (banco) */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
          ⚙️ Automações Dinâmicas — {dbAutomations.length} configurada{dbAutomations.length !== 1 ? "s" : ""}
        </h2>

        {dbAutomations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <Layers className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhuma automação dinâmica configurada ainda.
            </p>
            <Link
              to="/automations"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <Zap className="h-4 w-4" />
              Criar automação
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dbAutomations.map((auto) => (
              <div
                key={auto.id}
                className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/30 dark:bg-orange-900/10"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0 rounded-lg bg-orange-100 p-2 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                        {auto.name}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Ativa
                      </span>
                    </div>

                    {auto.description && (
                      <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {auto.description}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-900/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                        SE: {TRIGGER_LABELS[auto.triggerType] ?? auto.triggerType}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        ENTÃO: {ACTION_LABELS[auto.actionType] ?? auto.actionType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Link para health detalhado */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Saúde detalhada dos cron jobs
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Status em tempo real, última execução e diagnósticos
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/automations/health"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Ver Health Check
            </Link>
            <Link
              to="/automations/dashboard"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Ver Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
