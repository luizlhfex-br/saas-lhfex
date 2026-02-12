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
  X,
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
  currentPath: string;
}

interface NavItem {
  labelKey: keyof ReturnType<typeof t>["nav"];
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  disabled?: boolean;
}

const mainNavItems: NavItem[] = [
  { labelKey: "dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { labelKey: "crm", icon: Users, to: "/crm" },
  { labelKey: "processes", icon: FileText, to: "/processes", disabled: true },
  { labelKey: "financial", icon: DollarSign, to: "/financial", disabled: true },
  {
    labelKey: "calculator",
    icon: Calculator,
    to: "/calculator",
    disabled: true,
  },
  { labelKey: "ncm", icon: Search, to: "/ncm", disabled: true },
  { labelKey: "agents", icon: Bot, to: "/agents", disabled: true },
];

export function MobileNav({
  isOpen,
  onClose,
  user,
  locale,
  currentPath,
}: MobileNavProps) {
  const i18n = t(locale);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-over panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-gray-800 dark:bg-gray-900 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header with logo and close button */}
        <div className="flex h-16 items-center justify-between px-6">
          <span className="text-xl font-bold text-blue-600">LHFEX</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const label = i18n.nav[item.labelKey] as string;

            if (item.disabled) {
              return (
                <div
                  key={item.to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 dark:text-gray-600"
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                  <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400 dark:bg-gray-800 dark:text-gray-600">
                    Em breve
                  </span>
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
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
        <div className="border-t border-gray-200 px-3 py-4 dark:border-gray-800">
          {/* User info */}
          <div className="mb-3 flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {user.name}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>

          {/* Settings */}
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
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
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <LogOut className="h-5 w-5" />
              <span>{i18n.auth.logout}</span>
            </button>
          </Form>
        </div>
      </div>
    </>
  );
}
