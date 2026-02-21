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
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-[-10%] h-72 w-72 rounded-full bg-[var(--app-accent)]/10 blur-3xl" />
        <div className="absolute -bottom-40 left-[-10%] h-72 w-72 rounded-full bg-[var(--app-accent-2)]/10 blur-3xl" />
      </div>

      <div className="relative z-10">
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
      <div className="lg:ml-72">
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
        <main className="p-4 lg:p-8">{children}</main>
      </div>

      {/* Floating chat widget */}
      {location.pathname !== "/agents" && <ChatWidget />}
      </div>
    </div>
  );
}
