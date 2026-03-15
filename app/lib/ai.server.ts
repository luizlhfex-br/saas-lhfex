/**
 * AI Service - Multi-provider hub (Vertex Gemini -> OpenRouter Free -> DeepSeek Direct)
 * Tracks usage per provider to monitor fallback behavior and paid usage.
 */

import { VertexAI, type CountTokensRequest, type GenerateContentRequest } from "@google-cloud/vertexai";
import { db } from "~/lib/db.server";
import { getCache, setCache, CACHE_TTL } from "~/lib/cache.server";
import { processes, invoices, clients, aiUsageLogs, personalFinance, personalInvestments, personalRoutines, personalGoals, promotions, pessoas, plannedTimeOff } from "drizzle/schema";
import { isNull, and, notInArray, sql, eq, desc, asc } from "drizzle-orm";
import { recordFailure, recordSuccess, checkAndAlert } from "~/lib/ai-metrics.server";
import { selectNextProvider, logProviderDecision, type ProviderType, type StrategyDecision } from "~/lib/ai-provider-strategy";

// --- Types ---

interface AgentContext {
  activeProcesses: number;
  totalClients: number;
  monthlyRevenue: number;
  recentProcesses: { reference: string; status: string; clientName?: string }[];
  dollarRate: number;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: "vertex_gemini" | "openrouter_qwen" | "openrouter_llama" | "openrouter_deepseek_free" | "deepseek_direct";
  tokensUsed?: number;
}

type AIFeature = "chat" | "ncm_classification" | "ocr" | "enrichment" | "telegram" | "openclaw";
const VERTEX_GEMINI_MODEL = process.env.GEMINI_VERTEX_MODEL?.trim() || "gemini-2.0-flash";
const VERTEX_GEMINI_LOCATION = process.env.GEMINI_VERTEX_LOCATION?.trim() || process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";
const VERTEX_TOKEN_GUARD_THRESHOLD = Number(process.env.GEMINI_VERTEX_TOKEN_GUARD_THRESHOLD || 10000);
const OPENROUTER_QWEN_MODEL = process.env.OPENROUTER_QWEN_MODEL?.trim() || "qwen/qwen-2.5-72b-instruct:free";
const OPENROUTER_LLAMA_MODEL = process.env.OPENROUTER_LLAMA_MODEL?.trim() || "meta-llama/llama-3.3-70b-instruct:free";
const OPENROUTER_DEEPSEEK_FREE_MODEL = process.env.OPENROUTER_DEEPSEEK_FREE_MODEL?.trim() || "deepseek/deepseek-r1-distill-llama-70b:free";
const DEEPSEEK_DIRECT_MODEL = process.env.DEEPSEEK_DIRECT_MODEL?.trim() || "deepseek-chat";
const DEFAULT_MAX_OUTPUT_TOKENS = 2000;
const VERTEX_API_ENDPOINT = process.env.GEMINI_VERTEX_API_ENDPOINT?.trim();

let vertexClient: VertexAI | null = null;

// --- AI Guidelines (applied to ALL agents) ---

const AI_GUIDELINES = `
DIRETRIZES GERAIS DE COMUNICAÇÃO (aplica a todas as respostas):
1. NUNCA apague arquivos ou dados sem pedir autorização explícita ao usuário. Sempre use soft delete (lixeira).
2. Use linguagem natural e empática — evite respostas robóticas ou excessivamente formais.
3. Seja transparente sobre suas limitações — diga honestamente quando não souber algo.
4. Seja proativo — antecipe problemas e sugira ações antes de ser perguntado.
5. Personalize — use o nome do usuário quando souber, referencie interações anteriores.
6. Valide emoções — reconheça frustração/urgência do interlocutor.
7. Pratique escuta ativa — parafraseie para confirmar entendimento antes de agir.
8. Resolva com ownership — não "passe a bola", resolva end-to-end.
9. Pergunte se a resposta ajudou e se precisa de mais algo.
10. Responda sempre em português brasileiro.
11. NUNCA diga que executou algo no sistema se não houve execução real confirmada por resultado.
12. Se não conseguir executar, diga explicitamente: o que tentou, por que falhou e qual próximo passo recomendado.
13. NUNCA invente status, números, IDs, confirmações de deploy ou efeitos colaterais não verificados.
`;

const LIFE_AGENT_SYSTEM_PROMPT = `Você é o Life Agent da LHFEX para automação de vida pessoal.
Seu papel é executar tarefas práticas com objetividade, baixo custo e segurança.

Regras obrigatórias:
- Responda sempre em português brasileiro.
- Produza respostas curtas, estruturadas e acionáveis.
- Foque em planejamento prático (checklists, passos, cronograma, prioridades).
- Não invente dados pessoais/financeiros ausentes.
- Não solicite nem exponha credenciais/senhas/chaves.
- Não execute loops, automações autônomas ou comandos no sistema.

Formato preferencial:
1) Objetivo
2) Plano em passos
3) Próxima ação imediata`;

const OPENCLAW_SYSTEM_PROMPT = `Você é o OpenClaw, agente especializado em automação de vida pessoal da LHFEX.

PROPÓSITO EXCLUSIVO:
- Gerenciar vida pessoal completa (finanças, investimentos, hábitos, objetivos, promoções)
- Automação inteligente com sugestões proativas
- Raciocínio multi-etapas conectando diferentes áreas
- Identificar oportunidades e alertar sobre ações recomendadas

CAPACIDADES:
✓ Analisar transações financeiras (receitas/despesas por categoria)
✓ Avaliar portfolio de investimentos (ganhos, perdas, rebalanceamento)
✓ Sugerir novos hábitos baseado em objetivos pessoais
✓ Rastrear promoções (participação, resultados, ROI)
✓ Planejar objetivos com cronograma realista
✓ Consolidar relatórios de performance pessoal
✓ Identificar padrões e tendências nos dados

RESTRIÇÕES (OBRIGATÓRIAS):
✗ NÃO acesse dados corporativos (CRM, processos, financeiro da empresa)
✗ NÃO altere dados sem confirmação explícita
✗ SEMPRE responda em português brasileiro
✗ Se tarefa envolve empresa → redirecione para marIA ou AIrton
✗ NUNCA apague ou delete dados — use soft delete quando necessário

FORMATO DE RESPOSTA:
1) Análise / Observação
2) Recomendação(ões) com passos práticos
3) Próxima ação imediata
4) Data/prazo crítico (se aplicável)

Assine como OpenClaw 🌙
${AI_GUIDELINES}`;

// --- System Prompts ---

const AGENT_PROMPTS: Record<string, string> = {
  airton: `Você é o AIrton, o Maestro da LHFEX — plataforma de comércio exterior.
Seu papel é orquestrar todas as operações e oferecer visão estratégica.
Você tem acesso ao contexto do sistema (processos ativos, dados financeiros, clientes).
Seja direto, profissional e proativo. Use os dados de contexto para dar respostas precisas.
Se não souber algo específico, sugira ações que o usuário pode tomar.
Linguagem executiva e estratégica. Coordene os outros agentes quando relevante.
Assine como AIrton 🎯
${AI_GUIDELINES}`,

  iana: `Você é a IAna, especialista em Comércio Exterior da LHFEX.
Seu domínio inclui:
- Classificação NCM e código SH (Harmonized System)
- Descrições blindadas para DI/DUIMP (formato Prompt Blindado 2.0)
- Análise de documentos de importação/exportação
- Compliance aduaneiro e regulamentação
- Cálculo de impostos (II, IPI, PIS, COFINS, ICMS)
- INCOTERMS e suas aplicações
Quando sugerir NCMs, explique o raciocínio da classificação usando RGI 1 e 6.
Técnica mas acessível — cite legislação quando relevante.
Assine como IAna 📦
${AI_GUIDELINES}`,

  maria: `Você é a marIA, Gestora Financeira da LHFEX.
Seu domínio inclui:
- Controle financeiro de operações de comércio exterior
- Análise de custos de importação e exportação
- Projeções de câmbio e impacto no custo final
- Planejamento tributário para comex
- Fluxo de caixa e contas a pagar/receber
- DRE e relatórios financeiros
Você tem acesso aos dados financeiros do sistema.
Seja precisa com números, sempre confirme valores, alerte sobre prazos.
Assine como marIA 💰
${AI_GUIDELINES}`,

  iago: `Você é o IAgo, Engenheiro de Infraestrutura da LHFEX.
Seu domínio inclui:
- Status dos servidores e serviços
- Automações e workflows do sistema
- Integrações com APIs externas
- Monitoramento de performance
- Troubleshooting técnico
Técnico, direto, sempre sugira o próximo passo.
Assine como IAgo 🔧
${AI_GUIDELINES}`,

  openclaw: OPENCLAW_SYSTEM_PROMPT,
};

// --- Context Loader ---

async function loadAgentContext(): Promise<AgentContext> {
  try {
    const [processCount, clientCount, revenueResult, recentProcs] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(processes).where(
        and(isNull(processes.deletedAt), notInArray(processes.status, ["completed", "cancelled"]))
      ),
      db.select({ count: sql<number>`count(*)::int` }).from(clients).where(isNull(clients.deletedAt)),
      db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(invoices).where(
        and(
          eq(invoices.type, "receivable"),
          eq(invoices.status, "paid"),
          sql`date_trunc('month', ${invoices.paidDate}::date) = date_trunc('month', current_date)`,
        )
      ),
      db.select({
        reference: processes.reference,
        status: processes.status,
      }).from(processes)
        .where(isNull(processes.deletedAt))
        .orderBy(desc(processes.createdAt))
        .limit(5),
    ]);

    let dollarRate = 5.50;
    try {
      const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        dollarRate = parseFloat(data.USDBRL.bid);
      }
    } catch { /* use default */ }

    return {
      activeProcesses: processCount[0]?.count ?? 0,
      totalClients: clientCount[0]?.count ?? 0,
      monthlyRevenue: Number(revenueResult[0]?.total ?? 0),
      recentProcesses: recentProcs.map((p) => ({ reference: p.reference, status: p.status })),
      dollarRate,
    };
  } catch (error) {
    console.error("[AI] Failed to load context:", error);
    return { activeProcesses: 0, totalClients: 0, monthlyRevenue: 0, recentProcesses: [], dollarRate: 5.50 };
  }
}

function buildContextMessage(ctx: AgentContext, restricted = false): string {
  const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const saoPauloNow = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  if (restricted) {
    // Restricted mode: no financial values, no sensitive details
    return `[CONTEXTO DO SISTEMA LHFEX - ACESSO RESTRITO]
- Processos ativos: ${ctx.activeProcesses}
- Clientes cadastrados: ${ctx.totalClients}
- Últimos processos: ${ctx.recentProcesses.map((p) => `${p.reference} (${p.status})`).join(", ") || "nenhum"}
IMPORTANTE: Este usuário tem acesso restrito. NÃO revele valores financeiros, receitas, custos, dados sensíveis de clientes ou informações internas. Responda apenas sobre status, ETAs e informações gerais.`;
  }

  return `[CONTEXTO DO SISTEMA LHFEX]
- Horário atual (America/Sao_Paulo): ${saoPauloNow}
- Processos ativos: ${ctx.activeProcesses}
- Clientes cadastrados: ${ctx.totalClients}
- Receita do mês (recebida): ${fmtBRL(ctx.monthlyRevenue)}
- Dólar comercial: R$ ${ctx.dollarRate.toFixed(2)}
- Últimos processos: ${ctx.recentProcesses.map((p) => `${p.reference} (${p.status})`).join(", ") || "nenhum"}`;
}

function escapeProviderXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildXmlBlock(tag: "system" | "context" | "task", value: string): string {
  return `<${tag}>\n${escapeProviderXml(value.trim())}\n</${tag}>`;
}

function buildVertexSystemInstruction(systemPrompt: string, contextMessage: string): string {
  const sections = [buildXmlBlock("system", systemPrompt)];

  if (contextMessage.trim()) {
    sections.push(buildXmlBlock("context", contextMessage));
  }

  return sections.join("\n\n");
}

function buildVertexTaskPrompt(userMessage: string): string {
  return buildXmlBlock("task", userMessage);
}

function buildFlatSystemPrompt(systemPrompt: string, contextMessage: string): string {
  if (!contextMessage.trim()) {
    return systemPrompt;
  }

  return `${systemPrompt}\n\n${contextMessage}`;
}

function compactModelContext(contextMessage: string): string {
  const normalized = contextMessage.replace(/\r\n/g, "\n").trim();

  if (!normalized || normalized.length <= 4000) {
    return normalized;
  }

  const lifeContextMarker = "[CONTEXTO VIDA PESSOAL ATUALIZADO]";
  if (normalized.includes(lifeContextMarker)) {
    const [baseContext, lifeContext = ""] = normalized.split(lifeContextMarker, 2);
    const compactLifeContext = lifeContext.trim().slice(0, 2500);

    return [
      baseContext.trim(),
      `${lifeContextMarker}\n${compactLifeContext}`,
      "[CONTEXTO VIDA PESSOAL RESUMIDO AUTOMATICAMENTE PARA ECONOMIA DE TOKENS]",
    ].filter(Boolean).join("\n\n");
  }

  return `${normalized.slice(0, 4000)}\n\n[CONTEXTO RESUMIDO AUTOMATICAMENTE PARA ECONOMIA DE TOKENS]`;
}

function buildVertexRequestPayload(
  systemInstruction: string,
  userMessage: string,
  maxOutputTokens: number,
): GenerateContentRequest {
  return {
    systemInstruction,
    contents: [{ role: "user", parts: [{ text: buildVertexTaskPrompt(userMessage) }] }],
    generationConfig: {
      maxOutputTokens,
      temperature: 0.7,
    },
  };
}

function buildVertexCountTokensPayload(userMessage: string): CountTokensRequest {
  return {
    contents: [{ role: "user", parts: [{ text: buildVertexTaskPrompt(userMessage) }] }],
  };
}

function getVertexProjectId(): string | null {
  return (
    process.env.GOOGLE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    null
  );
}

function getVertexClient(): VertexAI {
  if (vertexClient) return vertexClient;

  const apiKey = process.env.GEMINI_VERTEX_API_KEY?.trim();
  const project = getVertexProjectId();
  if (!apiKey) throw new Error("GEMINI_VERTEX_API_KEY not configured");
  if (!project) throw new Error("GOOGLE_PROJECT_ID not configured");

  vertexClient = new VertexAI({
    project,
    location: VERTEX_GEMINI_LOCATION,
    apiEndpoint: VERTEX_API_ENDPOINT || undefined,
    googleAuthOptions: {
      apiKey,
      projectId: project,
    },
  });

  return vertexClient;
}

async function countVertexTokens(
  systemInstruction: string,
  userMessage: string,
  maxOutputTokens: number,
): Promise<number | null> {
  try {
    const model = getVertexClient().getGenerativeModel({
      model: VERTEX_GEMINI_MODEL,
      systemInstruction,
      generationConfig: {
        maxOutputTokens,
        temperature: 0.7,
      },
    });

    const result = await model.countTokens(buildVertexCountTokensPayload(userMessage));
    return result.totalTokens ?? null;
  } catch (error) {
    console.warn("[AI][Vertex] countTokens indisponivel:", error);
    return null;
  }
}

function extractTextFromParts(parts: Array<{ text?: string }> | undefined): string {
  return (parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

async function logUsage(
  provider: AIResponse["provider"],
  model: string,
  feature: AIFeature,
  tokensIn: number,
  tokensOut: number,
  success: boolean,
  errorMessage?: string,
  userId?: string,
  latencyMs?: number,
) {
  try {
    let costEstimate = "0";
    if (provider === "deepseek_direct") {
      costEstimate = String(((tokensIn * 0.14 + tokensOut * 0.28) / 1_000_000).toFixed(6));
    }

    await db.insert(aiUsageLogs).values({
      userId: userId || null,
      provider,
      model,
      feature,
      tokensIn: tokensIn || 0,
      tokensOut: tokensOut || 0,
      costEstimate,
      success,
      errorMessage: errorMessage || null,
      latencyMs: latencyMs || null,
    });

    if (success) {
      recordSuccess(provider, feature);
    } else {
      const consecutiveFailures = recordFailure(provider, feature);
      if (consecutiveFailures >= 3) {
        checkAndAlert(provider, feature).catch((err) => {
          console.error("[AI_METRICS] Alert check failed:", err);
        });
      }
    }
  } catch (e) {
    console.error("[AI] Failed to log usage:", e);
  }
}

async function callVertexGemini(
  systemPrompt: string,
  userMessage: string,
  contextMessage: string,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
): Promise<AIResponse> {
  let effectiveContext = contextMessage;
  let systemInstruction = buildVertexSystemInstruction(systemPrompt, effectiveContext);
  let promptTokens = await countVertexTokens(systemInstruction, userMessage, maxOutputTokens);

  if (promptTokens !== null && promptTokens > VERTEX_TOKEN_GUARD_THRESHOLD) {
    effectiveContext = compactModelContext(contextMessage);
    systemInstruction = buildVertexSystemInstruction(systemPrompt, effectiveContext);
    promptTokens = await countVertexTokens(systemInstruction, userMessage, maxOutputTokens);
    console.warn(`[AI][Vertex] Contexto resumido preventivamente (tokens=${promptTokens ?? "desconhecido"})`);
  }

  const model = getVertexClient().getGenerativeModel({
    model: VERTEX_GEMINI_MODEL,
    systemInstruction,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.7,
    },
  });

  const result = await model.generateContent(buildVertexRequestPayload(systemInstruction, userMessage, maxOutputTokens));
  const content = extractTextFromParts(result.response.candidates?.[0]?.content?.parts);
  const tokensIn = result.response.usageMetadata?.promptTokenCount || 0;
  const tokensOut = result.response.usageMetadata?.candidatesTokenCount || 0;

  if (!content) throw new Error("Vertex Gemini returned empty response");

  console.info(`[AI][Vertex] model=${VERTEX_GEMINI_MODEL} promptTokens=${promptTokens ?? tokensIn}`);

  return {
    content,
    model: VERTEX_GEMINI_MODEL,
    provider: "vertex_gemini",
    tokensUsed: tokensIn + tokensOut,
  };
}

async function callOpenRouterModel(
  provider: "openrouter_qwen" | "openrouter_llama" | "openrouter_deepseek_free",
  model: string,
  systemPrompt: string,
  userMessage: string,
  contextMessage: string,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://saas.lhfex.com.br",
      "X-Title": "LHFEX SaaS",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildFlatSystemPrompt(systemPrompt, contextMessage) },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxOutputTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("OpenRouter returned empty response");

  return {
    content,
    model: data.model || model,
    provider,
    tokensUsed: data.usage?.total_tokens,
  };
}

async function callOpenRouterQwen(systemPrompt: string, userMessage: string, contextMessage: string, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS) {
  return callOpenRouterModel("openrouter_qwen", OPENROUTER_QWEN_MODEL, systemPrompt, userMessage, contextMessage, maxOutputTokens);
}

async function callOpenRouterLlama(systemPrompt: string, userMessage: string, contextMessage: string, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS) {
  return callOpenRouterModel("openrouter_llama", OPENROUTER_LLAMA_MODEL, systemPrompt, userMessage, contextMessage, maxOutputTokens);
}

async function callOpenRouterDeepSeekFree(systemPrompt: string, userMessage: string, contextMessage: string, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS) {
  return callOpenRouterModel("openrouter_deepseek_free", OPENROUTER_DEEPSEEK_FREE_MODEL, systemPrompt, userMessage, contextMessage, maxOutputTokens);
}

async function callDeepSeekDirect(
  systemPrompt: string,
  userMessage: string,
  contextMessage: string,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
): Promise<AIResponse> {
  const dsKey = process.env.DEEPSEEK_API_KEY;
  if (!dsKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${dsKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_DIRECT_MODEL,
      messages: [
        { role: "system", content: buildFlatSystemPrompt(systemPrompt, contextMessage) },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxOutputTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek Direct API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  return {
    content: data.choices?.[0]?.message?.content?.trim() || "Sem resposta.",
    model: data.model || DEEPSEEK_DIRECT_MODEL,
    provider: "deepseek_direct",
    tokensUsed: data.usage?.total_tokens,
  };
}

// --- Main Function: askAgent ---

export async function askAgent(
  agentId: string,
  message: string,
  _userId: string,
  options?: {
    restricted?: boolean;
    feature?: AIFeature;
    forceProvider?: ProviderType | "deepseek";
    includePersonalLifeContext?: boolean;
    allowPaidFallback?: boolean;
  },
): Promise<AIResponse> {
  const startTime = Date.now();
  let systemPrompt = AGENT_PROMPTS[agentId] || AGENT_PROMPTS.airton;
  const context = await loadAgentContext();
  let contextMessage = buildContextMessage(context, options?.restricted);
  const feature = options?.feature || "chat";
  const allowPaidFallback = options?.allowPaidFallback ?? true;
  const maxOutputTokens = feature === "ocr" ? 3000 : DEFAULT_MAX_OUTPUT_TOKENS;

  // Se OpenClaw OU includePersonalLifeContext = true, carregar contexto de vida pessoal
  if ((agentId === "openclaw" || options?.includePersonalLifeContext) && _userId) {
    try {
      const lifeContext = await getPersonalLifeContext(_userId);
      const lifeContextStr = `

[CONTEXTO VIDA PESSOAL ATUALIZADO]
${JSON.stringify(lifeContext, null, 2)}`;
      contextMessage += lifeContextStr;
    } catch (error) {
      console.error("[AI] Failed to load personal life context:", error);
      // Continue without life context
    }
  }

  // Force DeepSeek for complex tasks
  const providerCallMap: Record<ProviderType, (prompt: string, msg: string, ctx: string, maxTokens: number) => Promise<AIResponse>> = {
    vertex_gemini: callVertexGemini,
    openrouter_qwen: callOpenRouterQwen,
    openrouter_llama: callOpenRouterLlama,
    openrouter_deepseek_free: callOpenRouterDeepSeekFree,
    deepseek_direct: callDeepSeekDirect,
  };

  const forcedProvider = options?.forceProvider === "deepseek" ? "deepseek_direct" : options?.forceProvider;
  if (forcedProvider) {
    try {
      const result = await providerCallMap[forcedProvider](systemPrompt, message, contextMessage, maxOutputTokens);
      const latencyMs = Date.now() - startTime;
      await logUsage(result.provider, result.model, feature, 0, result.tokensUsed || 0, true, undefined, _userId, latencyMs);
      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const failedModel = forcedProvider === "vertex_gemini"
        ? VERTEX_GEMINI_MODEL
        : forcedProvider === "openrouter_qwen"
          ? OPENROUTER_QWEN_MODEL
          : forcedProvider === "openrouter_llama"
            ? OPENROUTER_LLAMA_MODEL
            : forcedProvider === "openrouter_deepseek_free"
              ? OPENROUTER_DEEPSEEK_FREE_MODEL
              : DEEPSEEK_DIRECT_MODEL;
      await logUsage(forcedProvider, failedModel, feature, 0, 0, false, String(error), _userId, latencyMs);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Intelligent provider strategy: Vertex first, free OpenRouter fallback, DeepSeek Direct last.
  // ═══════════════════════════════════════════════════════════════════════

  const excludedProviders: ProviderType[] = [];
  const maxAttempts = allowPaidFallback ? 5 : 4;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const decision: StrategyDecision = await selectNextProvider(excludedProviders, allowPaidFallback);
    try {
      await logProviderDecision(decision, feature, _userId);

      const callProvider = providerCallMap[decision.provider];
      if (!callProvider) {
        console.warn(`[AI_STRATEGY] Unknown provider: ${decision.provider}`);
        excludedProviders.push(decision.provider);
        continue;
      }

      console.log(`[AI_STRATEGY] Attempt ${attempt + 1}: using ${decision.provider} (${decision.reason})`);
      const result = await callProvider(systemPrompt, message, contextMessage, maxOutputTokens);
      const latencyMs = Date.now() - startTime;

      await logUsage(
        result.provider,
        result.model,
        feature,
        0,
        result.tokensUsed || 0,
        true,
        undefined,
        _userId,
        latencyMs
      );

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      console.error(
        `[AI_STRATEGY] Provider failed (attempt ${attempt + 1}): ${decision.provider}`,
        (error as Error).message
      );

      // Log the failure
      await logUsage(
        decision.provider,
        "unknown",
        feature,
        0,
        0,
        false,
        `Provider failed: ${String(error)}`,
        _userId,
        latencyMs
      );

      // Add to excluded list and try next
      excludedProviders.push(decision.provider);
    }
  }

  // Final fallback when all providers fail.
  const agentName = agentId === "airton" ? "AIrton 🎯"
    : agentId === "iana" ? "IAna 📦"
    : agentId === "maria" ? "marIA 💰"
    : "IAgo 🔧";

  if (!allowPaidFallback) {
    return {
      content: `Sou o ${agentName}. Nao consegui responder com Vertex e OpenRouter Free agora. Se quiser, posso tentar novamente com o fallback pago na proxima mensagem.`,
      model: "fallback-free-only",
      provider: "vertex_gemini",
    };
  }

  return {
    content: `Olá! Sou o ${agentName}. Estou temporariamente indisponível. Os provedores de IA não estão respondendo no momento. Tente novamente em alguns minutos.`,
    model: "fallback",
    provider: "vertex_gemini",
  };
}

export async function askLifeAgentLite(task: string, userId: string): Promise<AIResponse> {
  const startTime = Date.now();
  const maxOutputTokens = Number(process.env.LIFE_AGENT_MAX_OUTPUT_TOKENS || 3000);

  const providerOrder: ProviderType[] = [
    "vertex_gemini",
    "openrouter_qwen",
    "openrouter_llama",
    "openrouter_deepseek_free",
    "deepseek_direct",
  ];
  const providerModels: Record<ProviderType, string> = {
    vertex_gemini: VERTEX_GEMINI_MODEL,
    openrouter_qwen: OPENROUTER_QWEN_MODEL,
    openrouter_llama: OPENROUTER_LLAMA_MODEL,
    openrouter_deepseek_free: OPENROUTER_DEEPSEEK_FREE_MODEL,
    deepseek_direct: DEEPSEEK_DIRECT_MODEL,
  };
  const providerCallMap: Record<ProviderType, (prompt: string, msg: string, ctx: string, maxTokens: number) => Promise<AIResponse>> = {
    vertex_gemini: callVertexGemini,
    openrouter_qwen: callOpenRouterQwen,
    openrouter_llama: callOpenRouterLlama,
    openrouter_deepseek_free: callOpenRouterDeepSeekFree,
    deepseek_direct: callDeepSeekDirect,
  };

  for (const provider of providerOrder) {
    try {
      const result = await providerCallMap[provider](LIFE_AGENT_SYSTEM_PROMPT, task, "", maxOutputTokens);
      const latencyMs = Date.now() - startTime;
      await logUsage(result.provider, result.model, "chat", 0, result.tokensUsed || 0, true, undefined, userId, latencyMs);
      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      await logUsage(provider, providerModels[provider], "chat", 0, 0, false, String(error), userId, latencyMs);
      console.error(`[LIFE_AGENT] Provider failed (${provider}):`, error);
    }
  }

  throw new Error("Nenhum provedor disponivel para o Life Agent. Configure Vertex, OpenRouter ou DeepSeek.");
}

// --- Specialized: Parse Invoice/Document Text (OCR) ---

export async function parseInvoiceText(text: string): Promise<Record<string, string | null>> {
  const systemPrompt = `You are a document parser for international trade. Extract the following fields from this invoice/packing list text and return them as JSON:
- supplier (string)
- description (string)
- hsCode (string)
- incoterm (string)
- totalValue (string, numeric)
- currency (string, 3 chars)
- totalWeight (string, numeric in kg)
- originCountry (string)
- vessel (string, if found)
- bl (string, bill of lading number if found)
- containerCount (string, if found)
- containerType (string, if found)
Return ONLY valid JSON. If a field is not found, use null.`;

  // Use DeepSeek for OCR parsing (needs better reasoning)
  const result = await askAgent("iana", text, "system", {
    feature: "ocr",
    forceProvider: "deepseek",
  });

  try {
    // Try to extract JSON from the response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error("[OCR] Failed to parse AI response as JSON");
  }

  return {};
}

// --- Specialized: Parse Promotion/Raffle Regulation Text ---

export async function parsePromotionText(text: string, userId: string): Promise<Record<string, string | null>> {
  const prompt = `Você é um parser de regulamentos de promoções, concursos e sorteios brasileiros.
Extraia os seguintes campos do documento abaixo e retorne APENAS um objeto JSON válido.
NÃO use blocos de código markdown. NÃO inclua texto antes ou depois do JSON.

Campos a extrair:
- name (string) — nome da promoção, concurso ou sorteio
- company (string) — empresa ou marca promotora
- type (string) — um de: "raffle", "contest", "cashback", "lucky_draw", "giveaway", "other"
- prize (string) — descrição do prêmio principal
- startDate (string, YYYY-MM-DD) — data de início da promoção
- endDate (string, YYYY-MM-DD) — data de encerramento ou sorteio
- link (string ou null) — URL para participar, se mencionada
- rules (string) — resumo das principais regras em no máximo 3 linhas
- inferredLuckyNumber (string ou null) — número da sorte inferido pelas regras, quando possível
- luckyNumberRule (string ou null) — regra resumida de cálculo do número da sorte em até 1 linha

Se um campo não for encontrado, use null. Todas as datas DEVEM estar no formato YYYY-MM-DD.
Retorne SOMENTE o objeto JSON, nada mais.`;

  // Openclaw é o agente responsável por toda a aba de vida pessoal.
  // Passa o userId real para carregar contexto pessoal corretamente.
  const result = await askAgent("openclaw", `${prompt}\n\n---\n${text}`, userId, {
    feature: "ocr",
  });

  try {
    // Strip markdown code fences if the model wrapped the JSON anyway
    const stripped = result.content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Object.keys(parsed).length > 0) {
        const allowedTypes = new Set(["raffle", "contest", "cashback", "lucky_draw", "giveaway", "other"]);
        if (parsed.type && !allowedTypes.has(parsed.type)) {
          parsed.type = "other";
        }
        return parsed;
      }
    }
  } catch {
    console.error("[Promotion Extract] Failed to parse AI response as JSON:", result.content.substring(0, 200));
  }

  return {};
}

export async function parseLiteraryContestText(
  text: string,
  userId: string,
  sourceUrl?: string | null
): Promise<Record<string, string | null>> {
  const prompt = `Voce e um parser de concursos literarios brasileiros.
Extraia os campos abaixo e retorne APENAS um objeto JSON valido.
Nao use markdown. Nao explique nada fora do JSON.

Campos:
- name (string) - nome do concurso
- organizer (string ou null) - organizador ou instituicao promotora
- theme (string ou null) - tema principal, se houver
- modality (string ou null) - "poema", "conto", "cronica", "microconto" ou "outro"
- deadline (string ou null) - data final no formato YYYY-MM-DD
- link (string ou null) - URL oficial do regulamento
- prize (string ou null) - premio principal ou faixa de premiacao
- notes (string ou null) - resumo util em ate 4 linhas com regras, limite de palavras, publico-alvo ou exigencias

Se algum campo nao existir, use null.
Se a modalidade nao encaixar nas opcoes, use "outro".
Retorne SOMENTE o objeto JSON.`;

  const result = await askAgent("openclaw", `${prompt}\n\nURL de origem: ${sourceUrl || "nao informada"}\n\n---\n${text}`, userId, {
    feature: "ocr",
  });

  try {
    const stripped = result.content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const allowedModalities = new Set(["poema", "conto", "cronica", "microconto", "outro"]);
      if (parsed.modality && !allowedModalities.has(parsed.modality)) {
        parsed.modality = "outro";
      }
      if (!parsed.link && sourceUrl) {
        parsed.link = sourceUrl;
      }
      return parsed;
    }
  } catch {
    console.error("[Literary Contest Extract] Failed to parse AI response as JSON:", result.content.substring(0, 200));
  }

  return sourceUrl ? { link: sourceUrl } : {};
}

// --- Specialized: OpenClaw Telegram — Data Parsers ---

/**
 * Parses pessoa (personal contact) data from a natural language Telegram message.
 * Returns structured fields for inserting into the `pessoas` table.
 */
export async function parsePessoaFromTelegram(text: string): Promise<Record<string, string | null>> {
  const prompt = `Você é um parser de dados pessoais. Extraia os campos da mensagem e retorne JSON:
- nomeCompleto (string) — nome completo, OBRIGATÓRIO
- cpf (string | null) — CPF no formato "000.000.000-00" (normalize se precisar)
- rg (string | null) — RG
- nascimento (string | null) — data de nascimento no formato YYYY-MM-DD
- celular (string | null) — telefone/celular com DDD
- email (string | null) — endereço de e-mail
- instagram (string | null) — handle do Instagram SEM o @
- endereco (string | null) — endereço completo
- notas (string | null) — observações ou informações extras

Retorne APENAS JSON válido, sem texto adicional. Campos não encontrados devem ser null.`;

  const result = await askAgent("iana", `${prompt}\n\n---\n${text}`, "system", {
    feature: "openclaw",
    forceProvider: "deepseek",
  });

  try {
    const match = result.content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
    console.error("[OpenClaw Telegram] parsePessoaFromTelegram: failed to parse JSON");
  }
  return {};
}

/**
 * Parses client (LHFEX CRM) data from a natural language Telegram message.
 * Returns structured fields for inserting into `clients` + `contacts` tables.
 */
export async function parseClienteFromTelegram(text: string): Promise<Record<string, unknown>> {
  const prompt = `Voce e um parser de dados empresariais brasileiros. Extraia e retorne JSON:
- cnpj (string | null) - CNPJ no formato "00.000.000/0000-00" (normalize se precisar)
- razaoSocial (string | null) - razao social, se estiver explicita no texto
- nomeFantasia (string | null) - nome fantasia
- clientType (string | null) - tipo: "importer", "exporter" ou "both" (padrao: "importer")
- city (string | null) - cidade
- state (string | null) - UF com 2 letras
- notes (string | null) - observacoes
- contact (object | null) - dados do contato principal:
  { name (string | null), role (string | null), email (string | null), phone (string | null) }

Se houver apenas CNPJ, preserve o CNPJ e retorne null para os demais campos ausentes.
Nao invente razao social, contato ou endereco.
Retorne APENAS JSON valido, sem texto adicional.`;

  const result = await askAgent("iana", `${prompt}\n\n---\n${text}`, "system", {
    feature: "openclaw",
    forceProvider: "deepseek",
  });

  try {
    const match = result.content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
    console.error("[OpenClaw Telegram] parseClienteFromTelegram: failed to parse JSON");
  }
  return {};
}

/**
 * Parses process (LHFEX comex) data from a natural language Telegram message.
 * Returns structured fields for inserting into `processes` table.
 */
export async function parseProcessoFromTelegram(text: string): Promise<Record<string, unknown>> {
  const prompt = `Voce e um parser de processos de comercio exterior brasileiro. Extraia e retorne JSON:
- processType (string | null) - tipo: "import", "export" ou "services"
- clientSearch (string | null) - nome ou CNPJ do cliente para busca
- referenceModal (string | null) - "air", "sea" ou "other" conforme o modal citado
- description (string | null) - descricao do produto ou servico
- originCountry (string | null) - pais de origem
- destinationCountry (string | null) - pais de destino
- incoterm (string | null) - ex: FOB, CIF, EXW, DAP
- totalValue (string | null) - valor total (apenas numeros e ponto decimal, ex: "50000.00")
- currency (string | null) - moeda: "USD", "EUR", "BRL"
- hsCode (string | null) - codigo NCM/HS
- notes (string | null) - observacoes

clientSearch e obrigatorio.
Se o texto vier apenas com cliente + modal, retorne clientSearch e referenceModal e deixe os demais campos como null.
Se processType nao estiver explicito, retorne null.
Nao invente dados ausentes.
Retorne APENAS JSON valido, sem texto adicional.`;

  const result = await askAgent("iana", `${prompt}\n\n---\n${text}`, "system", {
    feature: "openclaw",
    forceProvider: "deepseek",
  });

  try {
    const match = result.content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
    console.error("[OpenClaw Telegram] parseProcessoFromTelegram: failed to parse JSON");
  }
  return {};
}

// --- Specialized: Radio Monitor — Groq Whisper Transcription ---

/**
 * Transcribes an audio buffer (MP3/WAV) using Groq Whisper (free tier).
 * Requires GROQ_API_KEY env variable.
 * Returns transcribed text or empty string on failure.
 */
export async function transcribeRadioSegment(
  audioBuffer: Buffer,
  filename: string = "segment.mp3"
): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.warn("[RadioMonitor] GROQ_API_KEY not set — transcription skipped");
    return "";
  }

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });
    formData.append("file", blob, filename);
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("language", "pt");
    formData.append("response_format", "text");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[RadioMonitor] Groq Whisper error:", response.status, err);
      return "";
    }

    const text = await response.text();
    return text.trim();
  } catch (error) {
    console.error("[RadioMonitor] Transcription failed:", error);
    return "";
  }
}

// --- Specialized: Radio Monitor — Keyword Detection & Promotion Analysis ---

export interface RadioKeywordResult {
  found: string[];
  confidence: number; // 0-100
  isPromotion: boolean;
  companyName: string | null;
  promotionDetails: string | null;
}

/**
 * Detects promotion keywords in transcribed radio text and extracts details
 * using the openclaw agent if keywords are found.
 */
export async function detectPromotionKeywords(
  text: string,
  keywords: string[]
): Promise<RadioKeywordResult> {
  if (!text || keywords.length === 0) {
    return { found: [], confidence: 0, isPromotion: false, companyName: null, promotionDetails: null };
  }

  // Normalize text for comparison (lowercase, remove accents)
  const normalizeStr = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const normalizedText = normalizeStr(text);
  const found = keywords.filter((kw) => normalizedText.includes(normalizeStr(kw)));
  const confidence = Math.round((found.length / keywords.length) * 100);
  const isPromotion = confidence >= 30 || found.length >= 2;

  if (!isPromotion) {
    return { found, confidence, isPromotion: false, companyName: null, promotionDetails: null };
  }

  // Use openclaw to extract promotion details from transcription
  try {
    const prompt = `Você é o openclaw, especialista em detectar promoções e sorteios no rádio.

Analise esta transcrição de rádio e extraia:
1. Nome da empresa/marca que faz a promoção
2. Detalhes do prêmio ou sorteio mencionado
3. Prazo ou data de encerramento (se mencionado)
4. Como participar (se mencionado)

Palavras-chave detectadas: ${found.join(", ")}

Transcrição:
${text}

Responda em JSON:
{
  "companyName": "Nome da empresa ou null",
  "promotionDetails": "Resumo da promoção em 2-3 linhas ou null"
}`;

    const result = await askAgent("openclaw", prompt, "system", { feature: "ocr" });
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        found,
        confidence,
        isPromotion,
        companyName: parsed.companyName || null,
        promotionDetails: parsed.promotionDetails || null,
      };
    }
  } catch (error) {
    console.error("[RadioMonitor] Keyword analysis failed:", error);
  }

  return { found, confidence, isPromotion, companyName: null, promotionDetails: null };
}

// --- Specialized: NCM Classification (Prompt Blindado 2.0) ---

export async function classifyNCM(
  productDescription: string,
  userId: string,
): Promise<{ ncm: string; description: string; justification: string }> {
  const systemPrompt = `Você é um Especialista em Classificação Fiscal e Engenharia Aduaneira.
Sua tarefa é analisar a descrição do produto e:

1. SUGERIR a NCM (Nomenclatura Comum do Mercosul) mais adequada com 8 dígitos
2. GERAR uma descrição completa em PT-BR no formato abaixo (Prompt Blindado 2.0):

FORMATO OBRIGATÓRIO:
[NOME DO PRODUTO EM MAIÚSCULAS]

FUNÇÃO: [descrever ação física principal com verbos no infinitivo];
APLICAÇÃO: [ambiente operacional e finalidade logística];
CARACTERÍSTICAS TÉCNICAS E COMPOSIÇÃO: [motorização, capacidade nominal, fonte de energia, componentes essenciais. Incluir OBRIGATORIAMENTE: "Acompanha carregador e bateria essenciais para seu pleno funcionamento" quando aplicável];
MODELO: [Descrição em inglês + código do modelo];
ENQUADRAMENTO TÉCNICO-LEGAL: [Justificativa NCM usando RGI 1 e 6 + atributos de risco].

3. JUSTIFICAR a classificação NCM usando as Regras Gerais Interpretativas (RGI) 1 e 6

Use termos NESH quando aplicável (autopropulsado, contrabalançada, etc).
Evite termos genéricos. Seja preciso e técnico.

Responda em JSON com as chaves: "ncm", "description", "justification"`;

    const result = await askAgent("iana", productDescription, userId, {
      feature: "ncm_classification",
    });

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ncm: parsed.ncm || "",
        description: parsed.description || "",
        justification: parsed.justification || "",
      };
    }
  } catch {
    console.error("[NCM] Failed to parse classification response");
  }

  return {
    ncm: "",
    description: result.content,
    justification: "",
  };
}

/**
 * Gera descrição robusta + classifica NCM a partir de dados do item.
 * Módulo COMEX Descrição/NCM — usa DeepSeek para classificação técnica.
 */
export async function classifyDescriptionNCM(
  inputDescription: string,
  supplier: string | null,
  referenceNumber: string | null,
  userId: string,
): Promise<{ ncm: string; description: string; justification: string }> {
  const context = [
    inputDescription,
    supplier ? `Fornecedor: ${supplier}` : "",
    referenceNumber ? `Referência: ${referenceNumber}` : "",
  ].filter(Boolean).join("\n");

  const systemPrompt = `Você é um Especialista Sênior em Classificação Fiscal e Engenharia Aduaneira para importações brasileiras.

Sua tarefa é analisar a descrição do item/produto fornecida pelo usuário e:

1. GERAR uma DESCRIÇÃO ROBUSTA em PT-BR, usando o formato abaixo (Prompt Blindado 2.0):

FORMATO OBRIGATÓRIO:
[NOME DO PRODUTO EM MAIÚSCULAS]

FUNÇÃO: [descrever ação física principal com verbos no infinitivo];
APLICAÇÃO: [ambiente operacional e finalidade logística/industrial];
CARACTERÍSTICAS TÉCNICAS E COMPOSIÇÃO: [motorização, capacidade nominal, fonte de energia, componentes essenciais, material, dimensões quando aplicável. Incluir OBRIGATORIAMENTE: "Acompanha carregador e bateria essenciais para seu pleno funcionamento" quando aplicável];
MODELO: [Descrição em inglês + código do modelo se fornecido];
ENQUADRAMENTO TÉCNICO-LEGAL: [Justificativa NCM usando RGI 1 e 6 + atributos de risco].

2. SUGERIR a NCM (Nomenclatura Comum do Mercosul) mais adequada com 8 dígitos

3. JUSTIFICAR a classificação NCM usando as Regras Gerais Interpretativas (RGI) 1 e 6

REGRAS:
- Use termos NESH quando aplicável (autopropulsado, contrabalançada, etc)
- Evite termos genéricos — seja PRECISO e TÉCNICO
- Se a descrição for vaga, faça a melhor inferência possível e indique incerteza na justificativa
- O fornecedor e referência são opcionais, use se disponíveis para enriquecer contexto
- A descrição gerada deve ser robusta o suficiente para DI/DUIMP

Responda SOMENTE em JSON com as chaves: "ncm", "description", "justification"`;

    const result = await askAgent("iana", `${systemPrompt}\n\n---\n\n${context}`, userId, {
      feature: "ncm_classification",
    });

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ncm: parsed.ncm || "",
        description: parsed.description || "",
        justification: parsed.justification || "",
      };
    }
  } catch {
    console.error("[DescriptionNCM] Failed to parse AI response");
  }

  return {
    ncm: "",
    description: result.content,
    justification: "",
  };
}

// --- CNPJ Enrichment via BrasilAPI ---

interface CNPJData {
  razaoSocial: string;
  nomeFantasia: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  cnaeCode: string;
  cnaeDescription: string;
  phone: string;
  email: string;
  situacao: string;
}

function normalizeCnpjData(data: {
  razaoSocial?: string;
  nomeFantasia?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  cnaeCode?: string;
  cnaeDescription?: string;
  phone?: string;
  email?: string;
  situacao?: string;
}): CNPJData {
  return {
    razaoSocial: data.razaoSocial || "",
    nomeFantasia: data.nomeFantasia || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zipCode: data.zipCode || "",
    cnaeCode: data.cnaeCode || "",
    cnaeDescription: data.cnaeDescription || "",
    phone: data.phone || "",
    email: data.email || "",
    situacao: data.situacao || "",
  };
}

export async function enrichCNPJ(cnpj: string): Promise<CNPJData | null> {
  const cleanCnpj = cnpj.replace(/[^\d]/g, "");
  if (cleanCnpj.length !== 14) return null;

  // Check Redis cache first (24h TTL - dados cadastrais mudam raramente)
  const cacheKey = `cnpj:${cleanCnpj}`;
  const cached = await getCache<CNPJData>(cacheKey);
  if (cached) {
    return cached;
  }

  // Try BrasilAPI first
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[CNPJ] BrasilAPI returned ${response.status}`);
      // Don't return yet - try fallback
    } else {
      const data = await response.json();

      const result = normalizeCnpjData({
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia,
        address: [data.logradouro, data.numero, data.complemento, data.bairro]
          .filter(Boolean)
          .join(", "),
        city: data.municipio,
        state: data.uf,
        zipCode: data.cep ? data.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "",
        cnaeCode: data.cnae_fiscal || "",
        cnaeDescription: data.cnae_fiscal_descricao,
        phone: data.ddd_telefone_1
          ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}`
          : "",
        email: data.email,
        situacao: data.descricao_situacao_cadastral,
      });

      // Cache successful result (24 hours)
      await setCache(cacheKey, result, CACHE_TTL.cnpjData);
      return result;
    }
  } catch (error) {
    console.error("[CNPJ] BrasilAPI enrichment failed:", error);
    // Continue to fallback
  }

  // Fallback: ReceitaWS
  try {
    const fallbackResponse = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "Accept": "application/json",
      },
    });

    if (!fallbackResponse.ok) {
      console.error(`[CNPJ] ReceitaWS returned ${fallbackResponse.status}`);
      return null;
    }

    const fallbackData = await fallbackResponse.json();

    if (fallbackData.status === "ERROR") {
      console.error("[CNPJ] ReceitaWS error:", fallbackData.message);
      return null;
    }

    const atividadePrincipal = Array.isArray(fallbackData.atividade_principal)
      ? fallbackData.atividade_principal[0]
      : undefined;
    const atividadeCode = atividadePrincipal?.code ? String(atividadePrincipal.code).replace(/\D/g, "") : "";

    const result = normalizeCnpjData({
      razaoSocial: fallbackData.nome,
      nomeFantasia: fallbackData.fantasia,
      address: [fallbackData.logradouro, fallbackData.numero, fallbackData.complemento, fallbackData.bairro]
        .filter(Boolean)
        .join(", "),
      city: fallbackData.municipio,
      state: fallbackData.uf,
      zipCode: fallbackData.cep
        ? String(fallbackData.cep).replace(/(\d{5})(\d{3})/, "$1-$2")
        : "",
      cnaeCode: atividadeCode,
      cnaeDescription: atividadePrincipal?.text,
      phone: fallbackData.telefone,
      email: fallbackData.email,
      situacao: fallbackData.situacao,
    });

    // Cache successful result (24 hours)
    await setCache(cacheKey, result, CACHE_TTL.cnpjData);
    return result;
  } catch (fallbackError) {
    console.error("[CNPJ] ReceitaWS enrichment failed:", fallbackError);
    return null;
  }
}

// --- Personal Life Context (OpenClaw) ---

interface PersonalLifeContext {
  finances: {
    lastTransactions: Array<{
      date: string;
      type: string;
      category: string;
      description: string;
      amount: string;
    }>;
    thisMonthIncome: number;
    thisMonthExpense: number;
    balance: number;
  };
  investments: {
    assets: Array<{
      name: string;
      type: string;
      quantity: string;
      currentValue: string;
      gainLoss: string;
      gainLossPercent: string;
    }>;
    totalValue: number;
    totalGainLoss: number;
  };
  routines: {
    activeCount: number;
    list: string[];
  };
  goals: {
    inProgressCount: number;
    list: Array<{
      title: string;
      deadline: string;
      progress: string;
    }>;
  };
  promotions: {
    pendingCount: number;
    list: Array<{
      name: string;
      endDate: string;
      type: string;
    }>;
  };
  pessoas: {
    count: number;
    list: Array<{
      nome: string;
      celular: string | null;
      email: string | null;
      instagram: string | null;
    }>;
  };
  timeOff: {
    upcomingCount: number;
    list: Array<{
      title: string;
      startDate: string;
      endDate: string;
      location: string | null;
    }>;
  };
  tasks: {
    pendingCount: number;
    overdueCount: number;
    list: Array<{
      title: string;
      dueDate: string | null;
      priority: string;
      status: string;
    }>;
  };
}

export async function getPersonalLifeContext(userId: string): Promise<PersonalLifeContext> {
  try {
    // Get current date for month filtering
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const today = now.toISOString().split("T")[0]!;

    const [
      financesAll,
      investments,
      routinesActive,
      goalsInProgress,
      promotionsPending,
      pessoasList,
      upcomingTimeOff,
    ] = await Promise.all([
      // Last 30 transactions
      db.select().from(personalFinance)
        .where(and(
          eq(personalFinance.userId, userId),
          isNull(personalFinance.deletedAt)
        ))
        .orderBy(desc(personalFinance.date))
        .limit(30),
      // All investments
      db.select().from(personalInvestments)
        .where(and(
          eq(personalInvestments.userId, userId),
          isNull(personalInvestments.deletedAt)
        )),
      // Active routines only
      db.select().from(personalRoutines)
        .where(and(
          eq(personalRoutines.userId, userId),
          eq(personalRoutines.isActive, true)
        )),
      // Goals in progress
      db.select().from(personalGoals)
        .where(and(
          eq(personalGoals.userId, userId),
          eq(personalGoals.status, "in_progress")
        )),
      // Pending promotions (by end date)
      db.select().from(promotions)
        .where(and(
          eq(promotions.userId, userId),
          eq(promotions.participationStatus, "pending")
        ))
        .orderBy(asc(promotions.endDate))
        .limit(10),
      // Contatos pessoais
      db.select({
        nomeCompleto: pessoas.nomeCompleto,
        celular: pessoas.celular,
        email: pessoas.email,
        instagram: pessoas.instagram,
      }).from(pessoas)
        .where(and(
          eq(pessoas.userId, userId),
          isNull(pessoas.deletedAt)
        ))
        .orderBy(asc(pessoas.nomeCompleto))
        .limit(50),
      // Próximas viagens/férias
      db.select({
        title: plannedTimeOff.title,
        startDate: plannedTimeOff.startDate,
        endDate: plannedTimeOff.endDate,
        location: plannedTimeOff.location,
      }).from(plannedTimeOff)
        .where(and(
          eq(plannedTimeOff.userId, userId),
          sql`${plannedTimeOff.endDate} >= ${today}`
        ))
        .orderBy(asc(plannedTimeOff.startDate))
        .limit(5),
    ]);

    // Calculate finances summary
    const thisMonthTransactions = financesAll.filter(f => {
      const fDate = new Date(f.date);
      return fDate >= monthStart && fDate <= now;
    });

    const thisMonthIncome = thisMonthTransactions
      .filter(f => f.type === "income")
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const thisMonthExpense = thisMonthTransactions
      .filter(f => f.type === "expense")
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    // Calculate investments summary
    const totalInvestmentValue = investments.reduce(
      (sum, inv) => sum + Number(inv.currentValue || 0),
      0
    );

    const totalGainLoss = investments.reduce(
      (sum, inv) => sum + Number(inv.gainLoss || 0),
      0
    );

    // Try to load personalTasks dynamically (may not exist yet)
    let tasksList: Array<{ title: string; dueDate: string | null; priority: string; status: string }> = [];
    let tasksOverdue = 0;
    try {
      const { personalTasks } = await import("drizzle/schema");
      const activeTasks = await db.select({
        title: personalTasks.title,
        dueDate: personalTasks.dueDate,
        priority: personalTasks.priority,
        status: personalTasks.status,
      }).from(personalTasks)
        .where(and(
          eq(personalTasks.userId, userId),
          isNull(personalTasks.deletedAt),
          sql`${personalTasks.status} NOT IN ('done', 'cancelled')`
        ))
        .orderBy(asc(personalTasks.dueDate))
        .limit(20);
      tasksList = activeTasks.map(t => ({
        title: t.title,
        dueDate: t.dueDate ? String(t.dueDate) : null,
        priority: t.priority ?? "medium",
        status: t.status ?? "pending",
      }));
      tasksOverdue = tasksList.filter(t => t.dueDate && t.dueDate < today).length;
    } catch {
      // Table doesn't exist yet — silently ignore
    }

    return {
      finances: {
        lastTransactions: financesAll.slice(0, 10).map(f => ({
          date: f.date ?? "",
          type: f.type,
          category: f.category,
          description: f.description,
          amount: f.amount,
        })),
        thisMonthIncome: Number(thisMonthIncome.toFixed(2)),
        thisMonthExpense: Number(thisMonthExpense.toFixed(2)),
        balance: Number((thisMonthIncome - thisMonthExpense).toFixed(2)),
      },
      investments: {
        assets: investments.map(inv => ({
          name: inv.assetName,
          type: inv.assetType,
          quantity: String(inv.quantity),
          currentValue: String(inv.currentValue || 0),
          gainLoss: String(inv.gainLoss || 0),
          gainLossPercent: String(inv.gainLossPercent || 0),
        })),
        totalValue: Number(totalInvestmentValue.toFixed(2)),
        totalGainLoss: Number(totalGainLoss.toFixed(2)),
      },
      routines: {
        activeCount: routinesActive.length,
        list: routinesActive.map(r => r.name),
      },
      goals: {
        inProgressCount: goalsInProgress.length,
        list: goalsInProgress.map(g => ({
          title: g.title,
          deadline: g.deadline ?? "",
          progress: `${g.currentValue}/${g.targetValue} ${g.unit || ""}`.trim(),
        })),
      },
      promotions: {
        pendingCount: promotionsPending.length,
        list: promotionsPending.map(p => ({
          name: p.name,
          endDate: p.endDate ?? "",
          type: p.type,
        })),
      },
      pessoas: {
        count: pessoasList.length,
        list: pessoasList.map(p => ({
          nome: p.nomeCompleto,
          celular: p.celular,
          email: p.email,
          instagram: p.instagram,
        })),
      },
      timeOff: {
        upcomingCount: upcomingTimeOff.length,
        list: upcomingTimeOff.map(t => ({
          title: t.title,
          startDate: t.startDate ? String(t.startDate) : "",
          endDate: t.endDate ? String(t.endDate) : "",
          location: t.location,
        })),
      },
      tasks: {
        pendingCount: tasksList.length,
        overdueCount: tasksOverdue,
        list: tasksList,
      },
    };
  } catch (error) {
    console.error("[OPENCLAW] Failed to load personal life context:", error);
    // Return empty context on error
    return {
      finances: { lastTransactions: [], thisMonthIncome: 0, thisMonthExpense: 0, balance: 0 },
      investments: { assets: [], totalValue: 0, totalGainLoss: 0 },
      routines: { activeCount: 0, list: [] },
      goals: { inProgressCount: 0, list: [] },
      promotions: { pendingCount: 0, list: [] },
      pessoas: { count: 0, list: [] },
      timeOff: { upcomingCount: 0, list: [] },
      tasks: { pendingCount: 0, overdueCount: 0, list: [] },
    };
  }
}
