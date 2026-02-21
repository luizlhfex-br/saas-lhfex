import { redirect } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { exchangeCodeForTokens, saveGoogleToken, getValidGoogleToken } from "~/lib/google.server";
import { data } from "react-router";

/**
 * GET /api/google/callback
 * Recebe código de autorização do Google e troca por tokens
 */
export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  // Usuário cancelou autenticação
  if (error) {
    const errorDescription = url.searchParams.get("error_description") || "Unknown error";
    console.warn(`⚠️  Google auth cancelled: ${errorDescription}`);
    throw redirect(`/settings?error=google_auth_cancelled`);
  }

  // Nenhum código recebido
  if (!code) {
    console.error("❌ No authorization code received from Google");
    throw redirect(`/settings?error=no_auth_code`);
  }

  try {
    // 1. Troca código por tokens
    const tokens = await exchangeCodeForTokens(code);

    // 2. Salva no banco
    await saveGoogleToken(
      user.id,
      tokens.accessToken,
      tokens.refreshToken || undefined,
      tokens.expiresAt,
      tokens.scope,
    );

    // 3. Verifica que foi salvo corretamente
    const saved = await getValidGoogleToken(user.id);
    if (!saved) {
      throw new Error("Failed to verify saved token");
    }

    console.log(`✅ Google OAuth successful for user ${user.email}`);
    throw redirect(`/settings?success=google_connected`);
  } catch (error) {
    console.error("❌ Google OAuth callback error:", error);
    throw redirect(`/settings?error=google_auth_failed`);
  }
}
