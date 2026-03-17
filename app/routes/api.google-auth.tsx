import { redirect } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { startGoogleOAuth } from "~/lib/google.server";

/**
 * GET /api/google/auth
 * Inicia fluxo de autenticação Google (também aceita POST)
 */
export async function loader({ request }: { request: Request }) {
  await requireAuth(request);
  const { authorizationUrl, stateCookieHeader } = await startGoogleOAuth(request);
  throw redirect(authorizationUrl, {
    headers: {
      "Set-Cookie": stateCookieHeader,
    },
  });
}

/**
 * POST /api/google/auth
 * Inicia fluxo de autenticação Google
 */
export async function action({ request }: { request: Request }) {
  await requireAuth(request);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { authorizationUrl, stateCookieHeader } = await startGoogleOAuth(request);
  throw redirect(authorizationUrl, {
    headers: {
      "Set-Cookie": stateCookieHeader,
    },
  });
}
