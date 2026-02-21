import { redirect } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { getAuthorizationUrl } from "~/lib/google.server";

/**
 * POST /api/google/auth
 * Inicia fluxo de autenticação Google
 */
export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authUrl = getAuthorizationUrl();
  throw redirect(authUrl);
}
