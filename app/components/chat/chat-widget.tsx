import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, MessageSquare, ChevronDown, Zap } from "lucide-react";
import { ChatMessage, TypingIndicator } from "./chat-message";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId?: string | null;
  timestamp?: string;
}

type ReasoningEffort = "1x" | "3x" | "auto";

const agents = [
  { id: "airton", name: "AIrton", emoji: "🎯", desc: "Maestro LHFEX" },
  { id: "iana", name: "IAna", emoji: "📦", desc: "Comércio Exterior" },
  { id: "maria", name: "marIA", emoji: "💰", desc: "Finanças" },
  { id: "iago", name: "IAgo", emoji: "🔧", desc: "Infraestrutura" },
];

const reasoningModes: { value: ReasoningEffort; label: string; desc: string; icon: string }[] = [
  { value: "1x", label: "Rápido (1x)", desc: "Respostas rápidas com raciocínio básico", icon: "⚡" },
  { value: "auto", label: "Auto", desc: "Ajusta automaticamente conforme a complexidade", icon: "🎯" },
  { value: "3x", label: "Profundo (3x)", desc: "Análise detalhada com raciocínio extendido", icon: "🧠" },
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(agents[0]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("auto");
  const [showReasoningSelector, setShowReasoningSelector] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
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
        body: JSON.stringify({
          message: userMessage.content,
          agentId: selectedAgent.id,
          conversationId,
          reasoningEffort,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConversationId(data.conversationId);

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          agentId: data.agentId,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Desculpe, ocorreu um erro. Tente novamente.",
            agentId: selectedAgent.id,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Erro de conexão. Verifique sua internet e tente novamente.",
          agentId: selectedAgent.id,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  const handleAgentChange = (agent: typeof agents[0]) => {
    setSelectedAgent(agent);
    setShowAgentSelector(false);
    handleNewChat();
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:scale-105 active:scale-95"
          aria-label="Abrir chat"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat popup */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              {/* Agent selector */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowAgentSelector(!showAgentSelector);
                    setShowReasoningSelector(false);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  <span className="text-lg">{selectedAgent.emoji}</span>
                  <span>{selectedAgent.name}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {showAgentSelector && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800 z-10">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => handleAgentChange(agent)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          selectedAgent.id === agent.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <span className="text-lg">{agent.emoji}</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{agent.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{agent.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reasoning effort selector */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowReasoningSelector(!showReasoningSelector);
                    setShowAgentSelector(false);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                  title="Modo de raciocínio da IA"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{reasoningModes.find(m => m.value === reasoningEffort)?.icon}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {showReasoningSelector && (
                  <div className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800 z-10">
                    {reasoningModes.map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => {
                          setReasoningEffort(mode.value);
                          setShowReasoningSelector(false);
                        }}
                        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          reasoningEffort === mode.value ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <span className="text-lg mt-0.5">{mode.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{mode.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{mode.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleNewChat}
                className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                title="Nova conversa"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Fechar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="mb-3 text-4xl">{selectedAgent.emoji}</div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedAgent.name}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {selectedAgent.desc}
                </p>
                <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                  Digite uma mensagem para começar...
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                agentId={msg.agentId}
                timestamp={msg.timestamp}
              />
            ))}

            {isLoading && <TypingIndicator agentId={selectedAgent.id} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
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
                placeholder={`Pergunte ao ${selectedAgent.name}...`}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-800"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
