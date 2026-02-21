import { requireAuth } from "~/lib/auth.server";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { lifeTaskSchema } from "~/lib/validators";
import { askLifeAgentLite } from "~/lib/ai.server";
import { jsonApiError } from "~/lib/api-error";

const DEFAULT_ALLOWED_EMAIL = "luiz@lhfex.com.br";

export async function action({ request }: { request: Request }) {
  try {
    const { user } = await requireAuth(request);

    const allowedEmail = (process.env.LIFE_AGENT_ALLOWED_EMAIL || DEFAULT_ALLOWED_EMAIL).toLowerCase();
    if (user.email.toLowerCase() !== allowedEmail) {
      return jsonApiError("FORBIDDEN_MODULE", "Acesso negado para este módulo.", { status: 403 });
    }

    const rateCheck = await checkRateLimit(
      `life-agent:${user.id}`,
      RATE_LIMITS.chatApi.maxAttempts,
      RATE_LIMITS.chatApi.windowMs,
    );

    if (!rateCheck.allowed) {
      return jsonApiError("RATE_LIMITED", "Limite de requisições excedido. Tente novamente em instantes.", { status: 429 });
    }

    const formData = await request.formData();
    const task = String(formData.get("task") || "").trim();

    const parsed = lifeTaskSchema.safeParse({ task });
    if (!parsed.success) {
      return jsonApiError("INVALID_INPUT", "Entrada inválida.", { status: 400 }, { details: parsed.error.flatten() });
    }

    const response = await askLifeAgentLite(parsed.data.task, user.id);
    return Response.json({
      result: response.content,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed || 0,
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error("[LIFE_AGENT] Error:", error);
    return jsonApiError("AI_PROVIDER_ERROR", "Não foi possível executar a automação pessoal agora. Tente novamente.", { status: 500 });
  }
}

export async function loader() {
  return jsonApiError("METHOD_NOT_ALLOWED", "Método não permitido.", { status: 405 });
}
