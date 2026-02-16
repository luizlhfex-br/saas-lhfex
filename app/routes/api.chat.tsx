import type { Route } from "./+types/api.chat";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { chatConversations, chatMessages } from "drizzle/schema";
import { eq, desc } from "drizzle-orm";

const MOCK_REPLIES: Record<string, string> = {
  airton: "Olá! Sou o AIrton, maestro da LHFEX. 🎯 No momento estou em modo de configuração. Em breve estarei totalmente disponível para orquestrar suas operações de comércio exterior. Fique tranquilo que sua equipe está trabalhando nisso!",
  iana: "Oi! Sou a IAna, especialista em comércio exterior. 📦 Estou sendo configurada e em breve poderei ajudar com classificação NCM, descrições blindadas, análise de processos e muito mais. Aguarde novidades!",
  maria: "Olá! Sou a marIA, responsável pelas finanças. 💰 Em breve poderei ajudar com controle financeiro, análise de custos, projeções de câmbio e planejamento tributário. Estamos quase lá!",
  iago: "E aí! Sou o IAgo, cuido da infra. 🔧 Logo estarei monitorando servidores, workflows do N8N e garantindo que tudo funcione perfeitamente. Automação total em breve!",
};

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);

  const body = await request.json();
  const { message, agentId, conversationId } = body as {
    message: string;
    agentId: string;
    conversationId?: string;
  };

  if (!message?.trim() || !agentId) {
    return Response.json({ error: "Missing message or agentId" }, { status: 400 });
  }

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

  // Try N8N webhook
  let reply = MOCK_REPLIES[agentId] || MOCK_REPLIES.airton;
  let fromN8N = false;

  const webhookUrl = process.env.N8N_CHAT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          agentId,
          userId: user.id,
          userName: user.name,
          conversationId: convId,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply || data.output || data.message || data.text) {
          reply = data.reply || data.output || data.message || data.text;
          fromN8N = true;
        }
      }
    } catch (error) {
      console.error("[CHAT] N8N webhook error:", error);
    }
  }

  // Save assistant reply
  await db.insert(chatMessages).values({
    conversationId: convId,
    role: "assistant",
    content: reply,
    agentId,
    metadata: { fromN8N },
  });

  // Update conversation title if first message
  if (!conversationId) {
    await db.update(chatConversations)
      .set({ title: message.slice(0, 100), updatedAt: new Date() })
      .where(eq(chatConversations.id, convId));
  }

  return Response.json({ conversationId: convId, reply, agentId, fromN8N });
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
