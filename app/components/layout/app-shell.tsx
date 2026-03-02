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
    <div className="relative min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="relative z-10">
        {/* Desktop sidebar */}
        <Sidebar
          user={user}
          locale={locale}
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
