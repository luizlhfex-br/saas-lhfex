import { Menu, Sun, Moon } from "lucide-react";
import { cn } from "~/lib/utils";
import { t, getLocales, type Locale } from "~/i18n";
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
  onMobileMenuToggle: () => void;
  onThemeToggle?: () => void;
  onLocaleToggle?: () => void;
}

export function Topbar({
  user,
  locale,
  theme,
  onMobileMenuToggle,
  onThemeToggle,
  onLocaleToggle,
}: TopbarProps) {
  const locales = getLocales();
  const currentLocaleLabel = locales.find((l) => l.value === locale)?.label ?? "PT";

  return (
    <header className="sticky top-0 z-20 flex h-18 items-center border-b border-[var(--app-border)] bg-[var(--app-topbar)] px-4 backdrop-blur lg:px-8">
      {/* Mobile: hamburger */}
      <button
        type="button"
        onClick={onMobileMenuToggle}
        className="rounded-xl p-2 text-[var(--app-muted)] hover:bg-black/5 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile: centered logo */}
      <div className="flex flex-1 items-center justify-center lg:hidden">
        <img src="/images/logo-horizontal.png" alt="LHFEX" className="h-8 w-auto" />
      </div>

      {/* Desktop: breadcrumb area (left side placeholder) */}
      <div className="hidden flex-1 lg:block" />

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Locale toggle */}
        {onLocaleToggle && (
          <button
            type="button"
            onClick={onLocaleToggle}
            className="rounded-full border border-[var(--app-border-strong)] px-3 py-1.5 text-sm font-medium text-[var(--app-muted)] hover:bg-black/5"
          >
            {currentLocaleLabel}
          </button>
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* Theme toggle */}
        {onThemeToggle && (
          <button
            type="button"
            onClick={onThemeToggle}
            className="rounded-full border border-[var(--app-border-strong)] p-2 text-[var(--app-muted)] hover:bg-black/5"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        )}

        {/* Desktop: user info */}
        <div className="hidden items-center gap-3 pl-2 lg:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-accent)] text-sm font-medium text-[var(--app-on-accent)]">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[var(--app-text)]">
            {user.name}
          </span>
        </div>
      </div>
    </header>
  );
}
