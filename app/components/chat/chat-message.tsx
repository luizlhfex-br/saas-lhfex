import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  agentId?: string | null;
  timestamp?: string;
}

const agentEmojis: Record<string, string> = {
  airton: "🎯",
  iana: "📦",
  maria: "💰",
  iago: "🔧",
};

const agentNames: Record<string, string> = {
  airton: "AIrton",
  iana: "IAna",
  maria: "marIA",
  iago: "IAgo",
};

export function ChatMessage({ role, content, agentId, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
        isUser
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
      }`}>
        {isUser ? <User className="h-4 w-4" /> : (
          agentId ? agentEmojis[agentId] || "🤖" : <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
        isUser
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
      }`}>
        {!isUser && agentId && (
          <p className="mb-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
            {agentNames[agentId] || agentId}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        {timestamp && (
          <p className={`mt-1 text-xs ${isUser ? "text-blue-200" : "text-gray-400 dark:text-gray-500"}`}>
            {new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator({ agentId }: { agentId?: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
        {agentId ? agentEmojis[agentId] || "🤖" : <Bot className="h-4 w-4" />}
      </div>
      <div className="rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
