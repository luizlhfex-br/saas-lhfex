import type { Route } from "./+types/ai-usage";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { aiUsageLogs } from "../../drizzle/schema";
import { t, type Locale } from "~/i18n";
import { Badge } from "~/components/ui/badge";
import { BarChart3, TrendingUp, Zap, AlertCircle } from "lucide-react";
import { desc, sql, gte } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  // Últimos 30 dias
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Últimas 50 chamadas
  const recentCalls = await db
    .select({
      id: aiUsageLogs.id,
      provider: aiUsageLogs.provider,
      model: aiUsageLogs.model,
      feature: aiUsageLogs.feature,
      tokensIn: aiUsageLogs.tokensIn,
      tokensOut: aiUsageLogs.tokensOut,
      costEstimate: aiUsageLogs.costEstimate,
      success: aiUsageLogs.success,
      createdAt: aiUsageLogs.createdAt,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, thirtyDaysAgo))
    .orderBy(desc(aiUsageLogs.createdAt))
    .limit(50);

  // Estatísticas por provider
  const stats = await db
    .select({
      provider: aiUsageLogs.provider,
      totalCalls: sql<number>`COUNT(*)`,
      totalTokensIn: sql<number>`SUM(${aiUsageLogs.tokensIn})`,
      totalTokensOut: sql<number>`SUM(${aiUsageLogs.tokensOut})`,
      totalCost: sql<string>`SUM(${aiUsageLogs.costEstimate})`,
      successRate: sql<number>`ROUND(SUM(CASE WHEN ${aiUsageLogs.success} THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 1)`,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, thirtyDaysAgo))
    .groupBy(aiUsageLogs.provider);

  // Total geral
  const total = await db
    .select({
      totalCalls: sql<number>`COUNT(*)`,
      totalTokensIn: sql<number>`SUM(${aiUsageLogs.tokensIn})`,
      totalTokensOut: sql<number>`SUM(${aiUsageLogs.tokensOut})`,
      totalCost: sql<string>`SUM(${aiUsageLogs.costEstimate})`,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, thirtyDaysAgo));

  // Estatísticas por feature
  const featureStats = await db
    .select({
      feature: aiUsageLogs.feature,
      totalCalls: sql<number>`COUNT(*)`,
      totalCost: sql<string>`SUM(${aiUsageLogs.costEstimate})`,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, thirtyDaysAgo))
    .groupBy(aiUsageLogs.feature);

  return {
    locale,
    recentCalls,
    stats,
    total: total[0] || { totalCalls: 0, totalTokensIn: 0, totalTokensOut: 0, totalCost: "0" },
    featureStats,
  };
}

export default function AIUsagePage({ loaderData }: Route.ComponentProps) {
  const { locale, recentCalls, stats, total, featureStats } = loaderData;
  const i18n = t(locale);

  const fmt = (v: number | string | null | undefined) => {
    const num = typeof v === "string" ? parseFloat(v) : v || 0;
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calcular porcentagens por provider
  const totalCalls = stats.reduce((sum, s) => sum + (s.totalCalls || 0), 0);
  const totalCost = parseFloat(total.totalCost || "0");

  const providerConfig: Record<string, { label: string; color: string; badge: string }> = {
    gemini: { label: "Gemini (Free)", color: "bg-blue-500", badge: "info" },
    openrouter_free: { label: "OpenRouter (Free)", color: "bg-green-500", badge: "success" },
    openrouter_paid: { label: "OpenRouter (Paid)", color: "bg-orange-500", badge: "warning" },
    deepseek: { label: "DeepSeek (Paid)", color: "bg-purple-500", badge: "danger" },
  };

  const featureConfig: Record<string, string> = {
    chat: "Chat",
    ncm_classification: "Classificação NCM",
    ocr: "OCR",
    enrichment: "Enriquecimento",
    telegram: "Telegram Bot",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard de IA</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Uso de tokens e custo estimado — últimos 30 dias</p>
      </div>

      {/* Estatísticas gerais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de Chamadas"
          value={totalCalls.toString()}
          icon={<ZapIcon className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          label="Tokens de Entrada"
          value={fmt(total.totalTokensIn)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          label="Tokens de Saída"
          value={fmt(total.totalTokensOut)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="orange"
        />
        <StatCard
          label="Custo Estimado (USD)"
          value={`$${fmt(totalCost)}`}
          icon={<BarChart3 className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Uso por Provider */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Proveedores */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Uso por Provider (Últimos 30 dias)
          </h2>
          <div className="space-y-3">
            {stats.map((stat) => {
              const cfg = providerConfig[stat.provider];
              const percentage = totalCalls > 0 ? ((stat.totalCalls || 0) / totalCalls) * 100 : 0;
              const cost = parseFloat(stat.totalCost || "0");

              return (
                <div key={stat.provider} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={cfg.badge as any}>{cfg.label}</Badge>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                        {stat.totalCalls} chamadas
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className={`h-full ${cfg.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{fmt(stat.totalTokensIn)} in + {fmt(stat.totalTokensOut)} out</span>
                    <span className="font-mono font-semibold">${fmt(cost)}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Taxa de sucesso: <span className="text-green-600 dark:text-green-400">{stat.successRate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Uso por Feature */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <Zap className="h-5 w-5 text-amber-600" />
            Uso por Funcionalidade
          </h2>
          <div className="space-y-3">
            {featureStats.map((stat) => {
              const percentage = totalCalls > 0 ? ((stat.totalCalls || 0) / totalCalls) * 100 : 0;
              const cost = parseFloat(stat.totalCost || "0");

              return (
                <div key={stat.feature} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {featureConfig[stat.feature] || stat.feature}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{stat.totalCalls} chamadas</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-violet-600"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400">
                    Custo: <span className="font-mono font-semibold">${fmt(cost)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Últimas chamadas */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <TrendingUp className="h-5 w-5 text-green-600" />
          Últimas Chamadas
        </h2>

        {recentCalls.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-8 dark:border-gray-800 dark:bg-gray-800/50">
            <AlertCircle className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Nenhuma chamada nos últimos 30 dias</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Provider</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Feature</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tokens In</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tokens Out</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Custo (USD)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((call) => {
                  const cfg = providerConfig[call.provider];
                  const cost = parseFloat(call.costEstimate || "0");

                  return (
                    <tr
                      key={call.id}
                      className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3">
                        <Badge variant={cfg.badge as any}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                        {featureConfig[call.feature] || call.feature}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                        {call.tokensIn}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                        {call.tokensOut}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-700 dark:text-gray-300">
                        ${fmt(cost)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={call.success ? "success" : "danger"}>
                          {call.success ? "✓ OK" : "✗ Erro"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(call.createdAt).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Nota:</strong> Custos são estimados baseado na quantidade de tokens. Valores exatos dependem das tabelas de preços dos provedores (Gemini Free, OpenRouter, DeepSeek).
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "orange" | "purple";
}) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium opacity-75">{label}</p>
        <div className="rounded-full p-2 opacity-75">{icon}</div>
      </div>
      <p className="text-2xl font-bold font-mono">{value}</p>
    </div>
  );
}

function ZapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
