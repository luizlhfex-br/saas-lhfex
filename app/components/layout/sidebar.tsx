import { useState } from "react";
import { Form, NavLink } from "react-router";
import {
  Bot,
  Brain,
  Briefcase,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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

interface SidebarProps {
  user: User;
  locale: Locale;
  csrfToken: string;
  currentPath: string;
  collapsed: boolean;
  onToggle: () => void;
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
  { label: "IA Agentes", icon: Bot, to: "/agents" },
  { label: "Conhecimento IA", icon: Brain, to: "/agents?tab=knowledge" },
  { label: "Fontes IA", icon: Globe, to: "/ai-updates" },
  { label: "Pixel Room", icon: Package, to: "/squad" },
  { labelKey: "aiUsage", icon: Sparkles, to: "/ai-usage" },
];

const otherBusinessNavItems: NavItem[] = [
  { labelKey: "publicProcurement", icon: Briefcase, to: "/public-procurement", requiredEmail: "luiz@lhfex.com.br" },
  { labelKey: "internetBusiness", icon: Globe, to: "/other-business/internet", requiredEmail: "luiz@lhfex.com.br" },
  { label: "Criar/Publicar Apps", icon: Package, to: "/other-business/apps", requiredEmail: "luiz@lhfex.com.br" },
];

export function Sidebar({
  user,
  locale,
  csrfToken,
  currentPath,
  collapsed,
  onToggle,
}: SidebarProps) {
  const i18n = t(locale);
  const [openGroups, setOpenGroups] = useState({
    comex:
      currentPath.startsWith("/calculator") ||
      currentPath.startsWith("/ncm") ||
      currentPath.startsWith("/ex-tarifarios") ||
      currentPath.startsWith("/descricao-ncm"),
    aiAutomation:
      currentPath.startsWith("/automations") ||
      currentPath.startsWith("/agents") ||
      currentPath.startsWith("/ai-updates") ||
      currentPath.startsWith("/squad") ||
      currentPath.startsWith("/ai-usage"),
    otherBusiness:
      currentPath.startsWith("/public-procurement") ||
      currentPath.startsWith("/other-business"),
  });

  const toggleGroup = (group: "comex" | "aiAutomation" | "otherBusiness") => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const isItemVisible = (item: NavItem) =>
    !item.requiredEmail || item.requiredEmail === user.email;

  const getLabel = (item: NavItem) =>
    item.label || (item.labelKey ? (i18n.nav[item.labelKey] as string) : "");

  const allGroupedItems = [
    ...comexNavItems,
    ...aiAutomationNavItems,
    ...otherBusinessNavItems,
  ];

  const currentFocus = currentPath.startsWith("/processes")
    ? "Processos"
    : currentPath.startsWith("/financial")
      ? "Financeiro"
      : currentPath.startsWith("/calculator")
        ? "Calculadora"
        : currentPath.startsWith("/agents") || currentPath.startsWith("/automations")
          ? "IA"
          : "Operacao";

  const renderNavItem = (item: NavItem) => {
    if (!isItemVisible(item)) return null;
    const Icon = item.icon;
    const label = getLabel(item);

    if (item.disabled) {
      return (
        <div
          key={item.to}
          className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-[var(--app-sidebar-muted)]"
          title="Em breve"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]">
            Em breve
          </span>
        </div>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          cn(
            "group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all duration-200",
            isActive
              ? "border-cyan-400/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.15),rgba(245,158,11,0.08))] text-white shadow-[0_10px_30px_rgba(8,47,73,0.35)]"
              : "border-transparent text-[var(--app-sidebar-muted)] hover:border-white/8 hover:bg-white/[0.045] hover:text-white"
          )
        }
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/6 bg-white/[0.04] text-slate-100 transition-colors group-hover:bg-white/[0.07]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{label}</span>
      </NavLink>
    );
  };

  const renderIconItem = (item: NavItem) => {
    if (!isItemVisible(item)) return null;
    const Icon = item.icon;
    const label = getLabel(item);

    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={label}
        className={({ isActive }) =>
          cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200",
            isActive
              ? "border-cyan-400/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.15),rgba(245,158,11,0.08))] text-white shadow-[0_10px_30px_rgba(8,47,73,0.35)]"
              : "border-white/6 bg-white/[0.03] text-[var(--app-sidebar-muted)] hover:bg-white/[0.06] hover:text-white"
          )
        }
      >
        <Icon className="h-4 w-4" />
      </NavLink>
    );
  };

  const renderGroup = (
    groupKey: "comex" | "aiAutomation" | "otherBusiness",
    label: string,
    items: NavItem[]
  ) => (
    <div>
      <button
        type="button"
        onClick={() => toggleGroup(groupKey)}
        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/[0.04] hover:text-white"
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            openGroups[groupKey] ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      {openGroups[groupKey] && <div className="mt-1 space-y-1">{items.map(renderNavItem)}</div>}
    </div>
  );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/5 bg-[linear-gradient(180deg,#080a0f_0%,#0f172a_100%)] text-[var(--app-sidebar-text)] transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={cn(
          "shrink-0 border-b border-white/6",
          collapsed ? "px-2 py-3" : "px-4 py-4"
        )}
      >
        <div className={cn("flex items-start", collapsed ? "justify-center" : "justify-between gap-3")}>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                LHFEX Ops
              </p>
              <h2 className="mt-2 text-base font-semibold text-white">Centro de comando</h2>
              <p className="mt-1 text-xs text-[var(--app-sidebar-muted)]">
                Navegacao operacional do SaaS.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/[0.08] hover:text-white"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="mt-4 rounded-[22px] border border-cyan-400/12 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(245,158,11,0.08))] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
                  Foco atual
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{currentFocus}</p>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                Online
              </span>
            </div>
          </div>
        )}
      </div>

      {collapsed ? (
        <nav className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-4">
          {mainNavItems.map(renderIconItem)}
          <div className="my-1 h-px w-8 bg-white/10" />
          {allGroupedItems.map(renderIconItem)}
        </nav>
      ) : (
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          <div className="space-y-1">{mainNavItems.map(renderNavItem)}</div>
          {renderGroup("comex", "Comex", comexNavItems)}
          {renderGroup("aiAutomation", "IA & Auto", aiAutomationNavItems)}
          {user.email === "luiz@lhfex.com.br" &&
            renderGroup("otherBusiness", "Outros", otherBusinessNavItems)}
        </nav>
      )}

      <div
        className={cn(
          "shrink-0 border-t border-white/6",
          collapsed ? "flex flex-col items-center gap-2 px-2 py-3" : "px-3 py-3"
        )}
      >
        {collapsed ? (
          <>
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/18 bg-amber-400/10 text-sm font-semibold text-amber-100"
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <NavLink
              to="/settings"
              title={i18n.nav.settings}
              className={({ isActive }) =>
                cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors",
                  isActive
                    ? "border-cyan-400/25 bg-cyan-400/12 text-white"
                    : "border-white/8 bg-white/[0.03] text-[var(--app-sidebar-muted)] hover:bg-white/[0.06] hover:text-white"
                )
              }
            >
              <Settings className="h-4 w-4" />
            </NavLink>
            <Form method="post" action="/logout">
              <input type="hidden" name="csrf" value={csrfToken} />
              <button
                type="submit"
                title={i18n.auth.logout}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </Form>
          </>
        ) : (
          <>
            <div className="mb-2 rounded-[22px] border border-white/8 bg-white/[0.035] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/18 bg-amber-400/10 text-sm font-semibold text-amber-100">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{user.name}</p>
                  <p className="truncate text-xs text-[var(--app-sidebar-muted)]">{user.email}</p>
                </div>
              </div>
            </div>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-cyan-400/25 bg-cyan-400/12 text-white"
                    : "border-white/8 bg-white/[0.03] text-[var(--app-sidebar-muted)] hover:bg-white/[0.06] hover:text-white"
                )
              }
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>{i18n.nav.settings}</span>
            </NavLink>

            <Form method="post" action="/logout">
              <input type="hidden" name="csrf" value={csrfToken} />
              <button
                type="submit"
                className="mt-1 flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>{i18n.auth.logout}</span>
              </button>
            </Form>
          </>
        )}
      </div>
    </aside>
  );
}
