import { useState } from "react";
import { NavLink, Form } from "react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  DollarSign,
  Calculator,
  Search,
  Bot,
  Settings,
  LogOut,
  Zap,
  Kanban,
  Sparkles,
  Heart,
  Briefcase,
  Globe,
  Package,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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

const otherBusinessNavItems: NavItem[] = [
  { labelKey: "publicProcurement", icon: Briefcase, to: "/public-procurement", requiredEmail: "luiz@lhfex.com.br" },
  { labelKey: "internetBusiness", icon: Globe, to: "/other-business/internet", requiredEmail: "luiz@lhfex.com.br" },
  { label: "Criar/Publicar Apps", icon: Package, to: "/other-business/apps", requiredEmail: "luiz@lhfex.com.br" },
];

const comexNavItems: NavItem[] = [
  { labelKey: "calculator", icon: Calculator, to: "/calculator" },
  { labelKey: "ncm", icon: Search, to: "/ncm" },
  { label: "Descrição/NCM", icon: FileText, to: "/descricao-ncm" },
  { label: "Ex-Tarifarios", icon: FileText, to: "/ex-tarifarios" },
];

const aiAutomationNavItems: NavItem[] = [
  { labelKey: "automations", icon: Zap, to: "/automations" },
  { label: "IA Agentes", icon: Bot, to: "/agents" },
  { label: "Pixel Room", icon: Package, to: "/squad" },
  { labelKey: "aiUsage", icon: Sparkles, to: "/ai-usage" },
];

export function Sidebar({ user, locale, csrfToken, currentPath, collapsed, onToggle }: SidebarProps) {
  const i18n = t(locale);
  const [openGroups, setOpenGroups] = useState({
    comex: currentPath.startsWith("/calculator") || currentPath.startsWith("/ncm") || currentPath.startsWith("/ex-tarifarios") || currentPath.startsWith("/descricao-ncm"),
    aiAutomation:
      currentPath.startsWith("/automations") ||
      currentPath.startsWith("/agents") ||
      currentPath.startsWith("/squad") ||
      currentPath.startsWith("/ai-usage") ||
      currentPath.startsWith("/changelog"),
    otherBusiness:
      currentPath.startsWith("/public-procurement") ||
      currentPath.startsWith("/other-business"),
  });

  const toggleGroup = (group: "comex" | "aiAutomation" | "otherBusiness") => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const isItemVisible = (item: NavItem) =>
    !item.requiredEmail || user.email === item.requiredEmail;

  const getLabel = (item: NavItem) =>
    item.label || (item.labelKey ? (i18n.nav[item.labelKey] as string) : "");

  // ── Expanded: full nav item ─────────────────────────────────────────────
  const renderNavItem = (item: NavItem) => {
    if (!isItemVisible(item)) return null;
    const Icon = item.icon;
    const label = getLabel(item);

    if (item.disabled) {
      return (
        <div
          key={item.to}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--app-sidebar-muted)]"
          title="Em breve"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
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
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-indigo-500/15 text-indigo-300"
              : "text-[var(--app-sidebar-muted)] hover:bg-white/5 hover:text-white"
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </NavLink>
    );
  };

  // ── Collapsed: icon-only nav item ───────────────────────────────────────
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
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            isActive
              ? "bg-indigo-500/15 text-indigo-300"
              : "text-[var(--app-sidebar-muted)] hover:bg-white/10 hover:text-white"
          )
        }
      >
        <Icon className="h-4 w-4" />
      </NavLink>
    );
  };

  const allGroupedItems = [
    ...comexNavItems,
    ...aiAutomationNavItems,
    ...otherBusinessNavItems,
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/5 bg-[var(--app-sidebar-bg)] text-[var(--app-sidebar-text)] transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-white/5",
          collapsed ? "justify-center" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <span className="text-xs font-bold tracking-[0.3em] text-indigo-400">
            LHFEX
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/10 hover:text-white"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      {collapsed ? (
        // Icon-only flat list
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
          {mainNavItems.map(renderIconItem)}

          {/* Divider between main and grouped items */}
          <div className="my-1 h-px w-8 bg-white/10" />

          {allGroupedItems.map(renderIconItem)}
        </nav>
      ) : (
        // Full navigation with groups
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {mainNavItems.map(renderNavItem)}

          {/* Comércio Exterior */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => toggleGroup("comex")}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white"
            >
              <span>Comex</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  openGroups.comex ? "rotate-180" : "rotate-0"
                )}
              />
            </button>
            {openGroups.comex && (
              <div className="mt-0.5 space-y-0.5">{comexNavItems.map(renderNavItem)}</div>
            )}
          </div>

          {/* IA & Automação */}
          <div>
            <button
              type="button"
              onClick={() => toggleGroup("aiAutomation")}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white"
            >
              <span>IA & Auto</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  openGroups.aiAutomation ? "rotate-180" : "rotate-0"
                )}
              />
            </button>
            {openGroups.aiAutomation && (
              <div className="mt-0.5 space-y-0.5">
                {aiAutomationNavItems.map(renderNavItem)}
              </div>
            )}
          </div>

          {/* Outros Negócios — restricted */}
          {user.email === "luiz@lhfex.com.br" && (
            <div>
              <button
                type="button"
                onClick={() => toggleGroup("otherBusiness")}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white"
              >
                <span>Outros</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    openGroups.otherBusiness ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>
              {openGroups.otherBusiness && (
                <div className="mt-0.5 space-y-0.5">
                  {otherBusinessNavItems.map(renderNavItem)}
                </div>
              )}
            </div>
          )}
        </nav>
      )}

      {/* ── Bottom: user + settings + logout ───────────────────────────── */}
      <div
        className={cn(
          "shrink-0 border-t border-white/5",
          collapsed ? "flex flex-col items-center gap-1 py-3" : "px-3 py-3"
        )}
      >
        {collapsed ? (
          <>
            {/* Avatar */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-sm font-semibold text-indigo-300"
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            {/* Settings */}
            <NavLink
              to="/settings"
              title={i18n.nav.settings}
              className={({ isActive }) =>
                cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-indigo-500/15 text-indigo-300"
                    : "text-[var(--app-sidebar-muted)] hover:bg-white/10 hover:text-white"
                )
              }
            >
              <Settings className="h-4 w-4" />
            </NavLink>
            {/* Logout */}
            <Form method="post" action="/logout">
              <input type="hidden" name="csrf" value={csrfToken} />
              <button
                type="submit"
                title={i18n.auth.logout}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </Form>
          </>
        ) : (
          <>
            {/* User info */}
            <div className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-sm font-semibold text-indigo-300">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user.name}
                </p>
                <p className="truncate text-xs text-[var(--app-sidebar-muted)]">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Settings */}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-500/15 text-indigo-300"
                    : "text-[var(--app-sidebar-muted)] hover:bg-white/5 hover:text-white"
                )
              }
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>{i18n.nav.settings}</span>
            </NavLink>

            {/* Logout */}
            <Form method="post" action="/logout">
              <input type="hidden" name="csrf" value={csrfToken} />
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white"
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
