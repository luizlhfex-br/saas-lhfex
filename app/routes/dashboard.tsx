import type { Route } from "./+types/dashboard";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { clients } from "../../drizzle/schema";
import { isNull, eq, sql } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { DollarSign, FileText, Users, TrendingUp, Bot, Bell, Clock } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  // Count active clients
  const [clientCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(isNull(clients.deletedAt));

  // Read locale from cookie or user preference
  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  return {
    user: { id: user.id, name: user.name, locale: user.locale },
    locale,
    stats: {
      dollarRate: 5.12,
      activeProcesses: 0,
      activeClients: clientCount?.count ?? 0,
      monthlyRevenue: 0,
    },
  };
}

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { user, locale, stats } = loaderData;
  const i18n = t(locale);

  const statCards = [
    {
      label: i18n.dashboard.dollarRate,
      value: `R$ ${stats.dollarRate.toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20",
    },
    {
      label: i18n.dashboard.activeProcesses,
      value: stats.activeProcesses.toString(),
      icon: FileText,
      color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20",
    },
    {
      label: i18n.dashboard.activeClients,
      value: stats.activeClients.toString(),
      icon: Users,
      color: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20",
    },
    {
      label: i18n.dashboard.monthlyRevenue,
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(stats.monthlyRevenue),
      icon: TrendingUp,
      color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20",
    },
  ];

  const agents = [
    { name: i18n.agents.airton, status: "online" as const },
    { name: i18n.agents.iana, status: "online" as const },
    { name: i18n.agents.maria, status: "offline" as const },
    { name: i18n.agents.iago, status: "offline" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {i18n.dashboard.greeting(user.name)}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {new Intl.DateTimeFormat(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date())}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {card.value}
                  </p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Processes */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {i18n.dashboard.recentProcesses}
            </h2>
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {i18n.dashboard.noProcesses}
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Alerts */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {i18n.dashboard.alerts}
              </h2>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-700" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {i18n.dashboard.noAlerts}
              </p>
            </div>
          </div>

          {/* AI Agents */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {i18n.dashboard.aiAgents}
              </h2>
            </div>
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-800"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {agent.name}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      agent.status === "online"
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        agent.status === "online" ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    {agent.status === "online" ? i18n.agents.online : i18n.agents.offline}
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
