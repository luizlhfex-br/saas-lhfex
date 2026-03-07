import { useState, useRef, useEffect } from "react";
import type { Route } from "./+types/agents";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { chatConversations } from "drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import {
  Bot,
  Send,
  MessageSquare,
  Plus,
  Clock,
  ArrowLeft,
  Sparkles,
  Brain,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { ChatMessage, TypingIndicator } from "~/components/chat/chat-message";

const agents = [
  {
    id: "airton",
    name: "AIrton",
    emoji: "🎯",
    role: "Maestro LHFEX",
    description: "Orquestra todas as operações de comércio exterior. Coordena os demais agentes e oferece visão estratégica.",
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "iana",
    name: "IAna",
    emoji: "📦",
    role: "Especialista Comex",
    description: "Classificação NCM, descrições blindadas, análise de processos, documentação e compliance aduaneiro.",
    color: "from-green-500 to-emerald-500",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
  },
  {
    id: "maria",
    name: "marIA",
    emoji: "💰",
    role: "Gestora Financeira",
    description: "Controle financeiro, análise de custos, projeções de câmbio, planejamento tributário e DRE.",
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
  {
    id: "iago",
    name: "IAgo",
    emoji: "🔧",
    role: "Engenheiro de Infra",
    description: "Monitoramento de servidores, automações backend, integrações e manutenção do sistema.",
    color: "from-purple-500 to-violet-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    emoji: "🦞",
    role: "Assistente Vida Pessoal",
    description: "Responsável por toda a aba Vida Pessoal — promoções, sorteios, rotinas, finanças pessoais, radio monitor e objetivos pessoais.",
    color: "from-rose-500 to-pink-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
];


interface MessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId?: string | null;
  timestamp?: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

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
    user: { id: user.id, name: user.name, email: user.email, locale: user.locale, theme: user.theme },
    locale,
    conversations,
  };
}

export async function action() {
  return null;
}

export default function AgentsPage({ loaderData }: Route.ComponentProps) {
  const { user, locale, conversations } = loaderData;
  const i18n = t(locale);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "knowledge" ? "knowledge" : "agents";

  const [activeTab, setActiveTab] = useState<"agents" | "knowledge">(initialTab);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (activeAgent && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeAgent]);

  useEffect(() => {
    if (searchParams.get("tab") === "knowledge") {
      setActiveTab("knowledge");
    }
  }, [searchParams]);

  const handleStartChat = (agentId: string) => {
    setActiveAgent(agentId);
    setMessages([]);
    setConversationId(null);
  };

  const handleLoadConversation = async (convId: string, agentId: string) => {
    setActiveAgent(agentId);
    setConversationId(convId);
    try {
      const res = await fetch(`/api/chat?conversationId=${convId}`);
      if (res.ok) {
        const d = await res.json();
        setMessages(
          d.messages.map((m: { id: string; role: "user" | "assistant"; content: string; agentId?: string; createdAt?: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            agentId: m.agentId,
            timestamp: m.createdAt,
          })),
        );
      }
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeAgent) return;

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
          const ep = await res.json();
          if (typeof ep?.error === "string" && ep.error.trim()) errorMessage = ep.error;
        } catch { /* ignore */ }
        setMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, role: "assistant", content: errorMessage, agentId: activeAgent, timestamp: new Date().toISOString() },
        ]);
        return;
      }

      const d = await res.json();
      setConversationId(d.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", content: d.reply, agentId: d.agentId, timestamp: new Date().toISOString() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente.", agentId: activeAgent, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const agent = agents.find((a) => a.id === activeAgent);
  const agentEmojis: Record<string, string> = { airton: "🎯", iana: "📦", maria: "💰", iago: "🔧" };
  const agentNames: Record<string, string> = { airton: "AIrton", iana: "IAna", maria: "marIA", iago: "IAgo" };

  // Chat view
  if (activeAgent && agent) {
    return (
      <div className="flex h-[calc(100vh-7rem)] flex-col">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
          <button
            onClick={() => setActiveAgent(null)}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-2xl">{agent.emoji}</span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{agent.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{agent.role}</p>
          </div>
          <button
            onClick={() => { setMessages([]); setConversationId(null); }}
            className="ml-auto flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="mb-4 text-5xl">{agent.emoji}</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{agent.name}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{agent.description}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {activeAgent === "airton" && (
                  <>
                    <SuggestionChip text="Como está o status dos meus processos?" onClick={(t) => setInput(t)} />
                    <SuggestionChip text="Quais alertas preciso verificar?" onClick={(t) => setInput(t)} />
                  </>
                )}
                {activeAgent === "iana" && (
                  <>
                    <SuggestionChip text="Qual NCM para peças automotivas?" onClick={(t) => setInput(t)} />
                    <SuggestionChip text="Preciso de uma descrição blindada" onClick={(t) => setInput(t)} />
                  </>
                )}
                {activeAgent === "maria" && (
                  <>
                    <SuggestionChip text="Qual a cotação do dólar hoje?" onClick={(t) => setInput(t)} />
                    <SuggestionChip text="Resumo financeiro do mês" onClick={(t) => setInput(t)} />
                  </>
                )}
                {activeAgent === "iago" && (
                  <>
                    <SuggestionChip text="Status dos servidores" onClick={(t) => setInput(t)} />
                    <SuggestionChip text="Status das automações backend" onClick={(t) => setInput(t)} />
                  </>
                )}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} agentId={msg.agentId} timestamp={msg.timestamp} />
          ))}

          {isLoading && <TypingIndicator agentId={activeAgent} />}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Pergunte ao ${agent.name}...`}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-800"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
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

  // Tabs view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{i18n.nav.agents}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Agentes de IA e base de conhecimento</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
        {[
          { id: "agents" as const, label: "Agentes", icon: Bot },
          { id: "knowledge" as const, label: "Conhecimento IA", icon: Brain },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
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

      {/* ── AGENTS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "agents" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Guia de prompts</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">5 princípios + templates prontos para melhorar a resposta dos agentes.</p>
                </div>
              </div>
              <Link to="/knowledge/prompting" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                Abrir guia
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => handleStartChat(a.id)}
                className={`group relative overflow-hidden rounded-xl border ${a.border} ${a.bg} p-6 text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${a.color}`} />
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{a.emoji}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{a.name}</h3>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{a.role}</p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{a.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Clique para conversar</span>
                </div>
              </button>
            ))}
          </div>

          {conversations.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conversas Recentes</h2>
              </div>
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleLoadConversation(conv.id, conv.agentId)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="text-lg">{agentEmojis[conv.agentId] || "🤖"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{conv.title || "Nova conversa"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {agentNames[conv.agentId] || conv.agentId} • {new Date(conv.updatedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ── KNOWLEDGE TAB ────────────────────────────────────────────────────── */}
      {activeTab === "knowledge" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conhecimento IA 🧠</h2>

          {/* Model hierarchy */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Hierarquia de Modelos</h3>
            </div>
            <div className="space-y-2">
              {[
                { rank: "1", label: "Gemini 2.0 Flash FREE", desc: "Linha de frente — texto, imagem, áudio", badge: "GRÁTIS", color: "text-green-600" },
                { rank: "2", label: "OpenRouter Free (:free)", desc: "Fallback leve — deepseek:free, gemini:free", badge: "GRÁTIS", color: "text-green-600" },
                { rank: "3", label: "DeepSeek V3.2 (direto)", desc: "$0.028/MTok cache hit — raciocínio complexo", badge: "$0.03/MTok", color: "text-blue-600" },
                { rank: "4", label: "OpenRouter Pago", desc: "Último recurso — limite $5/dia", badge: "PAGO", color: "text-amber-600" },
              ].map((m) => (
                <div key={m.rank} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {m.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</p>
                  </div>
                  <span className={`text-xs font-medium ${m.color}`}>{m.badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Skills Ativas (openclaw.ai)</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { slug: "qmd", desc: "90% economia tokens memória" },
                { slug: "web-search", desc: "Busca na web" },
                { slug: "file-ops", desc: "Lê/escreve workspace" },
                { slug: "reminders", desc: "Lembretes" },
              ].map((s) => (
                <div key={s.slug} className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 dark:border-green-800 dark:bg-green-900/20">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">{s.slug}</span>
                  <span className="text-xs text-green-600 dark:text-green-500">— {s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prompts */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Prompts Carregados</h3>
            </div>
            <div className="space-y-2">
              {[
                { file: "SOUL.md", desc: "Personalidade, valores, diretrizes comportamentais" },
                { file: "IDENTITY.md", desc: "Nome, timezone, idioma, assinatura" },
                { file: "USER.md", desc: "Perfil do usuário e preferências" },
                { file: "AGENTS.md", desc: "Manual de operação e protocolo de delegação" },
                { file: "WORKING.md", desc: "Estado vivo de tarefas (atualizado a cada heartbeat)" },
              ].map((p) => (
                <div key={p.file} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 rounded bg-gray-100 px-2 py-0.5 text-center text-xs font-mono font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {p.file}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{p.desc}</span>
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
      onClick={() => onClick(text)}
      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
    >
      {text}
    </button>
  );
}
