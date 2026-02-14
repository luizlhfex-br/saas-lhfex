import { Menu, Sun, Moon } from "lucide-react";
import { cn } from "~/lib/utils";
import { t, getLocales, type Locale } from "~/i18n";

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
    <header className="sticky top-0 z-20 flex h-16 items-center border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:px-6">
      {/* Mobile: hamburger */}
      <button
        type="button"
        onClick={onMobileMenuToggle}
        className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
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
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {currentLocaleLabel}
          </button>
        )}

        {/* Theme toggle */}
        {onThemeToggle && (
          <button
            type="button"
            onClick={onThemeToggle}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {user.name}
          </span>
        </div>
      </div>
    </header>
  );
}
