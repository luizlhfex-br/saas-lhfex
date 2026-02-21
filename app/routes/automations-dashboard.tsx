import { useMemo } from "react";
import type { Route } from "./+types/automations-dashboard";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automationLogs, automations } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Calendar, CheckCircle, AlertCircle } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const logsLast30 = await db
    .select()
    .from(automationLogs)
    .orderBy(desc(automationLogs.executedAt))
    .limit(5000);

  const byDay: Record<string, { success: number; error: number; skipped: number; total: number }> = {};
  logsLast30.forEach((log) => {
    const date = new Date(log.executedAt).toISOString().split("T")[0];
    if (!byDay[date]) {
      byDay[date] = { success: 0, error: 0, skipped: 0, total: 0 };
    }
    byDay[date].total++;
    if (log.status === "success") byDay[date].success++;
    else if (log.status === "error") byDay[date].error++;
    else byDay[date].skipped++;
  });

  const trendData = Object.entries(byDay).map(([date, counts]) => ({
    date,
    success: counts.success,
    error: counts.error,
    skipped: counts.skipped,
  }));

  const statusDist = {
    success: logsLast30.filter((l) => l.status === "success").length,
    error: logsLast30.filter((l) => l.status === "error").length,
    skipped: logsLast30.filter((l) => l.status === "skipped").length,
  };

  const byAutomation: Record<string, { count: number; errors: number }> = {};
  logsLast30.forEach((log) => {
    if (!byAutomation[log.automationId]) {
      byAutomation[log.automationId] = { count: 0, errors: 0 };
    }
    byAutomation[log.automationId].count++;
    if (log.status === "error") byAutomation[log.automationId].errors++;
  });

  const automationNames = await db
    .select({ id: automations.id, name: automations.name })
    .from(automations);

  const nameMap = new Map(automationNames.map((a) => [a.id, a.name]));

  const topAutomations = Object.entries(byAutomation)
    .map(([id, stats]) => ({
      name: nameMap.get(id) || "Unknown",
      executions: stats.count,
      errors: stats.errors,
      errorRate: stats.count > 0 ? ((stats.errors / stats.count) * 100).toFixed(1) : "0",
    }))
    .sort((a, b) => b.executions - a.executions)
    .slice(0, 10);

  return {
    trendData,
    statusDist,
    topAutomations,
    totalExecutions: logsLast30.length,
  };
}

export default function AutomationsDashboardPage({ loaderData }: Route.ComponentProps) {
  const { trendData, statusDist, topAutomations, totalExecutions } = loaderData;

  const statusChartData = useMemo(
    () => [
      { name: "Sucesso", value: statusDist.success },
      { name: "Erro", value: statusDist.error },
      { name: "Ignorado", value: statusDist.skipped },
    ],
    [statusDist],
  );

  const COLORS = ["#10b981", "#ef4444", "#f59e0b"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard de Automações</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">Última execução</p>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{totalExecutions}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300">nos últimos 30 dias</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm text-green-700 dark:text-green-300">Taxa de sucesso</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {totalExecutions > 0 ? ((statusDist.success / totalExecutions) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm text-red-700 dark:text-red-300">Falhas</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{statusDist.error}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Trend (Últimos 30 dias)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="success" stroke="#10b981" />
              <Line type="monotone" dataKey="error" stroke="#ef4444" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Distribuição de Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Top 10 Automações</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Automação</th>
                <th className="px-6 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Execuções</th>
                <th className="px-6 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Erros</th>
                <th className="px-6 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Taxa de erro</th>
              </tr>
            </thead>
            <tbody>
              {topAutomations.map((auto: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/30">
                  <td className="px-6 py-3 text-gray-900 dark:text-gray-100">{auto.name}</td>
                  <td className="px-6 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{auto.executions}</td>
                  <td className="px-6 py-3 text-right font-medium text-red-600 dark:text-red-400">{auto.errors}</td>
                  <td className="px-6 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{auto.errorRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
