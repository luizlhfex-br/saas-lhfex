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
  Shield,
  Sparkles,
  Heart,
  Briefcase,
  Globe,
  ChevronDown,
  Megaphone,
  Radio,
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
  currentPath: string;
}

interface NavItem {
  labelKey?: keyof ReturnType<typeof t>["nav"];
  label?: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  disabled?: boolean;
  requiredEmail?: string; // Only show if user email matches
}

const mainNavItems: NavItem[] = [
  { labelKey: "dashboard", icon: LayoutDashboard, to: "/" },
  { labelKey: "crm", icon: Users, to: "/crm" },
  { labelKey: "pipeline", icon: Kanban, to: "/crm/pipeline" },
  { labelKey: "processes", icon: FileText, to: "/processes" },
  { labelKey: "financial", icon: DollarSign, to: "/financial" },
  { labelKey: "personalLife", icon: Heart, to: "/personal-life", requiredEmail: "luiz@lhfex.com.br" },
  { labelKey: "audit", icon: Shield, to: "/audit" },
];

const otherBusinessNavItems: NavItem[] = [
  { labelKey: "publicProcurement", icon: Briefcase, to: "/public-procurement", requiredEmail: "luiz@lhfex.com.br" },
  { labelKey: "internetBusiness", icon: Globe, to: "/other-business/internet", requiredEmail: "luiz@lhfex.com.br" },
  { label: "Promoções", icon: Megaphone, to: "/company-promotions", requiredEmail: "luiz@lhfex.com.br" },
  { label: "Radio Monitor", icon: Radio, to: "/radio-monitor", requiredEmail: "luiz@lhfex.com.br" },
];

const comexNavItems: NavItem[] = [
  { labelKey: "calculator", icon: Calculator, to: "/calculator" },
  { labelKey: "ncm", icon: Search, to: "/ncm" },
];

const aiAutomationNavItems: NavItem[] = [
  { labelKey: "automations", icon: Zap, to: "/automations" },
  { labelKey: "agents", icon: Bot, to: "/agents" },
  { labelKey: "aiUsage", icon: Sparkles, to: "/ai-usage" },
];

export function Sidebar({ user, locale, currentPath }: SidebarProps) {
  const i18n = t(locale);
  const [openGroups, setOpenGroups] = useState({
    comex: currentPath.startsWith("/calculator") || currentPath.startsWith("/ncm"),
    aiAutomation:
      currentPath.startsWith("/automations") ||
      currentPath.startsWith("/agents") ||
      currentPath.startsWith("/ai-usage"),
    otherBusiness:
      currentPath.startsWith("/public-procurement") ||
      currentPath.startsWith("/other-business"),
  });

  const toggleGroup = (group: "comex" | "aiAutomation" | "otherBusiness") => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const renderNavItem = (item: NavItem) => {
    if (item.requiredEmail && user.email !== item.requiredEmail) {
      return null;
    }

    const Icon = item.icon;
    const label = item.label || (item.labelKey ? (i18n.nav[item.labelKey] as string) : "");

    if (item.disabled) {
      return (
        <div
          key={item.to}
          className="group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--app-sidebar-muted)]"
          title="Em breve"
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--app-sidebar-muted)]">
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
            "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-[var(--app-accent)]/20 text-white shadow-[var(--app-glow)]"
              : "text-[var(--app-sidebar-muted)] hover:bg-white/5 hover:text-white"
          )
        }
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </NavLink>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-[var(--app-border-strong)] bg-[var(--app-sidebar-bg)] text-[var(--app-sidebar-text)] lg:flex">
      {/* Logo */}
      <div className="flex h-20 items-center px-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-emerald-300">LHFEX</p>
          <img
            src="/images/logo-horizontal.png"
            alt="LHFEX"
            className="mt-2 h-8 w-auto"
          />
        </div>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-2">
        {mainNavItems.map(renderNavItem)}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => toggleGroup("comex")}
            className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <span>Comércio Exterior</span>
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
            className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <span>IA & Automação</span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", openGroups.aiAutomation ? "rotate-180" : "rotate-0")}
            />
          </button>
          {openGroups.aiAutomation && (
            <div className="mt-1 space-y-1">{aiAutomationNavItems.map(renderNavItem)}</div>
          )}
        </div>

        {/* Outros Negócios — only shown if user has at least one item visible */}
        {user.email === "luiz@lhfex.com.br" && (
          <div>
            <button
              type="button"
              onClick={() => toggleGroup("otherBusiness")}
              className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white"
            >
              <span>Outros Negócios</span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", openGroups.otherBusiness ? "rotate-180" : "rotate-0")}
              />
            </button>
            {openGroups.otherBusiness && (
              <div className="mt-1 space-y-1">{otherBusinessNavItems.map(renderNavItem)}</div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/10 px-4 py-5">
        {/* User info */}
        <div className="mb-4 flex items-center gap-3 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-accent)] text-sm font-medium text-[var(--app-on-accent)]">
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
              "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-[var(--app-accent)]/20 text-white"
                : "text-[var(--app-sidebar-muted)] hover:bg-white/5 hover:text-white"
            )
          }
        >
          <Settings className="h-5 w-5" />
          <span>{i18n.nav.settings}</span>
        </NavLink>

        {/* Logout */}
        <Form method="post" action="/logout">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--app-sidebar-muted)] transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            <span>{i18n.auth.logout}</span>
          </button>
        </Form>
      </div>
    </aside>
  );
}
