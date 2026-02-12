import { Outlet } from "react-router";
import type { Route } from "./+types/app-layout";
import { requireAuth } from "~/lib/auth.server";
import { AppShell } from "~/components/layout";
import type { Locale } from "~/i18n";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const themeMatch = cookieHeader.match(/theme=([^;]+)/);
  const theme = themeMatch ? themeMatch[1] : user.theme;

  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      theme: user.theme,
    },
    locale,
    theme,
  };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user, locale, theme } = loaderData;

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <AppShell user={user} locale={locale} theme={theme}>
        <Outlet />
      </AppShell>
    </div>
  );
}
