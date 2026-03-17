import { redirect } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import {
  clearGoogleOAuthStateCookie,
  exchangeCodeForTokens,
  getValidGoogleToken,
  saveGoogleToken,
  validateGoogleOAuthState,
} from "~/lib/google.server";

/**
 * GET /api/google/callback
 * Recebe o codigo de autorizacao do Google e salva os tokens do usuario.
 */
export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);
  const clearStateCookie = await clearGoogleOAuthStateCookie();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (error) {
    const errorDescription = url.searchParams.get("error_description") || "unknown_error";
    console.warn(`[google] autenticacao cancelada: ${errorDescription}`);
    throw redirect("/settings?error=google_auth_cancelled", {
      headers: {
        "Set-Cookie": clearStateCookie,
      },
    });
  }

  if (!code) {
    console.error("[google] nenhum authorization code recebido");
    throw redirect("/settings?error=no_auth_code", {
      headers: {
        "Set-Cookie": clearStateCookie,
      },
    });
  }

  try {
    await validateGoogleOAuthState(request, state);

    const tokens = await exchangeCodeForTokens(code, request);

    await saveGoogleToken(
      user.id,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
      tokens.scope,
    );

    const savedToken = await getValidGoogleToken(user.id);
    if (!savedToken) {
      throw new Error("Falha ao confirmar token salvo");
    }

    console.log(`[google] OAuth concluido para ${user.email}`);
    throw redirect("/settings?success=google_connected", {
      headers: {
        "Set-Cookie": clearStateCookie,
      },
    });
  } catch (error) {
    console.error("[google] erro no callback OAuth", error);

    const errorCode = error instanceof Error && error.message.toLowerCase().includes("state")
      ? "google_auth_state"
      : "google_auth_failed";

    throw redirect(`/settings?error=${errorCode}`, {
      headers: {
        "Set-Cookie": clearStateCookie,
      },
    });
  }
}

