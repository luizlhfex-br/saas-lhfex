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
  labelKey: keyof ReturnType<typeof t>["nav"];
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
  { labelKey: "calculator", icon: Calculator, to: "/calculator" },
  { labelKey: "ncm", icon: Search, to: "/ncm" },
  { labelKey: "automations", icon: Zap, to: "/automations" },
  { labelKey: "agents", icon: Bot, to: "/agents" },
  { labelKey: "publicProcurement", icon: Briefcase, to: "/public-procurement", requiredEmail: "luiz@lhfex.com.br" },
  { labelKey: "personalLife", icon: Heart, to: "/personal-life", requiredEmail: "luiz@lhfex.com.br" },
  { labelKey: "audit", icon: Shield, to: "/audit" },
  { labelKey: "aiUsage", icon: Sparkles, to: "/ai-usage" },
];

export function Sidebar({ user, locale, currentPath }: SidebarProps) {
  const i18n = t(locale);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-800 bg-gray-950 dark:border-gray-800 dark:bg-gray-950 lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center px-4">
        <img
          src="/images/logo-horizontal.png"
          alt="LHFEX"
          className="h-10 w-auto"
        />
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {mainNavItems.map((item) => {
          // Filter items by required email
          if (item.requiredEmail && user.email !== item.requiredEmail) {
            return null;
          }

          const Icon = item.icon;
          const label = i18n.nav[item.labelKey] as string;

          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600"
                title="Em breve"
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
                <span className="ml-auto rounded-full bg-gray-900 px-2 py-0.5 text-xs text-gray-600">
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
                    ? "bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white"
                    : "text-gray-400 hover:text-white dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-900"
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-800 px-3 py-4">
        {/* User info */}
        <div className="mb-3 flex items-center gap-3 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-sm font-medium text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-100">
              {user.name}
            </p>
            <p className="truncate text-xs text-gray-500">
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
                ? "bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white"
                : "text-gray-400 hover:text-white dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-900"
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
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-900"
          >
            <LogOut className="h-5 w-5" />
            <span>{i18n.auth.logout}</span>
          </button>
        </Form>
      </div>
    </aside>
  );
}
