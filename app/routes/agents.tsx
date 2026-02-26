import { useState, useRef, useEffect } from "react";
import type { Route } from "./+types/agents";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { chatConversations, missionControlTasks, openclawCrons } from "drizzle/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { t, type Locale } from "~/i18n";
import {
  Bot,
  Send,
  MessageSquare,
  Plus,
  Clock,
  ArrowLeft,
  Sparkles,
  Target,
  Timer,
  Brain,
  ChevronRight,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Zap,
  CheckCircle2,
  CircleDot,
  AlertCircle,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { Link, useFetcher } from "react-router";
import { ChatMessage, TypingIndicator } from "~/components/chat/chat-message";
import { data } from "react-router";

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

const MC_COLUMNS = [
  { id: "inbox", label: "Inbox", icon: Inbox, color: "text-gray-500" },
  { id: "todo", label: "Todo", icon: CircleDot, color: "text-blue-500" },
  { id: "in_progress", label: "Em Progresso", icon: RefreshCw, color: "text-amber-500" },
  { id: "review", label: "Revisão", icon: AlertCircle, color: "text-purple-500" },
  { id: "done", label: "Concluído", icon: CheckCircle2, color: "text-green-500" },
  { id: "blocked", label: "Bloqueado", icon: AlertCircle, color: "text-red-500" },
] as const;

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-gray-100 text-gray-500",
  openclaw: "bg-rose-100 text-rose-600",
  airton: "bg-blue-100 text-blue-600",
  maria: "bg-amber-100 text-amber-600",
  iana: "bg-green-100 text-green-600",
};

interface MessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId?: string | null;
  timestamp?: string;
}

type MCTask = {
  id: string;
  title: string;
  description: string | null;
  column: string;
  priority: string;
  source: string;
  sourceAgent: string | null;
  notes: string | null;
  createdAt: Date;
};

type CronRow = {
  id: string;
  name: string;
  schedule: string;
  message: string;
  channel: string;
  enabled: boolean;
  lastRunAt: Date | null;
  lastRunResult: string | null;
  recentLogs: Array<{ timestamp: string; result: string; notes?: string }> | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const cookieHeader = request.headers.get("cookie") || "";
  const localeMatch = cookieHeader.match(/locale=([^;]+)/);
  const locale = (localeMatch ? localeMatch[1] : user.locale) as Locale;

  const [conversations, tasks, crons] = await Promise.all([
    db
      .select({
        id: chatConversations.id,
        agentId: chatConversations.agentId,
        title: chatConversations.title,
        updatedAt: chatConversations.updatedAt,
      })
      .from(chatConversations)
      .where(eq(chatConversations.userId, user.id))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(20),

    db
      .select()
      .from(missionControlTasks)
      .where(and(eq(missionControlTasks.userId, user.id), isNull(missionControlTasks.deletedAt)))
      .orderBy(desc(missionControlTasks.createdAt)),

    db.select().from(openclawCrons).orderBy(openclawCrons.name),
  ]);

  return {
    user: { id: user.id, name: user.name, email: user.email, locale: user.locale, theme: user.theme },
    locale,
    conversations,
    tasks,
    crons,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // Mission Control actions
  if (intent === "create_task") {
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;
    const priority = (formData.get("priority") as string) || "medium";
    const column = (formData.get("column") as string) || "todo";
    if (!title) return data({ error: "Título obrigatório" });

    await db.insert(missionControlTasks).values({
      userId: user.id,
      title,
      description,
      priority: priority as "low" | "medium" | "high" | "urgent",
      column,
      source: "manual",
    });
    return data({ success: true });
  }

  if (intent === "move_task") {
    const taskId = formData.get("taskId") as string;
    const column = formData.get("column") as string;
    await db
      .update(missionControlTasks)
      .set({ column, updatedAt: new Date(), ...(column === "done" ? { completedAt: new Date() } : {}) })
      .where(eq(missionControlTasks.id, taskId));
    return data({ success: true });
  }

  if (intent === "delete_task") {
    const taskId = formData.get("taskId") as string;
    await db
      .update(missionControlTasks)
      .set({ deletedAt: new Date() })
      .where(eq(missionControlTasks.id, taskId));
    return data({ success: true });
  }

  // Cron actions
  if (intent === "create_cron") {
    const name = formData.get("name") as string;
    const schedule = formData.get("schedule") as string;
    const message = formData.get("message") as string;
    const channel = (formData.get("channel") as string) || "telegram";
    if (!name || !schedule || !message) return data({ error: "Campos obrigatórios faltando" });

    await db.insert(openclawCrons).values({ name, schedule, message, channel });
    return data({ success: true });
  }

  if (intent === "toggle_cron") {
    const cronId = formData.get("cronId") as string;
    const enabled = formData.get("enabled") === "true";
    await db.update(openclawCrons).set({ enabled }).where(eq(openclawCrons.id, cronId));
    return data({ success: true });
  }

  if (intent === "delete_cron") {
    const cronId = formData.get("cronId") as string;
    await db.delete(openclawCrons).where(eq(openclawCrons.id, cronId));
    return data({ success: true });
  }

  return data({ error: "Unknown intent" });
}

export default function AgentsPage({ loaderData }: Route.ComponentProps) {
  const { user, locale, conversations, tasks, crons } = loaderData;
  const i18n = t(locale);
  const fetcher = useFetcher();

  const [activeTab, setActiveTab] = useState<"agents" | "mission" | "crons" | "knowledge">("agents");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // New task form state
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskColumn, setNewTaskColumn] = useState("todo");

  // New cron form state
  const [showNewCron, setShowNewCron] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (activeAgent && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeAgent]);

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
        let errorMessage = "Não foi possível processar sua mensagem agora. Tente novamente.";
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
        <p className="text-sm text-gray-500 dark:text-gray-400">Agentes de IA + Mission Control + Crons</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
        {[
          { id: "agents" as const, label: "Agentes", icon: Bot },
          { id: "mission" as const, label: "Mission Control", icon: Target },
          { id: "crons" as const, label: "Crons", icon: Timer },
          { id: "knowledge" as const, label: "Conhecimento IA", icon: Brain },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
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

      {/* ── MISSION CONTROL TAB ─────────────────────────────────────────────── */}
      {activeTab === "mission" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mission Control 🎯</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Kanban compartilhado com o OpenClaw</p>
            </div>
            <button
              onClick={() => setShowNewTask(!showNewTask)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nova tarefa
            </button>
          </div>

          {showNewTask && (
            <fetcher.Form method="post" onSubmit={() => setShowNewTask(false)} className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20 space-y-3">
              <input type="hidden" name="intent" value="create_task" />
              <input
                name="title"
                placeholder="Título da tarefa"
                required
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <textarea
                name="description"
                placeholder="Descrição (opcional)"
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="flex gap-3">
                <select name="priority" defaultValue="medium" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
                <select name="column" defaultValue="todo" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {MC_COLUMNS.filter((c) => c.id !== "done").map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <button type="submit" className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Criar
                </button>
              </div>
            </fetcher.Form>
          )}

          {/* Kanban */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {MC_COLUMNS.map((col) => {
              const Icon = col.icon;
              const colTasks = (tasks as MCTask[]).filter((t) => t.column === col.id);
              return (
                <div key={col.id} className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
                  <div className="flex items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-800">
                    <Icon className={`h-4 w-4 ${col.color}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{col.label}</span>
                    <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-2 min-h-[80px]">
                    {colTasks.map((task) => (
                      <div key={task.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">{task.title}</p>
                          <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="delete_task" />
                            <input type="hidden" name="taskId" value={task.id} />
                            <button type="submit" className="shrink-0 text-gray-300 hover:text-red-500 dark:text-gray-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </fetcher.Form>
                        </div>
                        {task.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{task.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                            {task.priority}
                          </span>
                          {task.source !== "manual" && (
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SOURCE_COLORS[task.source] || SOURCE_COLORS.manual}`}>
                              {task.source}
                            </span>
                          )}
                        </div>
                        {/* Move buttons */}
                        <div className="mt-2 flex gap-1">
                          {MC_COLUMNS.filter((c) => c.id !== col.id).slice(0, 2).map((dest) => (
                            <fetcher.Form key={dest.id} method="post">
                              <input type="hidden" name="intent" value="move_task" />
                              <input type="hidden" name="taskId" value={task.id} />
                              <input type="hidden" name="column" value={dest.id} />
                              <button
                                type="submit"
                                title={`Mover para ${dest.label}`}
                                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                              >
                                <ChevronRight className="h-3 w-3" />
                                {dest.label}
                              </button>
                            </fetcher.Form>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CRONS TAB ────────────────────────────────────────────────────────── */}
      {activeTab === "crons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Crons OpenClaw ⏰</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tarefas agendadas do openclaw.ai</p>
            </div>
            <button
              onClick={() => setShowNewCron(!showNewCron)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Novo cron
            </button>
          </div>

          {showNewCron && (
            <fetcher.Form method="post" onSubmit={() => setShowNewCron(false)} className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20 space-y-3">
              <input type="hidden" name="intent" value="create_cron" />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="name"
                  placeholder="Nome (ex: weekly_report)"
                  required
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <input
                  name="schedule"
                  placeholder="Schedule (ex: 0 8 * * *)"
                  required
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <textarea
                name="message"
                placeholder="Mensagem/instrução para o OpenClaw"
                required
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="flex items-center gap-3">
                <select name="channel" defaultValue="telegram" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  <option value="telegram">Telegram</option>
                  <option value="slack">Slack</option>
                </select>
                <button type="submit" className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Criar
                </button>
              </div>
            </fetcher.Form>
          )}

          <div className="space-y-3">
            {(crons as CronRow[]).length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
                <Timer className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nenhum cron cadastrado ainda.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Os crons do openclaw.json aparecem aqui após a primeira execução.</p>
              </div>
            )}
            {(crons as CronRow[]).map((cron) => {
              const statusColor = !cron.lastRunAt
                ? "bg-gray-200 dark:bg-gray-700"
                : cron.lastRunResult === "ok"
                  ? "bg-green-500"
                  : "bg-red-500";

              return (
                <div key={cron.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{cron.name}</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {cron.schedule}
                        </span>
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          {cron.channel}
                        </span>
                        {!cron.enabled && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800">desativado</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{cron.message}</p>
                      {cron.lastRunAt && (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Última execução: {new Date(cron.lastRunAt).toLocaleString("pt-BR")}
                          {cron.lastRunResult && ` — ${cron.lastRunResult}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="toggle_cron" />
                        <input type="hidden" name="cronId" value={cron.id} />
                        <input type="hidden" name="enabled" value={String(!cron.enabled)} />
                        <button type="submit" title={cron.enabled ? "Desativar" : "Ativar"} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800">
                          {cron.enabled ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                      </fetcher.Form>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="delete_cron" />
                        <input type="hidden" name="cronId" value={cron.id} />
                        <button type="submit" title="Excluir" className="rounded p-1.5 text-gray-300 hover:bg-gray-100 hover:text-red-500 dark:text-gray-600 dark:hover:bg-gray-800">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </fetcher.Form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

          {/* Crons summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2">
              <Timer className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Crons Padrão (openclaw.json)</h3>
            </div>
            <div className="space-y-2">
              {[
                { name: "heartbeat", schedule: "*/15 * * * *", desc: "Verifica WORKING.md + @mentions + urgências", model: "gemini-flash-lite" },
                { name: "morning_brief", schedule: "0 8 * * *", desc: "Standup matinal + briefing completo", channel: "telegram" },
                { name: "process_alerts", schedule: "0 18 * * 1-5", desc: "Alertas de processos inativos e vencimentos", channel: "telegram" },
                { name: "api_limits_check", schedule: "0 12 * * *", desc: "Checa limites de API (notifica se < 20%)", channel: "telegram" },
              ].map((c) => (
                <div key={c.name} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                  <span className="w-32 shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">{c.schedule}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">— {c.desc}</span>
                  </div>
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
