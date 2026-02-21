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
  requiredEmail?: string; // Only show if user email matches
}

const mainNavItems: NavItem[] = [
  { labelKey: "dashboard", icon: LayoutDashboard, to: "/" },
  { labelKey: "crm", icon: Users, to: "/crm" },
  { labelKey: "processes", icon: FileText, to: "/processes" },
  { labelKey: "financial", icon: DollarSign, to: "/financial" },
  { labelKey: "calculator", icon: Calculator, to: "/calculator" },
  { labelKey: "ncm", icon: Search, to: "/ncm" },
  { labelKey: "agents", icon: Bot, to: "/agents" },
  { labelKey: "publicProcurement", icon: Briefcase, to: "/public-procurement", requiredEmail: "luiz@lhfex.com.br" },
  { labelKey: "personalLife", icon: Heart, to: "/personal-life", requiredEmail: "luiz@lhfex.com.br" },
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
          "fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col border-r border-[var(--app-border-strong)] bg-[var(--app-sidebar-bg)] text-[var(--app-sidebar-text)] transition-transform duration-300 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header with logo and close button */}
        <div className="flex h-16 items-center justify-between px-6">
          <img src="/images/logo-horizontal.png" alt="LHFEX" className="h-8 w-auto" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--app-sidebar-muted)] hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
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
                  className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--app-sidebar-muted)]"
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
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--app-accent)]/20 text-white"
                      : "text-[var(--app-sidebar-muted)] hover:bg-white/5 hover:text-white"
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
        <div className="border-t border-white/10 px-4 py-4">
          {/* User info */}
          <div className="mb-3 flex items-center gap-3 px-3">
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
            onClick={onClose}
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
      </div>
    </>
  );
}
