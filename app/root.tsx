import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import { Toaster } from "sonner";
import type { Route } from "./+types/root";
import { logErrorToSentry } from "~/lib/sentry.client";
import "./app.css";

export async function loader({ request }: Route.LoaderArgs) {
  // Initialize Sentry on server side
  const { initSentryServer } = await import("~/lib/sentry.server");
  initSentryServer();
  
  const cookieHeader = request.headers.get("cookie") || "";
  const themeMatch = cookieHeader.match(/theme=([^;]+)/);
  const theme = themeMatch ? themeMatch[1] : "dark";
  return { theme };
}

export const meta: Route.MetaFunction = () => [
  { title: "LHFEX — Comércio Exterior" },
  { name: "description", content: "Plataforma SaaS de gestão de comércio exterior — LHFEX" },
  { property: "og:title", content: "LHFEX — Comércio Exterior" },
  { property: "og:description", content: "Plataforma SaaS de gestão de comércio exterior" },
];

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "icon", href: "/favicon.ico" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // Read theme from root loader to apply to <html> element
  // This allows Tailwind dark: variants to work globally
  const rootData = useRouteLoaderData<typeof loader>("root");
  const theme = rootData?.theme ?? "dark";

  return (
    <html lang="pt-BR" className={theme === "dark" ? "dark" : ""}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Log error to Sentry
  if (error instanceof Error) {
    logErrorToSentry(error, {
      tags: { boundary: "root" },
    });
  }

  let status = 500;
  let title = "Erro Inesperado";
  let message = "Algo deu errado. Tente novamente mais tarde.";

  if (isRouteErrorResponse(error)) {
    status = error.status;
    if (status === 404) {
      title = "Página não encontrada";
      message = "A página que você está procurando não existe ou foi movida.";
    } else if (status === 403) {
      title = "Acesso negado";
      message = "Você não tem permissão para acessar esta página.";
    } else {
      title = `Erro ${status}`;
      message = error.statusText || message;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md text-center">
        <img
          src="/images/logo-horizontal.png"
          alt="LHFEX"
          className="mx-auto mb-8 h-10 w-auto"
        />
        <div className="mb-2 text-6xl font-bold text-gray-200 dark:text-gray-800">
          {status}
        </div>
        <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h1>
        <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
          {message}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
          >
            Voltar ao início
          </Link>
        </div>
        {import.meta.env.DEV && error instanceof Error && error.stack && (
          <pre className="mt-8 overflow-x-auto rounded-lg bg-gray-100 p-4 text-left text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
            <code>{error.stack}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
