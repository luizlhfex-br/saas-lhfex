import type { Route } from "./+types/api.chat";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { chatConversations, chatMessages } from "drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { chatMessageSchema } from "~/lib/validators";
import { askAgent } from "~/lib/ai.server";
import { jsonApiError } from "~/lib/api-error";

export async function action({ request }: Route.ActionArgs) {
  try {
    const { user } = await requireAuth(request);

    // Rate limiting — 20 messages per minute per user
    const rateCheck = await checkRateLimit(`chat:${user.id}`, RATE_LIMITS.chatApi.maxAttempts, RATE_LIMITS.chatApi.windowMs);
    if (!rateCheck.allowed) {
      return jsonApiError(
        "RATE_LIMITED",
        "Você atingiu o limite de mensagens. Tente novamente em instantes.",
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = chatMessageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonApiError(
        "INVALID_INPUT",
        "Dados inválidos para o chat.",
        { status: 400 },
        { details: parsed.error.flatten() }
      );
    }
    const { message, agentId, conversationId } = parsed.data;

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const [conv] = await db.insert(chatConversations).values({
        userId: user.id,
        agentId,
        title: message.slice(0, 100),
      }).returning({ id: chatConversations.id });
      convId = conv.id;
    }

    // Save user message
    await db.insert(chatMessages).values({
      conversationId: convId,
      role: "user",
      content: message.trim(),
      agentId: null,
    });

    // Call AI agent (Gemini Free → OpenRouter Free → DeepSeek Paid fallback)
    let reply: string;
    let aiModel = "unknown";
    let aiProvider = "none";
    let aiError: string | null = null;

    try {
      const aiResponse = await askAgent(agentId, message.trim(), user.id);
      reply = aiResponse.content;
      aiModel = aiResponse.model;
      aiProvider = aiResponse.provider;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      aiError = errorMessage;
      console.error(`[CHAT:AI_FAILURE] userId=${user.id} agentId=${agentId} error="${errorMessage}"`);
      
      // Check if it's provider configuration issue
      if (errorMessage.includes("not configured") || errorMessage.includes("API_KEY")) {
        return jsonApiError(
          "AI_PROVIDER_UNAVAILABLE",
          "Os provedores de IA estão temporariamente indisponíveis. Entre em contato com o suporte.",
          { status: 503 },
          { details: { provider: aiProvider, model: aiModel } }
        );
      }
      
      // Fallback graceful reply
      reply = "Desculpe, não consegui processar sua mensagem no momento. Nossa equipe de IA está temporariamente indisponível. Tente novamente em alguns minutos.";
      aiProvider = "fallback";
      aiModel = "none";
    }

    // Save assistant reply with extended metadata
    await db.insert(chatMessages).values({
      conversationId: convId,
      role: "assistant",
      content: reply,
      agentId,
      metadata: { 
        aiModel, 
        aiProvider, 
        aiError: aiError || null,
        timestamp: new Date().toISOString()
      },
    });

    // Update conversation title if first message
    if (!conversationId) {
      await db.update(chatConversations)
        .set({ title: message.slice(0, 100), updatedAt: new Date() })
        .where(eq(chatConversations.id, convId));
    }

    return Response.json({ 
      conversationId: convId, 
      reply, 
      agentId, 
      aiModel, 
      aiProvider,
      success: !aiError,
      aiError: aiError || null
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CHAT:UNHANDLED_ERROR] error="${errorMessage}" stack="${error instanceof Error ? error.stack : 'N/A'}"}`);
    
    // Check for specific DB errors
    if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
      return jsonApiError(
        "DB_SCHEMA_MISSING",
        "As tabelas de chat não estão disponíveis. Execute as migrações do banco de dados.",
        { status: 500 },
        { details: { hint: "Run: npm run db:push" } }
      );
    }
    
    if (errorMessage.includes("connect") || errorMessage.includes("ECONNREFUSED")) {
      return jsonApiError(
        "DB_CONNECTION_FAILED",
        "Não foi possível conectar ao banco de dados. Tente novamente em instantes.",
        { status: 503 }
      );
    }
    
    return jsonApiError(
      "INTERNAL_ERROR",
      "Não foi possível processar sua mensagem no momento. Verifique sua sessão e tente novamente.",
      { status: 500 },
      { details: { errorMessage } }
    );
  }
}

// GET: list conversations or messages
export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const url = new URL(request.url);
  const convId = url.searchParams.get("conversationId");

  if (convId) {
    // Get messages for a conversation
    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, convId))
      .orderBy(chatMessages.createdAt);
    return Response.json({ messages });
  }

  // List user conversations
  const conversations = await db.select().from(chatConversations)
    .where(eq(chatConversations.userId, user.id))
    .orderBy(desc(chatConversations.updatedAt))
    .limit(20);

  return Response.json({ conversations });
}
