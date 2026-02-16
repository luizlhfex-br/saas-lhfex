import { useState } from "react";
import { useLocation } from "react-router";
import type { Locale } from "~/i18n";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { ChatWidget } from "~/components/chat";

interface User {
  id: string;
  name: string;
  email: string;
  locale: string;
  theme: string;
}

interface AppShellProps {
  user: User;
  locale: Locale;
  theme: string;
  onThemeToggle?: () => void;
  onLocaleToggle?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  user,
  locale,
  theme,
  onThemeToggle,
  onLocaleToggle,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <Sidebar user={user} locale={locale} currentPath={location.pathname} />

      {/* Mobile navigation */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        locale={locale}
        currentPath={location.pathname}
      />

      {/* Main content area */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <Topbar
          user={user}
          locale={locale}
          theme={theme}
          onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
          onThemeToggle={onThemeToggle}
          onLocaleToggle={onLocaleToggle}
        />

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>

      {/* Floating chat widget */}
      {location.pathname !== "/agents" && <ChatWidget />}
    </div>
  );
}
