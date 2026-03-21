import { useState } from "react";
import { Form, NavLink } from "react-router";
import {
  Bot,
  Brain,
  Briefcase,
  Calculator,
  ChevronDown,
  DollarSign,
  FileText,
  Globe,
  Heart,
  Kanban,
  LayoutDashboard,
  LogOut,
  Package,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { t, type Locale } from "~/i18n";

interface User {
  id: string;
  name: string;
  email: string;
  locale: string;
  theme: string;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  locale: Locale;
  csrfToken: string;
  currentPath: string;
}

interface NavItem {
  labelKey?: keyof ReturnType<typeof t>["nav"];
  label?: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  disabled?: boolean;
  requiredEmail?: string;
}

const mainNavItems: NavItem[] = [
  { labelKey: "dashboard", icon: LayoutDashboard, to: "/" },
  { labelKey: "crm", icon: Users, to: "/crm" },
  { labelKey: "pipeline", icon: Kanban, to: "/crm/pipeline" },
  { labelKey: "processes", icon: FileText, to: "/processes" },
  { labelKey: "financial", icon: DollarSign, to: "/financial" },
  { labelKey: "publicProcurement", icon: Briefcase, to: "/public-procurement", requiredEmail: "luiz@lhfex.com.br" },
  { labelKey: "personalLife", icon: Heart, to: "/personal-life", requiredEmail: "luiz@lhfex.com.br" },
];

const comexNavItems: NavItem[] = [
  { labelKey: "calculator", icon: Calculator, to: "/calculator" },
  { labelKey: "ncm", icon: Search, to: "/ncm" },
  { label: "Descricao/NCM", icon: FileText, to: "/descricao-ncm" },
  { label: "Ex-Tarifarios", icon: FileText, to: "/ex-tarifarios" },
];

const aiAutomationNavItems: NavItem[] = [
  { labelKey: "automations", icon: Zap, to: "/automations" },
  { labelKey: "agents", icon: Bot, to: "/agents" },
  { label: "Conhecimento IA", icon: Brain, to: "/agents?tab=knowledge" },
  { label: "Fontes IA", icon: Globe, to: "/ai-updates" },
  { label: "Pixel Room", icon: Package, to: "/squad" },
  { labelKey: "aiUsage", icon: Sparkles, to: "/ai-usage" },
];

export function MobileNav({
  isOpen,
  onClose,
  user,
  locale,
  csrfToken,
  currentPath,
}: MobileNavProps) {
  const i18n = t(locale);
  const [openGroups, setOpenGroups] = useState({
    comex:
      currentPath.startsWith("/calculator") ||
      currentPath.startsWith("/ncm") ||
      currentPath.startsWith("/descricao-ncm") ||
      currentPath.startsWith("/ex-tarifarios"),
    aiAutomation:
      currentPath.startsWith("/automations") ||
      currentPath.startsWith("/agents") ||
      currentPath.startsWith("/ai-updates") ||
      currentPath.startsWith("/squad") ||
      currentPath.startsWith("/ai-usage"),
  });

  const toggleGroup = (group: "comex" | "aiAutomation") => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const renderNavItem = (item: NavItem) => {
    if (item.requiredEmail && item.requiredEmail !== user.email) {
      return null;
    }

    const Icon = item.icon;
    const label = item.label || (item.labelKey ? (i18n.nav[item.labelKey] as string) : "");

    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onClose}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-200",
            isActive
              ? "border-cyan-400/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.15),rgba(245,158,11,0.08))] text-white"
              : "border-white/8 bg-white/[0.03] text-[var(--app-sidebar-muted)] hover:bg-white/[0.06] hover:text-white"
          )
        }
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
          <Icon className="h-4 w-4" />
        </span>
        <span>{label}</span>
      </NavLink>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[92vw] transform flex-col border-r border-white/6 bg-[linear-gradient(180deg,#080a0f_0%,#0f172a_100%)] text-[var(--app-sidebar-text)] transition-transform duration-300 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="border-b border-white/6 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-100/80">
                LHFEX Ops
              </p>
              <h2 className="mt-2 text-base font-semibold text-white">Centro de comando</h2>
              <p className="mt-1 text-xs text-[var(--app-sidebar-muted)]">
                Navegacao operacional do SaaS.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/8 bg-white/[0.04] p-2 text-[var(--app-sidebar-muted)] hover:bg-white/[0.08] hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 rounded-[22px] border border-cyan-400/12 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(245,158,11,0.08))] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
              Usuario ativo
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/15 text-sm font-semibold text-amber-100">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="truncate text-xs text-[var(--app-sidebar-muted)]">{user.email}</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-1">{mainNavItems.map(renderNavItem)}</div>

          <div>
            <button
              type="button"
              onClick={() => toggleGroup("comex")}
              className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <span>Comex</span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", openGroups.comex ? "rotate-180" : "rotate-0")}
              />
            </button>
            {openGroups.comex && <div className="mt-1 space-y-1">{comexNavItems.map(renderNavItem)}</div>}
          </div>

          <div>
            <button
              type="button"
              onClick={() => toggleGroup("aiAutomation")}
              className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <span>IA & Auto</span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", openGroups.aiAutomation ? "rotate-180" : "rotate-0")}
              />
            </button>
            {openGroups.aiAutomation && (
              <div className="mt-1 space-y-1">{aiAutomationNavItems.map(renderNavItem)}</div>
            )}
          </div>
        </nav>

        <div className="border-t border-white/6 px-4 py-4">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "border-cyan-400/25 bg-cyan-400/12 text-white"
                  : "border-white/8 bg-white/[0.03] text-[var(--app-sidebar-muted)] hover:bg-white/[0.06] hover:text-white"
              )
            }
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
              <Settings className="h-4 w-4" />
            </span>
            <span>{i18n.nav.settings}</span>
          </NavLink>

          <Form method="post" action="/logout">
            <input type="hidden" name="csrf" value={csrfToken} />
            <button
              type="submit"
              className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm font-medium text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                <LogOut className="h-4 w-4" />
              </span>
              <span>{i18n.auth.logout}</span>
            </button>
          </Form>
        </div>
      </div>
    </>
  );
}
