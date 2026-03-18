import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/agents";
import { requireAuth } from "~/lib/auth.server";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { db } from "~/lib/db.server";
import { chatConversations } from "drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import { getOpenClawOverview } from "~/lib/openclaw-overview.server";
import { getOpenClawObservabilitySnapshot } from "~/lib/openclaw-observability.server";
import {
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { ChatMessage, TypingIndicator } from "~/components/chat/chat-message";

const chatAgents = [
  {
    id: "airton",
    name: "AIrton",
    emoji: "🎯",
    role: "Maestro LHFEX",
    description: "Orquestra as operacoes de comercio exterior e faz leitura estrategica do contexto.",
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "iana",
    name: "IAna",
    emoji: "📦",
    role: "Especialista Comex",
    description: "NCM, descricao blindada, DI, DUIMP, Incoterms e compliance aduaneiro.",
    color: "from-green-500 to-emerald-500",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
  },
  {
    id: "maria",
    name: "marIA",
    emoji: "💰",
    role: "Gestora Financeira",
    description: "Cambio, custos, DRE, fluxo de caixa e leitura financeira das operacoes.",
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
  {
    id: "iago",
    name: "IAgo",
    emoji: "🔧",
    role: "Engenheiro de Infra",
    description: "Servidor, Docker, Coolify, automacoes backend e diagnostico de runtime.",
    color: "from-purple-500 to-violet-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    emoji: "🦞",
    role: "Vida Pessoal",
    description: "Promocoes, sorteios, rotinas, objetivos e operacao pessoal no Telegram.",
    color: "from-rose-500 to-pink-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
];

type MessageData = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId?: string | null;
  timestamp?: string;
};

const modelLabels: Record<string, { label: string; badge: string; badgeClass: string; description: string }> = {
  "vertex/gemini-2.0-flash": {
    label: "Vertex Gemini 2.0 Flash",
    badge: "PRIMARIO",
    badgeClass: "text-fuchsia-600",
    description: "Cadeia principal do gateway via Vertex AI.",
  },
  "openrouter/free": {
    label: "OpenRouter Free Router",
    badge: "FREE",
    badgeClass: "text-sky-600",
    description: "Roteador gratuito da OpenRouter, com selecao automatica do modelo disponivel.",
  },
  "openrouter/meta-llama/llama-3.3-70b-instruct:free": {
    label: "Llama 3.3 70B Free",
    badge: "FREE",
    badgeClass: "text-blue-600",
    description: "Fallback gratuito adicional para consultas gerais.",
  },
  "openrouter/deepseek/deepseek-r1-distill-llama-70b:free": {
    label: "DeepSeek R1 Distill Free",
    badge: "FREE",
    badgeClass: "text-cyan-600",
    description: "Fallback gratuito focado em raciocinio.",
  },
  "deepseek/deepseek-chat": {
    label: "DeepSeek Direct",
    badge: "DIRECT",
    badgeClass: "text-orange-600",
    description: "Ultimo recurso direto na API da DeepSeek.",
  },
};

const promptFiles = [
  { file: "agents.catalog.json", desc: "Catalogo versionado do squad com dominio, tools, permissoes, gatilhos e KPIs." },
  { file: "SOUL.md", desc: "Personalidade, autonomia, seguranca e escopo do gateway." },
  { file: "IDENTITY.md", desc: "Nome, funcao, timezone e idioma de cada agente." },
  { file: "USER.md", desc: "Perfil, preferencia e tom operacional do usuario." },
  { file: "AGENTS.md", desc: "Manual de delegacao entre especialistas e regras do projeto." },
  { file: "README.md", desc: "Missao, escopo, entregas esperadas e fora de escopo de cada agente." },
  { file: "HEARTBEAT.md", desc: "Checklist recorrente para saude, escalacao e auto-revisao do agente." },
  { file: "WORKING.md", desc: "Estado vivo da sessao e memoria recente do gateway." },
];

function getSuggestionTexts(agentId: string) {
  switch (agentId) {
    case "airton":
      return ["Resuma os gargalos atuais do SaaS", "Me diga o proximo risco tecnico real", "Organize este problema em etapas"];
    case "iana":
      return ["Revise esta descricao blindada", "Explique o impacto deste Incoterm", "Monte um checklist DUIMP"];
    case "maria":
      return ["Analise custo total desta operacao", "Compare impacto cambial de USD x EUR", "Resuma o DRE do mes"];
    case "iago":
      return ["Cheque o risco do ultimo deploy", "Liste o que pode quebrar em producao", "Sugira hardening da infra"];
    default:
      return ["Resumo das minhas promocoes", "Organize minhas proximas acoes", "Me lembre do que esta vencendo"];
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const companyId = await getPrimaryCompanyId(user.id);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const conversations = await db
    .select({
      id: chatConversations.id,
      agentId: chatConversations.agentId,
      title: chatConversations.title,
      updatedAt: chatConversations.updatedAt,
    })
    .from(chatConversations)
    .where(eq(chatConversations.userId, user.id))
    .orderBy(desc(chatConversations.updatedAt))
    .limit(20);

  return {
    locale,
    conversations,
    openClawOverview: await getOpenClawOverview(),
    openClawObservability: await getOpenClawObservabilitySnapshot(companyId),
  };
}

export async function action() {
  return null;
}

export default function AgentsPage({ loaderData }: Route.ComponentProps) {
  const { locale, conversations, openClawOverview, openClawObservability } = loaderData;
  const i18n = t(locale);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"agents" | "knowledge">(
    searchParams.get("tab") === "knowledge" ? "knowledge" : "agents"
  );
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const modelChain = useMemo(
    () => [openClawOverview.primaryModel, ...openClawOverview.fallbackModels].filter(Boolean),
    [openClawOverview.fallbackModels, openClawOverview.primaryModel]
  );
  const agentLabelById = useMemo(
    () => Object.fromEntries(openClawOverview.agents.map((entry) => [entry.id, `${entry.emoji} ${entry.name}`])),
    [openClawOverview.agents]
  );
  const chatAgentLookup = useMemo(
    () => Object.fromEntries(chatAgents.map((agent) => [agent.id, agent])),
    []
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (activeAgent) {
      inputRef.current?.focus();
    }
  }, [activeAgent]);

  useEffect(() => {
    if (searchParams.get("tab") === "knowledge") {
      setActiveTab("knowledge");
    }
  }, [searchParams]);

  const selectedAgent = activeAgent ? chatAgentLookup[activeAgent] ?? null : null;

  const handleStartChat = (agentId: string) => {
    setActiveAgent(agentId);
    setMessages([]);
    setConversationId(null);
  };

  const handleLoadConversation = async (convId: string, agentId: string | null) => {
    if (!agentId) return;

    setActiveAgent(agentId);
    setConversationId(convId);

    try {
      const res = await fetch(`/api/chat?conversationId=${convId}`);
      if (!res.ok) return;

      const payload = await res.json();
      setMessages(
        payload.messages.map(
          (message: { id: string; role: "user" | "assistant"; content: string; agentId?: string; createdAt?: string }) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            agentId: message.agentId,
            timestamp: message.createdAt,
          })
        )
      );
    } catch {
      // Keep previous state untouched if fetching chat history fails.
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeAgent || isLoading) return;

    const userMessage: MessageData = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content, agentId: activeAgent, conversationId }),
      });

      if (!res.ok) {
        let errorMessage = "Nao foi possivel processar sua mensagem agora. Tente novamente.";
        try {
          const payload = await res.json();
          if (typeof payload?.error === "string" && payload.error.trim()) {
            errorMessage = payload.error;
          }
        } catch {
          // Fall back to generic error.
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: errorMessage,
            agentId: activeAgent,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      const payload = await res.json();
      setConversationId(payload.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.reply,
          agentId: payload.agentId,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Desculpe, ocorreu um erro. Tente novamente.",
          agentId: activeAgent,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedAgent) {
    const suggestionTexts = getSuggestionTexts(selectedAgent.id);

    return (
      <div className="flex h-[calc(100vh-7rem)] flex-col">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveAgent(null)}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-2xl">{selectedAgent.emoji}</span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedAgent.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{selectedAgent.role}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setConversationId(null);
            }}
            className="ml-auto flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="mb-4 text-5xl">{selectedAgent.emoji}</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedAgent.name}</h3>
              <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">{selectedAgent.description}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {suggestionTexts.map((text) => (
                  <SuggestionChip key={text} text={text} onClick={setInput} />
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              agentId={message.agentId}
              timestamp={message.timestamp}
            />
          ))}

          {isLoading ? <TypingIndicator agentId={selectedAgent.id} /> : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={`Pergunte ao ${selectedAgent.name}...`}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-800"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || isLoading}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.nav.agents}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Agentes de IA e base operacional do OpenClaw.</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
        {[
          { id: "agents" as const, label: "Agentes", icon: Bot },
          { id: "knowledge" as const, label: "Conhecimento IA", icon: Brain },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setActiveTab(id);
              setSearchParams(id === "knowledge" ? { tab: "knowledge" } : {});
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {activeTab === "agents" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Guia de prompts</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">5 principios e templates prontos para conversar melhor com os agentes.</p>
                </div>
              </div>
              <Link to="/knowledge/prompting" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                Abrir guia
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {chatAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleStartChat(agent.id)}
                className={`group relative overflow-hidden rounded-xl border ${agent.border} ${agent.bg} p-6 text-left transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${agent.color}`} />
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{agent.emoji}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{agent.name}</h3>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{agent.role}</p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{agent.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Clique para conversar</span>
                </div>
              </button>
            ))}
          </div>

          {conversations.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conversas Recentes</h2>
              </div>
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleLoadConversation(conversation.id, conversation.agentId)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="text-lg">{chatAgentLookup[conversation.agentId ?? ""]?.emoji ?? "🤖"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{conversation.title || "Nova conversa"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {chatAgentLookup[conversation.agentId ?? ""]?.name ?? conversation.agentId ?? "Agente"} •{" "}
                        {new Date(conversation.updatedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conhecimento IA</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Agentes especialistas</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{openClawOverview.agents.length}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Lidos do openclaw.json, agents.catalog.json e prompts por agente.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Skills ativas</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{openClawOverview.skills.length}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Runtime + skills locais do gateway.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Provider primario</p>
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {modelLabels[openClawOverview.primaryModel]?.label ?? openClawOverview.primaryModel}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fallbacks declarados: {openClawOverview.fallbackModels.length}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Hierarquia de Modelos</h3>
            </div>
            <div className="space-y-2">
              {modelChain.map((modelId, index) => {
                const model = modelLabels[modelId] ?? {
                  label: modelId,
                  badge: index === 0 ? "PRIMARIO" : "FALLBACK",
                  badgeClass: index === 0 ? "text-fuchsia-600" : "text-slate-600",
                  description: "Modelo configurado no runtime do OpenClaw.",
                };

                return (
                  <div key={modelId} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{model.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{model.description}</p>
                    </div>
                    <span className={`text-xs font-medium ${model.badgeClass}`}>{model.badge}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Observabilidade OpenClaw</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Heartbeats</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{openClawObservability.heartbeatCounts.total}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {openClawObservability.heartbeatCounts.healthy} saudaveis, {openClawObservability.heartbeatCounts.degraded} degradados, {openClawObservability.heartbeatCounts.offline} offline
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Runs</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{openClawObservability.runCounts.total}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {openClawObservability.runCounts.running} em execucao, {openClawObservability.runCounts.success} sucesso, {openClawObservability.runCounts.error} erro
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Work items</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{openClawObservability.workItemCounts.total}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {openClawObservability.workItemCounts.inProgress} em progresso, {openClawObservability.workItemCounts.blocked} bloqueados, {openClawObservability.workItemCounts.done} prontos
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ultimos heartbeats</h4>
                <div className="mt-3 space-y-2">
                  {openClawObservability.latestHeartbeatsByAgent.slice(0, 6).map((heartbeat) => (
                    <div key={heartbeat.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{heartbeat.agentName || heartbeat.agentId}</p>
                        <p className="text-gray-500 dark:text-gray-400">{heartbeat.provider || "provider local"} • {heartbeat.model || "modelo nao informado"}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          heartbeat.status === "healthy"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : heartbeat.status === "degraded"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        }`}
                      >
                        {heartbeat.status}
                      </span>
                    </div>
                  ))}
                  {openClawObservability.latestHeartbeatsByAgent.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum heartbeat registrado ainda.</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Runs recentes</h4>
                <div className="mt-3 space-y-2">
                  {openClawObservability.recentRuns.slice(0, 5).map((run) => (
                    <div key={run.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{run.agentName || run.agentId}</p>
                        <p className="text-gray-500 dark:text-gray-400">{run.provider || "provider"} • {run.model || "modelo"}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          run.status === "success"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : run.status === "error"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                              : run.status === "running"
                                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                  ))}
                  {openClawObservability.recentRuns.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nenhuma run registrada ainda.</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Handoffs recentes</h4>
                <div className="mt-3 space-y-2">
                  {openClawObservability.recentHandoffs.slice(0, 5).map((handoff) => (
                    <div key={handoff.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{handoff.objective}</p>
                      <p className="mt-1 text-gray-500 dark:text-gray-400">
                        {handoff.fromAgentId || "OpenClaw"} → {handoff.toAgentId} • {handoff.status}
                      </p>
                    </div>
                  ))}
                  {openClawObservability.recentHandoffs.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum handoff registrado ainda.</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Work items ativos</h4>
                <div className="mt-3 space-y-2">
                  {openClawObservability.recentWorkItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                      <p className="mt-1 text-gray-500 dark:text-gray-400">
                        {item.agentId} • {item.priority} • {item.status}
                      </p>
                    </div>
                  ))}
                  {openClawObservability.recentWorkItems.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum work item registrado ainda.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Skills Ativas</h3>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {openClawOverview.skills.map((skill) => (
                <div key={skill.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{skill.label}</h4>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{skill.description}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {skill.type === "built-in" ? "runtime" : "local"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skill.alignedAgents.length > 0 ? (
                      skill.alignedAgents.map((agentId) => (
                        <span
                          key={`${skill.id}-${agentId}`}
                          className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300"
                        >
                          {agentLabelById[agentId] ?? agentId}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Sem alinhamento declarado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Agentes x Skills</h3>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {openClawOverview.agents.map((agentInfo) => (
                <div key={agentInfo.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{agentInfo.emoji}</span>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{agentInfo.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{agentInfo.role}</p>
                        {agentInfo.domain ? (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">{agentInfo.domain}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      {agentInfo.alignedSkills.length} skills
                    </span>
                  </div>
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    <div>Primario: {modelLabels[agentInfo.primaryModel]?.label ?? agentInfo.primaryModel}</div>
                    <div>Fallbacks: {agentInfo.fallbacks.length > 0 ? agentInfo.fallbacks.join(" -> ") : "sem fallback"}</div>
                  </div>
                  {agentInfo.purpose ? (
                    <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{agentInfo.purpose}</p>
                  ) : null}
                  {agentInfo.tools.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {agentInfo.tools.slice(0, 4).map((toolId) => (
                        <span
                          key={`${agentInfo.id}-tool-${toolId}`}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                        >
                          {toolId}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {agentInfo.alignedSkills.map((skillId) => {
                      const skill = openClawOverview.skills.find((entry) => entry.id === skillId);
                      return (
                        <span
                          key={`${agentInfo.id}-${skillId}`}
                          className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                        >
                          {skill?.label ?? skillId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Arquivos Operacionais</h3>
              </div>
            <div className="space-y-2">
              {promptFiles.map((prompt) => (
                <div key={prompt.file} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 rounded bg-gray-100 px-2 py-0.5 text-center text-xs font-mono font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {prompt.file}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{prompt.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionChip({ text, onClick }: { text: string; onClick: (text: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
    >
      {text}
    </button>
  );
}
