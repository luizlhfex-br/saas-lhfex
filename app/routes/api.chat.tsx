import type { Route } from "./+types/api.chat";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { chatConversations, chatMessages } from "drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { chatMessageSchema } from "~/lib/validators";
import { askAgent } from "~/lib/ai.server";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  // Rate limiting — 20 messages per minute per user
  const rateCheck = checkRateLimit(`chat:${user.id}`, RATE_LIMITS.chatApi.maxAttempts, RATE_LIMITS.chatApi.windowMs);
  if (!rateCheck.allowed) {
    return Response.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
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

  // Call AI agent (OpenRouter → DeepSeek fallback)
  let reply: string;
  let aiModel = "unknown";
  let aiProvider = "none";

  try {
    const aiResponse = await askAgent(agentId, message.trim(), user.id);
    reply = aiResponse.content;
    aiModel = aiResponse.model;
    aiProvider = aiResponse.provider;
  } catch (error) {
    console.error("[CHAT] AI error:", error);
    reply = "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.";
  }

  // Save assistant reply
  await db.insert(chatMessages).values({
    conversationId: convId,
    role: "assistant",
    content: reply,
    agentId,
    metadata: { aiModel, aiProvider },
  });

  // Update conversation title if first message
  if (!conversationId) {
    await db.update(chatConversations)
      .set({ title: message.slice(0, 100), updatedAt: new Date() })
      .where(eq(chatConversations.id, convId));
  }

  return Response.json({ conversationId: convId, reply, agentId, aiModel, aiProvider });
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
