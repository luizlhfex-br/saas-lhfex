/**
 * GET /personal-life
 * Dashboard principal de Vida Pessoal
 */

import { useNavigate } from "react-router";
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  DollarSign,
  Gift,
  GraduationCap,
  Heart,
  ListTodo,
  Receipt,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { requireAuth } from "~/lib/auth.server";
import { requireRole, ROLES } from "~/lib/rbac.server";

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  await requireRole(user, [ROLES.LUIZ]);

  return { user };
}

type ModuleGroupKey = "promotions" | "finances" | "planning" | "wellness";

type ModuleCard = {
  group: ModuleGroupKey;
  slug: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const modules: ModuleCard[] = [
  {
    group: "finances",
    slug: "finances",
    title: "Financas Pessoais",
    description: "Modulo completo de financas pessoais: contas, lancamentos, orcamentos e recorrencias",
    icon: DollarSign,
    color: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  },
  {
    group: "finances",
    slug: "investments",
    title: "Investimentos",
    description: "Portfolio de acoes, cripto, bonds e outros ativos",
    icon: TrendingUp,
    color: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
  },
  {
    group: "wellness",
    slug: "health",
    title: "Saude",
    description: "Acompanhe peso, medidas corporais e evolucao fisica",
    icon: Heart,
    color: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  },
  {
    group: "planning",
    slug: "goals",
    title: "Objetivos Pessoais",
    description: "Tarefas de curto e longo prazo com progresso medido",
    icon: Target,
    color: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  },
  {
    group: "promotions",
    slug: "promotions",
    title: "Promocoes e Sorteios",
    description: "Rastreie promocoes, concursos e sorteios pessoais",
    icon: Gift,
    color: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  },
  {
    group: "finances",
    slug: "bills",
    title: "Vencimentos",
    description: "Assinaturas, boletos e pagamentos recorrentes com alertas via Telegram",
    icon: Receipt,
    color: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400",
  },
  {
    group: "planning",
    slug: "tasks",
    title: "TO-DO",
    description: "Tarefas pessoais com prioridades e resumo diario via Telegram",
    icon: ListTodo,
    color: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  },
  {
    group: "planning",
    slug: "wishlist",
    title: "Wishlist",
    description: "Livros, filmes, series e discos para ver ou ouvir um dia",
    icon: Bookmark,
    color: "bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400",
  },
  {
    group: "planning",
    slug: "studies",
    title: "Estudos",
    description: "Faculdades, materias, provas e prazos com integracao ao Google Calendar",
    icon: GraduationCap,
    color: "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400",
  },
  {
    group: "wellness",
    slug: "clean-days",
    title: "Dia Limpo",
    description: "Rastreador de streak pessoal privado",
    icon: CheckCircle2,
    color: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  },
  {
    group: "wellness",
    slug: "productivity",
    title: "Produtividade",
    description: "Pomodoro, 3-3-3, Eisenhower e Seinfeld",
    icon: Timer,
    color: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
  },
];

const moduleGroups: { key: ModuleGroupKey; title: string; description: string }[] = [
  {
    key: "promotions",
    title: "Promocoes e Sorteios",
    description: "Acompanhe oportunidades e sorteios pessoais",
  },
  {
    key: "finances",
    title: "Financas e Patrimonio",
    description: "Financas pessoais, investimentos e vencimentos",
  },
  {
    key: "planning",
    title: "Planejamento e Evolucao",
    description: "Estudos, objetivos, tarefas e wishlist",
  },
  {
    key: "wellness",
    title: "Saude e Consistencia",
    description: "Saude, dia limpo e produtividade pessoal",
  },
];

export default function PersonalLifePage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vida Pessoal</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Organize sua vida em modulos claros de promocoes, financas, planejamento e saude pessoal.
        </p>
      </div>

      <div className="space-y-6">
        {moduleGroups.map((group) => {
          const groupModules = modules.filter((module) => module.group === group.key);
          if (groupModules.length === 0) return null;

          return (
            <section key={group.key}>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{group.title}</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{group.description}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupModules.map((module) => {
                  const Icon = module.icon;

                  return (
                    <button
                      key={module.slug}
                      type="button"
                      onClick={() => navigate(`/personal-life/${module.slug}`)}
                      className="group rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                    >
                      <div className={`mb-3 inline-block rounded-lg p-3 ${module.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{module.title}</h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{module.description}</p>
                      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-200">
                        Acessar
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
