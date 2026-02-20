/**
 * AI Service — Multi-provider hub (Gemini Free → OpenRouter Free → DeepSeek Paid)
 * Tracks usage per provider to monitor free vs paid consumption.
 */

import { db } from "~/lib/db.server";
import { processes, invoices, clients, aiUsageLogs } from "drizzle/schema";
import { isNull, and, notInArray, sql, eq, desc } from "drizzle-orm";

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
  provider: "gemini" | "openrouter_free" | "openrouter_paid" | "deepseek";
  tokensUsed?: number;
}

type AIFeature = "chat" | "ncm_classification" | "ocr" | "enrichment" | "telegram";

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
`;

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

  if (restricted) {
    // Restricted mode: no financial values, no sensitive details
    return `[CONTEXTO DO SISTEMA LHFEX - ACESSO RESTRITO]
- Processos ativos: ${ctx.activeProcesses}
- Clientes cadastrados: ${ctx.totalClients}
- Últimos processos: ${ctx.recentProcesses.map((p) => `${p.reference} (${p.status})`).join(", ") || "nenhum"}
IMPORTANTE: Este usuário tem acesso restrito. NÃO revele valores financeiros, receitas, custos, dados sensíveis de clientes ou informações internas. Responda apenas sobre status, ETAs e informações gerais.`;
  }

  return `[CONTEXTO DO SISTEMA LHFEX]
- Processos ativos: ${ctx.activeProcesses}
- Clientes cadastrados: ${ctx.totalClients}
- Receita do mês (recebida): ${fmtBRL(ctx.monthlyRevenue)}
- Dólar comercial: R$ ${ctx.dollarRate.toFixed(2)}
- Últimos processos: ${ctx.recentProcesses.map((p) => `${p.reference} (${p.status})`).join(", ") || "nenhum"}`;
}

// --- Usage Logging ---

async function logUsage(
  provider: "gemini" | "openrouter_free" | "openrouter_paid" | "deepseek",
  model: string,
  feature: AIFeature,
  tokensIn: number,
  tokensOut: number,
  success: boolean,
  errorMessage?: string,
  userId?: string,
) {
  try {
    // Estimate cost (approximate)
    let costEstimate = "0";
    if (provider === "deepseek") {
      costEstimate = String(((tokensIn * 0.14 + tokensOut * 0.28) / 1_000_000).toFixed(6));
    } else if (provider === "openrouter_paid") {
      costEstimate = String(((tokensIn * 0.14 + tokensOut * 0.28) / 1_000_000).toFixed(6));
    }
    // gemini and openrouter_free = $0

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
    });
  } catch (e) {
    console.error("[AI] Failed to log usage:", e);
  }
}

// --- Provider 1: Gemini Free ---

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  contextMessage: string,
): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: `${systemPrompt}\n\n${contextMessage}` }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokensIn = data.usageMetadata?.promptTokenCount || 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;

  if (!content) throw new Error("Gemini returned empty response");

  return {
    content,
    model: "gemini-2.0-flash",
    provider: "gemini",
    tokensUsed: tokensIn + tokensOut,
  };
}

// --- Provider 2: OpenRouter (free models) ---

async function callOpenRouterFree(
  systemPrompt: string,
  userMessage: string,
  contextMessage: string,
): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  // Use a free model on OpenRouter
  const model = "google/gemini-2.0-flash-exp:free";

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
        { role: "system", content: `${systemPrompt}\n\n${contextMessage}` },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter Free error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("OpenRouter Free returned empty response");

  return {
    content,
    model: data.model || model,
    provider: "openrouter_free",
    tokensUsed: data.usage?.total_tokens,
  };
}

// --- Provider 3: DeepSeek Paid (via OpenRouter or Direct) ---

async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  contextMessage: string,
): Promise<AIResponse> {
  // Try via OpenRouter first (paid model)
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    try {
      const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${orKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "https://saas.lhfex.com.br",
          "X-Title": "LHFEX SaaS",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${systemPrompt}\n\n${contextMessage}` },
            { role: "user", content: userMessage },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          content: data.choices?.[0]?.message?.content || "Sem resposta.",
          model: data.model || model,
          provider: "openrouter_paid",
          tokensUsed: data.usage?.total_tokens,
        };
      }
    } catch { /* fall through to direct DeepSeek */ }
  }

  // Direct DeepSeek API
  const dsKey = process.env.DEEPSEEK_API_KEY;
  if (!dsKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${dsKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: `${systemPrompt}\n\n${contextMessage}` },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "Sem resposta.",
    model: "deepseek-chat",
    provider: "deepseek",
    tokensUsed: data.usage?.total_tokens,
  };
}

// --- Main Function: askAgent ---

export async function askAgent(
  agentId: string,
  message: string,
  _userId: string,
  options?: { restricted?: boolean; feature?: AIFeature; forceProvider?: "deepseek" },
): Promise<AIResponse> {
  const systemPrompt = AGENT_PROMPTS[agentId] || AGENT_PROMPTS.airton;
  const context = await loadAgentContext();
  const contextMessage = buildContextMessage(context, options?.restricted);
  const feature = options?.feature || "chat";

  // Force DeepSeek for complex tasks
  if (options?.forceProvider === "deepseek") {
    try {
      const result = await callDeepSeek(systemPrompt, message, contextMessage);
      await logUsage(result.provider, result.model, feature, 0, 0, true, undefined, _userId);
      return result;
    } catch (error) {
      await logUsage("deepseek", "deepseek-chat", feature, 0, 0, false, String(error), _userId);
      throw error;
    }
  }

  // Strategy: Gemini Free → OpenRouter Free → DeepSeek Paid
  // 1. Try Gemini Free
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await callGemini(systemPrompt, message, contextMessage);
      await logUsage("gemini", result.model, feature, 0, result.tokensUsed || 0, true, undefined, _userId);
      return result;
    } catch (error) {
      console.error("[AI] Gemini failed:", (error as Error).message);
      await logUsage("gemini", "gemini-2.0-flash", feature, 0, 0, false, String(error), _userId);
    }
  }

  // 2. Try OpenRouter Free
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const result = await callOpenRouterFree(systemPrompt, message, contextMessage);
      await logUsage("openrouter_free", result.model, feature, 0, result.tokensUsed || 0, true, undefined, _userId);
      return result;
    } catch (error) {
      console.error("[AI] OpenRouter Free failed:", (error as Error).message);
      await logUsage("openrouter_free", "gemini-2.0-flash-exp:free", feature, 0, 0, false, String(error), _userId);
    }
  }

  // 3. Try DeepSeek Paid (fallback)
  try {
    const result = await callDeepSeek(systemPrompt, message, contextMessage);
    await logUsage(result.provider, result.model, feature, 0, result.tokensUsed || 0, true, undefined, _userId);
    return result;
  } catch (error) {
    console.error("[AI] DeepSeek also failed:", error);
    await logUsage("deepseek", "deepseek-chat", feature, 0, 0, false, String(error), _userId);
  }

  // Ultimate fallback — all providers failed
  return {
    content: `Olá! Sou o ${agentId === "airton" ? "AIrton 🎯" : agentId === "iana" ? "IAna 📦" : agentId === "maria" ? "marIA 💰" : "IAgo 🔧"}. Estou temporariamente indisponível. Os provedores de IA não estão respondendo no momento. Tente novamente em alguns minutos.`,
    model: "fallback",
    provider: "gemini",
  };
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
    forceProvider: "deepseek", // Use DeepSeek for complex classification
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

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[CNPJ] BrasilAPI returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    return normalizeCnpjData({
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
  } catch (error) {
    console.error("[CNPJ] BrasilAPI enrichment failed:", error);
  }

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

    return normalizeCnpjData({
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
  } catch (fallbackError) {
    console.error("[CNPJ] ReceitaWS enrichment failed:", fallbackError);
    return null;
  }
}
