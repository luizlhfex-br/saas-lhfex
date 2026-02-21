import { requireAuth } from "~/lib/auth.server";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { lifeTaskSchema } from "~/lib/validators";
import { askLifeAgentLite } from "~/lib/ai.server";

const DEFAULT_ALLOWED_EMAIL = "luiz@lhfex.com.br";

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);

  const allowedEmail = (process.env.LIFE_AGENT_ALLOWED_EMAIL || DEFAULT_ALLOWED_EMAIL).toLowerCase();
  if (user.email.toLowerCase() !== allowedEmail) {
    return Response.json({ error: "Acesso negado para este módulo." }, { status: 403 });
  }

  const rateCheck = await checkRateLimit(
    `life-agent:${user.id}`,
    RATE_LIMITS.chatApi.maxAttempts,
    RATE_LIMITS.chatApi.windowMs,
  );

  if (!rateCheck.allowed) {
    return Response.json({ error: "Limite de requisições excedido. Tente novamente em instantes." }, { status: 429 });
  }

  const formData = await request.formData();
  const task = String(formData.get("task") || "").trim();

  const parsed = lifeTaskSchema.safeParse({ task });
  if (!parsed.success) {
    return Response.json({ error: "Entrada inválida.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const response = await askLifeAgentLite(parsed.data.task, user.id);
    return Response.json({
      result: response.content,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed || 0,
    });
  } catch (error) {
    console.error("[LIFE_AGENT] Error:", error);
    return Response.json(
      { error: "Não foi possível executar a automação pessoal agora. Tente novamente." },
      { status: 500 },
    );
  }
}

export async function loader() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
