import { Menu, Moon, Sun } from "lucide-react";
import { getLocales, type Locale } from "~/i18n";
import { NotificationBell } from "~/components/notifications/bell";

interface User {
  id: string;
  name: string;
  email: string;
  locale: string;
  theme: string;
}

interface TopbarProps {
  user: User;
  locale: Locale;
  theme: string;
  currentPath: string;
  onMobileMenuToggle: () => void;
  onThemeToggle?: () => void;
  onLocaleToggle?: () => void;
}

const routeMeta = [
  {
    match: "/",
    title: "Sala de comando",
    eyebrow: "Visao geral",
    description: "Resumo operacional da LHFEX e sinais de atencao.",
  },
  {
    match: "/crm",
    title: "CRM",
    eyebrow: "Relacionamento",
    description: "Clientes, pipeline e proximo movimento comercial.",
  },
  {
    match: "/processes",
    title: "Processos",
    eyebrow: "Operacao comex",
    description: "Embarques, referencias e fluxo de execucao.",
  },
  {
    match: "/financial",
    title: "Financeiro",
    eyebrow: "Fluxo de caixa",
    description: "Recebimentos, pagamentos e previsao.",
  },
  {
    match: "/calculator",
    title: "Calculadora COMEX",
    eyebrow: "Simulacao",
    description: "Estimativas de tributos, cambio e custos por carga.",
  },
  {
    match: "/automations",
    title: "IA & automacao",
    eyebrow: "Orquestracao",
    description: "Agentes, jobs e monitoramento das rotinas.",
  },
  {
    match: "/agents",
    title: "Agentes",
    eyebrow: "Squad IA",
    description: "Operacao do Hermes, memoria e especialistas.",
  },
  {
    match: "/personal-life",
    title: "Vida pessoal",
    eyebrow: "Painel pessoal",
    description: "Modulos auxiliares fora da operacao principal.",
  },
];

function getRouteMeta(pathname: string) {
  return (
    routeMeta
      .filter((item) => item.match === "/" || pathname.startsWith(item.match))
      .sort((a, b) => b.match.length - a.match.length)[0] ?? routeMeta[0]
  );
}

export function Topbar({
  user,
  locale,
  theme,
  currentPath,
  onMobileMenuToggle,
  onThemeToggle,
  onLocaleToggle,
}: TopbarProps) {
  const locales = getLocales();
  const currentLocaleLabel = locales.find((item) => item.value === locale)?.label ?? "PT";
  const meta = getRouteMeta(currentPath);

  return (
    <header className="sticky top-0 z-20 px-4 pt-4 lg:px-8 lg:pt-5">
      <div className="rounded-[26px] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,41,59,0.88))] px-4 py-3 text-slate-100 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl lg:px-6">
        <div className="flex items-start gap-3 lg:items-center">
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="mt-0.5 rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200 transition-colors hover:bg-white/10 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
                {meta.eyebrow}
              </span>
              <span className="hidden text-xs text-slate-400 lg:inline">
                LHFEX Ops
              </span>
            </div>

            <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-white lg:text-2xl">
                  {meta.title}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-300">
                  {meta.description}
                </p>
              </div>

              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                  Operacao ativa
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/15 text-sm font-semibold text-amber-100">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{user.name}</p>
                    <p className="truncate text-xs text-slate-400">{user.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {onLocaleToggle && (
              <button
                type="button"
                onClick={onLocaleToggle}
                className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
              >
                {currentLocaleLabel}
              </button>
            )}

            <div className="rounded-full border border-white/12 bg-white/5 p-1">
              <NotificationBell />
            </div>

            {onThemeToggle && (
              <button
                type="button"
                onClick={onThemeToggle}
                className="rounded-full border border-white/12 bg-white/5 p-2 text-slate-100 transition-colors hover:bg-white/10"
                aria-label="Alternar tema"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-400/15 text-sm font-semibold text-amber-100">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
