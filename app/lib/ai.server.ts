/**
 * AI Service — Central hub for all AI operations (OpenRouter + DeepSeek fallback)
 * Replaces N8N webhooks with direct API calls from the backend.
 */

import { db } from "~/lib/db.server";
import { processes, invoices, clients } from "drizzle/schema";
import { isNull, and, notInArray, sql, eq, desc } from "drizzle-orm";

// --- Types ---

interface AgentContext {
  activeProcesses: number;
  totalClients: number;
  monthlyRevenue: number;
  recentProcesses: { reference: string; status: string; clientName?: string }[];
  dollarRate: number;
}

interface AIResponse {
  content: string;
  model: string;
  provider: "openrouter" | "deepseek";
  tokensUsed?: number;
}

type ReasoningEffort = "1x" | "3x" | "auto";

// Token limits for reasoning modes
const MAX_TOKENS_1X = 2000;
const MAX_TOKENS_3X = 16000;

// Timeouts for reasoning modes (ms)
const TIMEOUT_1X = 30000;
const TIMEOUT_3X = 60000;

// --- System Prompts ---

const AGENT_PROMPTS: Record<string, string> = {
  airton: `Você é o AIrton, o Maestro da LHFEX — plataforma de comércio exterior.
Seu papel é orquestrar todas as operações e oferecer visão estratégica.
Você tem acesso ao contexto do sistema (processos ativos, dados financeiros, clientes).
Responda sempre em português brasileiro. Seja direto, profissional e proativo.
Use os dados de contexto para dar respostas precisas sobre o estado dos processos.
Se não souber algo específico, sugira ações que o usuário pode tomar.
Assine como AIrton 🎯`,

  iana: `Você é a IAna, especialista em Comércio Exterior da LHFEX.
Seu domínio inclui:
- Classificação NCM e código SH (Harmonized System)
- Descrições blindadas para DI/DUIMP
- Análise de documentos de importação/exportação
- Compliance aduaneiro e regulamentação
- Cálculo de impostos (II, IPI, PIS, COFINS, ICMS)
- INCOTERMS e suas aplicações
Responda sempre em português brasileiro com precisão técnica.
Quando sugerir NCMs, explique o raciocínio da classificação.
Assine como IAna 📦`,

  maria: `Você é a marIA, Gestora Financeira da LHFEX.
Seu domínio inclui:
- Controle financeiro de operações de comércio exterior
- Análise de custos de importação e exportação
- Projeções de câmbio e impacto no custo final
- Planejamento tributário para comex
- Fluxo de caixa e contas a pagar/receber
- DRE e relatórios financeiros
Você tem acesso aos dados financeiros do sistema.
Responda em português brasileiro com foco em números e análises práticas.
Assine como marIA 💰`,

  iago: `Você é o IAgo, Engenheiro de Infraestrutura da LHFEX.
Seu domínio inclui:
- Status dos servidores e serviços
- Automações e workflows do sistema
- Integrações com APIs externas
- Monitoramento de performance
- Troubleshooting técnico
Responda em português brasileiro com foco técnico e prático.
Quando diagnosticar problemas, sugira soluções concretas.
Assine como IAgo 🔧`,
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

    // Fetch dollar rate
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
    return {
      activeProcesses: 0,
      totalClients: 0,
      monthlyRevenue: 0,
      recentProcesses: [],
      dollarRate: 5.50,
    };
  }
}

function buildContextMessage(ctx: AgentContext): string {
  const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  return `[CONTEXTO DO SISTEMA LHFEX]
- Processos ativos: ${ctx.activeProcesses}
- Clientes cadastrados: ${ctx.totalClients}
- Receita do mês (recebida): ${fmtBRL(ctx.monthlyRevenue)}
- Dólar comercial: R$ ${ctx.dollarRate.toFixed(2)}
- Últimos processos: ${ctx.recentProcesses.map((p) => `${p.reference} (${p.status})`).join(", ") || "nenhum"}`;
}

// --- OpenRouter API ---

async function callOpenRouter(
  systemPrompt: string,
  userMessage: string,
  contextMessage: string,
  reasoningEffort?: ReasoningEffort,
): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";
  const effort = reasoningEffort || (process.env.OPENROUTER_REASONING_EFFORT as ReasoningEffort) || "auto";

  // Build request body with optional reasoning_effort for DeepSeek models
  const requestBody: any = {
    model,
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${contextMessage}` },
      { role: "user", content: userMessage },
    ],
    max_tokens: effort === "3x" ? MAX_TOKENS_3X : MAX_TOKENS_1X, // 3x precisa de mais tokens para raciocínio estendido
    temperature: 0.7,
  };

  // Adiciona reasoning_effort para modelos DeepSeek (R1, V3, etc.)
  if (model.includes("deepseek")) {
    requestBody.reasoning_effort = effort;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://saas.lhfex.com.br",
      "X-Title": "LHFEX SaaS",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(effort === "3x" ? TIMEOUT_3X : TIMEOUT_1X), // Timeout aumentado para modo 3x
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.",
    model: data.model || model,
    provider: "openrouter",
    tokensUsed: data.usage?.total_tokens,
  };
}

// --- DeepSeek Direct API (fallback) ---

async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  contextMessage: string,
  reasoningEffort?: ReasoningEffort,
): Promise<AIResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const effort = reasoningEffort || (process.env.DEEPSEEK_REASONING_EFFORT as ReasoningEffort) || "auto";

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: `${systemPrompt}\n\n${contextMessage}` },
        { role: "user", content: userMessage },
      ],
      max_tokens: effort === "3x" ? MAX_TOKENS_3X : MAX_TOKENS_1X,
      temperature: 0.7,
      reasoning_effort: effort,
    }),
    signal: AbortSignal.timeout(effort === "3x" ? TIMEOUT_3X : TIMEOUT_1X), // Timeout aumentado para modo 3x
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.",
    model: "deepseek-chat",
    provider: "deepseek",
    tokensUsed: data.usage?.total_tokens,
  };
}

// --- Main Function ---

export async function askAgent(
  agentId: string,
  message: string,
  _userId: string,
  reasoningEffort?: ReasoningEffort,
): Promise<AIResponse> {
  const systemPrompt = AGENT_PROMPTS[agentId] || AGENT_PROMPTS.airton;
  const context = await loadAgentContext();
  const contextMessage = buildContextMessage(context);

  // Try OpenRouter first, fallback to DeepSeek
  try {
    if (process.env.OPENROUTER_API_KEY) {
      return await callOpenRouter(systemPrompt, message, contextMessage, reasoningEffort);
    }
  } catch (error) {
    console.error("[AI] OpenRouter failed, trying DeepSeek fallback:", error);
  }

  try {
    if (process.env.DEEPSEEK_API_KEY) {
      return await callDeepSeek(systemPrompt, message, contextMessage, reasoningEffort);
    }
  } catch (error) {
    console.error("[AI] DeepSeek also failed:", error);
  }

  // Ultimate fallback — no API keys configured or both failed
  return {
    content: `Olá! Sou o ${agentId === "airton" ? "AIrton 🎯" : agentId === "iana" ? "IAna 📦" : agentId === "maria" ? "marIA 💰" : "IAgo 🔧"}. Estou temporariamente indisponível. Por favor, verifique se as chaves de API (OPENROUTER_API_KEY ou DEEPSEEK_API_KEY) estão configuradas no servidor.`,
    model: "fallback",
    provider: "openrouter",
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
  ramoAtividade: string;
  phone: string;
  email: string;
  cnaeDescricao: string;
  situacao: string;
}

export async function enrichCNPJ(cnpj: string): Promise<CNPJData | null> {
  // Clean CNPJ — remove dots, slashes, dashes
  const cleanCnpj = cnpj.replace(/[^\d]/g, "");
  if (cleanCnpj.length !== 14) return null;

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[CNPJ] BrasilAPI returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      razaoSocial: data.razao_social || "",
      nomeFantasia: data.nome_fantasia || "",
      address: [data.logradouro, data.numero, data.complemento, data.bairro]
        .filter(Boolean)
        .join(", "),
      city: data.municipio || "",
      state: data.uf || "",
      zipCode: data.cep ? data.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "",
      ramoAtividade: data.cnae_fiscal_descricao || "",
      phone: data.ddd_telefone_1
        ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}`
        : "",
      email: data.email || "",
      cnaeDescricao: data.cnae_fiscal_descricao || "",
      situacao: data.descricao_situacao_cadastral || "",
    };
  } catch (error) {
    console.error("[CNPJ] Enrichment failed:", error);
    return null;
  }
}
