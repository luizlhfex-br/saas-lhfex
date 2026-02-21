import { useState, useRef, useEffect } from "react";
import { X, Send, MessageSquare, ChevronDown, RotateCcw, AlertCircle } from "lucide-react";
import { ChatMessage, TypingIndicator } from "./chat-message";
import { parseApiErrorResponse } from "~/lib/api-error";

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  agentId?: string | null;
  timestamp?: string;
  retryable?: boolean;
  errorCode?: string;
}

const agents = [
  { id: "airton", name: "AIrton", emoji: "🎯", desc: "Maestro LHFEX" },
  { id: "iana", name: "IAna", emoji: "📦", desc: "Comércio Exterior" },
  { id: "maria", name: "marIA", emoji: "💰", desc: "Finanças" },
  { id: "iago", name: "IAgo", emoji: "🔧", desc: "Infraestrutura" },
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(agents[0]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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

  const getApiErrorMessage = async (res: Response): Promise<{ message: string; retryable: boolean; code: string }> => {
    const apiError = await parseApiErrorResponse(res);

    if (res.status === 401) {
      return {
        message: "Sua sessão expirou. Faça login novamente para continuar.",
        retryable: false,
        code: "AUTH_EXPIRED"
      };
    }

    if (res.status === 429) {
      return {
        message: apiError?.error ?? "Você enviou muitas mensagens em pouco tempo. Aguarde alguns segundos e tente novamente.",
        retryable: true,
        code: "RATE_LIMITED"
      };
    }
    
    if (res.status === 503) {
      return {
        message: apiError?.error ?? "O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.",
        retryable: true,
        code: "AI_PROVIDER_UNAVAILABLE"
      };
    }

    if (res.status === 400) {
      const fieldErrors = apiError?.details as { fieldErrors?: Record<string, string[]> } | undefined;
      const hasConversationIdError = Boolean(fieldErrors?.fieldErrors?.conversationId?.length);
      if (hasConversationIdError) {
        setConversationId(null);
        return {
          message: "O identificador da conversa ficou inválido. Inicie uma nova conversa e tente novamente.",
          retryable: true,
          code: "INVALID_CONVERSATION"
        };
      }
      return {
        message: apiError?.error ?? "Não foi possível validar sua mensagem. Revise o conteúdo e tente novamente.",
        retryable: false,
        code: "INVALID_INPUT"
      };
    }
    
    if (res.status === 500) {
      return {
        message: apiError?.error ?? "Erro interno do servidor. Nossa equipe foi notificada. Tente novamente em instantes.",
        retryable: true,
        code: apiError?.code || "INTERNAL_ERROR"
      };
    }

    return {
      message: apiError?.error ?? "Desculpe, ocorreu um erro. Tente novamente.",
      retryable: true,
      code: "UNKNOWN_ERROR"
    };
  };

  const handleSend = async (retryMessage?: string) => {
    const messageToSend = retryMessage || input.trim();
    if (!messageToSend || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageToSend,
      timestamp: new Date().toISOString(),
    };

    // Only add user message if not retrying
    if (!retryMessage) {
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLastUserMessage(messageToSend);
    } else {
      // Remove last error message before retry
      setMessages((prev) => prev.filter((msg) => msg.role !== "error"));
    }
    
    setIsLoading(true);

    try {
      const payload: { message: string; agentId: string; conversationId?: string } = {
        message: messageToSend,
        agentId: selectedAgent.id,
      };

      if (conversationId) {
        payload.conversationId = conversationId;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setConversationId(data.conversationId);
        setRetryCount(0); // Reset retry count on success

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          agentId: data.agentId,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        
        // Show warning if AI had error but still returned fallback
        if (data.error) {
          console.warn(`[CHAT:WARNING] AI fallback used: ${data.error}`);
        }
      } else {
        const errorInfo = await getApiErrorMessage(res);
        setRetryCount((prev) => prev + 1);
        
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "error",
            content: errorInfo.message,
            agentId: selectedAgent.id,
            timestamp: new Date().toISOString(),
            retryable: errorInfo.retryable,
            errorCode: errorInfo.code,
          },
        ]);
      }
    } catch (error) {
      setRetryCount((prev) => prev + 1);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "error",
          content: "Erro de conexão. Verifique sua internet e tente novamente.",
          agentId: selectedAgent.id,
          timestamp: new Date().toISOString(),
          retryable: true,
          errorCode: "NETWORK_ERROR",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setLastUserMessage(null);
    setRetryCount(0);
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
                  onClick={() => setShowAgentSelector(!showAgentSelector)}
                  className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  <span className="text-lg">{selectedAgent.emoji}</span>
                  <span>{selectedAgent.name}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {showAgentSelector && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
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
              <div key={msg.id}>
                <ChatMessage
                  role={msg.role === "error" ? "assistant" : msg.role}
                  content={msg.content}
                  agentId={msg.agentId}
                  timestamp={msg.timestamp}
                />
                {msg.role === "error" && msg.retryable && lastUserMessage && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => void handleSend(lastUserMessage)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Tentar novamente
                    </button>
                    {retryCount > 2 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {retryCount} tentativas
                      </span>
                    )}
                  </div>
                )}
              </div>
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
                onClick={() => void handleSend()}
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
