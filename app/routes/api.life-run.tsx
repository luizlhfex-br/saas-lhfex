import { requireAuth } from "~/lib/auth.server";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { lifeTaskSchema } from "~/lib/validators";
import { askLifeAgentLite } from "~/lib/ai.server";
import { jsonApiError } from "~/lib/api-error";
import type { AIOperationResult, LifeAgentTaskData } from "~/lib/ai-types";
import { buildAISuccess, buildAIFailure, buildAIError } from "~/lib/ai-types";

const DEFAULT_ALLOWED_EMAIL = "luiz@lhfex.com.br";

export async function action({ request }: { request: Request }) {
  const startTime = Date.now();
  
  try {
    const { user } = await requireAuth(request);

    const allowedEmail = (process.env.LIFE_AGENT_ALLOWED_EMAIL || DEFAULT_ALLOWED_EMAIL).toLowerCase();
    if (user.email.toLowerCase() !== allowedEmail) {
      return jsonApiError("FORBIDDEN_MODULE", "Acesso negado para este módulo.", { status: 403 });
    }

    const rateCheck = await checkRateLimit(
      `life-agent:${user.id}`,
      RATE_LIMITS.aiLifeAgent.maxAttempts,
      RATE_LIMITS.aiLifeAgent.windowMs,
    );

    if (!rateCheck.allowed) {
      return jsonApiError("RATE_LIMITED", "Limite de requisições excedido. Tente novamente em instantes.", { status: 429 });
    }

    const formData = await request.formData();
    const task = String(formData.get("task") || "").trim();

    const parsed = lifeTaskSchema.safeParse({ task });
    if (!parsed.success) {
      const error = buildAIFailure(
        buildAIError("INVALID_INPUT", "Entrada inválida. Descreva a tarefa com mais detalhes.", true, parsed.error.flatten()),
        "fallback",
        "none"
      );
      return Response.json(error, { status: 400 });
    }

    const response = await askLifeAgentLite(parsed.data.task, user.id);
    const latencyMs = Date.now() - startTime;
    
    // Estimate cost (for free providers it's $0)
    let costEstimate = "0.00";
    if (response.provider === "deepseek" || response.provider === "openrouter_paid") {
      const tokensUsed = response.tokensUsed || 0;
      costEstimate = ((tokensUsed * 0.14) / 1_000_000).toFixed(6);
    }

    const result: AIOperationResult<LifeAgentTaskData> = buildAISuccess(
      {
        result: response.content,
        steps: response.content.split("\\n").filter((line) => line.match(/^\\d+[.)]/)),
        priority: "medium",
      },
      response.provider,
      response.model,
      response.tokensUsed,
      latencyMs,
      costEstimate
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error("[LIFE_AGENT] Error:", error);
    
    const aiError = buildAIFailure(
      buildAIError(
        "INTERNAL_ERROR",
        "Não foi possível executar a automação pessoal agora. Tente novamente.",
        true,
        error instanceof Error ? error.message : String(error)
      ),
      "fallback",
      "none"
    );
    
    return Response.json(aiError, { status: 500 });
  }
}

export async function loader() {
  return jsonApiError("METHOD_NOT_ALLOWED", "Método não permitido.", { status: 405 });
}
