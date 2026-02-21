/**
 * Standardized AI Operation Types
 * 
 * Defines consistent interfaces for all AI-powered features:
 * - Chat
 * - NCM Classification
 * - Life Agent
 * - Document OCR
 * - CNPJ Enrichment
 */

export type AIFeature = 
  | "chat" 
  | "ncm_classification" 
  | "ocr" 
  | "enrichment" 
  | "telegram"
  | "life_agent";

export type AIProvider = 
  | "gemini" 
  | "openrouter_free" 
  | "openrouter_paid" 
  | "deepseek"
  | "fallback";

/**
 * Standardized AI Operation Result
 * All AI endpoints should return this structure
 */
export interface AIOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
  };
  metadata: {
    provider: AIProvider;
    model: string;
    tokensUsed?: number;
    latencyMs?: number;
    cost?: string;
    timestamp: string;
  };
}

/**
 * AI Input Validation Constraints
 * Shared limits across all AI features
 */
export const AI_CONSTRAINTS = {
  chat: {
    minLength: 1,
    maxLength: 5000,
    maxOutputTokens: 2000,
    timeoutMs: 30000,
  },
  ncm: {
    minLength: 5,
    maxLength: 5000,
    maxOutputTokens: 3000,
    timeoutMs: 45000,
  },
  life: {
    minLength: 5,
    maxLength: 3000,
    maxOutputTokens: 1200,
    timeoutMs: 30000,
  },
  ocr: {
    minLength: 10,
    maxLength: 50000,
    maxOutputTokens: 2000,
    timeoutMs: 60000,
  },
} as const;

/**
 * AI Error Codes
 * Standardized across all AI operations
 */
export const AI_ERROR_CODES = {
  PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
  PROVIDER_CONFIG_MISSING: "AI_PROVIDER_CONFIG_MISSING",
  RATE_LIMITED: "AI_RATE_LIMITED",
  INVALID_INPUT: "AI_INVALID_INPUT",
  TIMEOUT: "AI_TIMEOUT",
  CONTENT_FILTERED: "AI_CONTENT_FILTERED",
  INSUFFICIENT_QUOTA: "AI_INSUFFICIENT_QUOTA",
  INTERNAL_ERROR: "AI_INTERNAL_ERROR",
} as const;

/**
 * NCM Classification Specific Types
 */
export interface NCMClassificationData {
  ncm: string;
  description: string;
  justification: string;
  confidence?: "high" | "medium" | "low";
}

/**
 * Life Agent Task Result
 */
export interface LifeAgentTaskData {
  result: string;
  steps?: string[];
  estimatedTime?: string;
  priority?: "low" | "medium" | "high";
}

/**
 * Chat Message Data
 */
export interface ChatMessageData {
  conversationId: string;
  reply: string;
  agentId: string;
}

/**
 * Common AI Presets for Quick Access
 */
export const NCM_PRESETS = [
  {
    id: "empilhadeira",
    label: "Empilhadeira Elétrica",
    description: "Empilhadeira elétrica contrabalançada, autopropulsada, capacidade 2000kg",
    category: "Veículos e Equipamentos",
  },
  {
    id: "paleteira",
    label: "Paleteira Manual",
    description: "Paleteira manual hidráulica, capacidade 2500kg, rodas de poliuretano",
    category: "Veículos e Equipamentos",
  },
  {
    id: "celular",
    label: "Smartphone",
    description: "Telefone celular touchscreen, sistema Android, 128GB memória, câmera 64MP",
    category: "Eletrônicos",
  },
  {
    id: "notebook",
    label: "Notebook",
    description: "Computador portátil, processador Intel Core i7, 16GB RAM, SSD 512GB, tela 15.6\"",
    category: "Eletrônicos",
  },
  {
    id: "trator",
    label: "Trator Agrícola",
    description: "Trator agrícola de rodas, potência 75HP, tração 4x4, motor diesel",
    category: "Máquinas Agrícolas",
  },
] as const;

/**
 * Helper to build standardized AI error
 */
export function buildAIError(
  code: keyof typeof AI_ERROR_CODES,
  message: string,
  retryable: boolean,
  details?: unknown
): AIOperationResult["error"] {
  return {
    code: AI_ERROR_CODES[code],
    message,
    retryable,
    details,
  };
}

/**
 * Helper to build successful AI result
 */
export function buildAISuccess<T>(
  data: T,
  provider: AIProvider,
  model: string,
  tokensUsed?: number,
  latencyMs?: number,
  cost?: string
): AIOperationResult<T> {
  return {
    success: true,
    data,
    metadata: {
      provider,
      model,
      tokensUsed,
      latencyMs,
      cost,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Helper to build failed AI result
 */
export function buildAIFailure(
  error: AIOperationResult["error"],
  provider: AIProvider = "fallback",
  model: string = "none"
): AIOperationResult {
  return {
    success: false,
    error,
    metadata: {
      provider,
      model,
      timestamp: new Date().toISOString(),
    },
  };
}
