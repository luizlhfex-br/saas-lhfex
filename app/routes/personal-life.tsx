/**
 * GET /personal-life
 * Dashboard principal de Vida Pessoal
 */

import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";
import { useFetcher, useNavigate } from "react-router";
import {
  TrendingUp,
  Heart,
  Trophy,
  Gift,
  Calendar,
  Target,
  ArrowRight,
  DollarSign,
  Zap,
} from "lucide-react";
import { Button } from "~/components/ui/button";

type SummaryCard = {
  title: string;
  value: string;
  change: string;
  icon: string;
};

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  // Fetch summary data
  return {
    user,
    summaryCards: [
      { title: "Saldo Mês", value: "R$ 2.340,50", change: "+12%", icon: "dollar" },
      { title: "Portfólio", value: "R$ 45.200", change: "+8.5%", icon: "trending" },
      { title: "Rotinas Ativas", value: "8", change: "100% este mês", icon: "heart" },
      { title: "Promoções Pendentes", value: "5", change: "Próximo sorteio em 3 dias", icon: "gift" },
    ],
  };
}

const modules = [
  {
    slug: "finances",
    title: "💰 Finanças Pessoais",
    description: "Receitas, despesas e controle de cashflow pessoal",
    icon: DollarSign,
    color: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  },
  {
    slug: "investments",
    title: "📈 Investimentos",
    description: "Portfolio de ações, cripto, bonds e outros ativos",
    icon: TrendingUp,
    color: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
  },
  {
    slug: "routines",
    title: "❤️ Rotinas & Hábitos",
    description: "Rastreador de exercício, meditação, leitura e mais",
    icon: Heart,
    color: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  },
  {
    slug: "goals",
    title: "🎯 Objetivos Pessoais",
    description: "Tarefas de curto/longo prazos com progresso medido",
    icon: Target,
    color: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  },
  {
    slug: "promotions",
    title: "🎁 Promoções & Sorteios",
    description: "Hobby de rastrear promoções, concursos e giveaways",
    icon: Gift,
    color: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  },
  {
    slug: "timeoff",
    title: "🏖️ Férias & Descanso",
    description: "Planejador de viagens, férias e momentos de recesso",
    icon: Calendar,
    color: "bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400",
  },
];

export default function PersonalLifePage({
  loaderData,
}: {
  loaderData: { summaryCards: SummaryCard[] };
}) {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { summaryCards } = loaderData;
  const fetcherData = (fetcher.data || {}) as {
    result?: string;
    error?: string;
    code?: string;
    provider?: string;
    model?: string;
  };
  const isRunning = fetcher.state !== "idle";
  const quickTasks = [
    "Planejar minha semana com prioridades e blocos de foco.",
    "Analisar meus gastos pessoais e sugerir 3 economias práticas.",
    "Montar rotina de treino semanal para constância e progressão.",
  ];
  const lifeErrorMessage = (() => {
    if (!fetcherData.error) {
      return "";
    }

    if (fetcherData.code === "FORBIDDEN_MODULE") {
      return "Seu usuário não tem permissão para usar este módulo.";
    }

    if (fetcherData.code === "RATE_LIMITED") {
      return "Muitas solicitações em sequência. Aguarde alguns segundos e tente de novo.";
    }

    if (fetcherData.code === "INVALID_INPUT") {
      return "A tarefa enviada está inválida. Escreva uma solicitação mais clara e tente novamente.";
    }

    return fetcherData.error;
  })();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Vida Pessoal
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Organize sua vida: finanças, investimentos, rotinas, objetivos e hobbies 🎯
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card: SummaryCard, idx: number) => (
          <div
            key={idx}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-xs font-medium uppercase text-gray-600 dark:text-gray-400">
              {card.title}
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              {card.change}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Automação Pessoal
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Descreva uma tarefa prática para o Life Agent executar.
        </p>

        <fetcher.Form method="post" action="/api/life-run" className="mt-4 space-y-3">
          <textarea
            name="task"
            rows={4}
            required
            minLength={5}
            maxLength={3000}
            placeholder="Ex.: Planejar meu orçamento pessoal de março com teto por categoria"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-indigo-500 placeholder:text-gray-400 focus:ring-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <div className="flex flex-wrap gap-2">
            {quickTasks.map((task) => (
              <button
                key={task}
                type="submit"
                name="task"
                value={task}
                disabled={isRunning}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {task}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={isRunning}>
            {isRunning ? "Executando..." : "Executar tarefa"}
          </Button>
        </fetcher.Form>

        {lifeErrorMessage && (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            {lifeErrorMessage}
          </p>
        )}

        {fetcherData.result && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Provider: {fetcherData.provider}</span>
              <span>•</span>
              <span>Model: {fetcherData.model}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
              {fetcherData.result}
            </p>
          </div>
        )}
      </div>

      {/* Modules Grid */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
          Escolha um módulo
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.slug}
                onClick={() => navigate(`/personal-life/${module.slug}`)}
                className="group rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
              >
                <div className={`mb-3 inline-block rounded-lg p-3 ${module.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {module.title}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {module.description}
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-200">
                  Acessar
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-900/20">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-500 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
              Agente arIA ativado 🤖
            </h3>
            <p className="mt-1 text-sm text-yellow-800 dark:text-yellow-300">
              Este módulo é gerenciado pelo agente inteligente arIA, que fornece sugestões,
              lembretes de prazos e análises automáticas de seus dados pessoais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
