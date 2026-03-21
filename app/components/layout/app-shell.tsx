import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import type { Locale } from "~/i18n";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { ChatWidget } from "~/components/chat";
import { cn } from "~/lib/utils";

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
  csrfToken: string;
  onThemeToggle?: () => void;
  onLocaleToggle?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  user,
  locale,
  theme,
  csrfToken,
  onThemeToggle,
  onLocaleToggle,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Read initial collapsed state from cookie after hydration
  useEffect(() => {
    const match = document.cookie.match(/sidebar-collapsed=([^;]*)/);
    if (match?.[1] === "true") setSidebarCollapsed(true);
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    document.cookie = `sidebar-collapsed=${next}; path=/; max-age=31536000`;
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.13),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.03),transparent_30%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.075]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.18) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0))",
        }}
      />
      <div className="relative z-10">
        {/* Desktop sidebar */}
        <Sidebar
          user={user}
          locale={locale}
          csrfToken={csrfToken}
          currentPath={location.pathname}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        {/* Mobile navigation */}
        <MobileNav
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          user={user}
          locale={locale}
          csrfToken={csrfToken}
          currentPath={location.pathname}
        />

        {/* Main content area — margin follows sidebar width */}
        <div
          className={cn(
            "transition-[margin] duration-200 ease-in-out",
            sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
          )}
        >
          {/* Top bar */}
          <Topbar
            user={user}
            locale={locale}
            theme={theme}
            currentPath={location.pathname}
            onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
            onThemeToggle={onThemeToggle}
            onLocaleToggle={onLocaleToggle}
          />

          {/* Page content */}
          <main className="px-4 pb-8 pt-4 lg:px-8 lg:pb-10 lg:pt-6">
            <div className="mx-auto max-w-[1600px]">{children}</div>
          </main>
        </div>

        {/* Floating chat widget */}
        {location.pathname !== "/agents" && <ChatWidget />}
      </div>
    </div>
  );
}
