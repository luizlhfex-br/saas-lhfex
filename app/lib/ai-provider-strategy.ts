/**
 * AI Provider Strategy — Otimização de Custos
 *
 * Estratégia de fallback inteligente:
 * 1. Gemini Free (100% gratuito) ← PRIMEIRO
 * 2. OpenRouter Free (100% gratuito) ← SEGUNDO
 * 3. DeepSeek Paid (último resort) ← TERCEIRO
 *
 * Controle de quota:
 * - Monitorar custos diários/mensais
 * - Alertar quando atingir 80% do orçamento
 * - Bloquear quando atingir 100%
 */

import { db } from "~/lib/db.server";
import { aiUsageLogs } from "drizzle/schema";
import { sql } from "drizzle-orm";

// ── Configuração de Orçamentos ──

export const PROVIDER_BUDGETS = {
  // Gratuitos — sem limite real, mas monitorar uso
  gemini: {
    monthlyBudget: Number.POSITIVE_INFINITY,
    dailyLimit: 1_000_000, // tokens/dia
    alertAt: 0.8, // Alertar a 80% (não aplicável, mas para log)
    costPerMTok: 0, // Grátis
    priority: 1, // PRIMEIRO
  },

  openrouter_free: {
    monthlyBudget: Number.POSITIVE_INFINITY,
    dailyLimit: 500_000,
    alertAt: 0.8,
    costPerMTok: 0, // Grátis
    priority: 2, // SEGUNDO
  },

  // Pago DeepSeek — último resort
  deepseek: {
    monthlyBudget: 100, // USD $100/mês máximo
    dailyLimit: 200_000,
    alertAt: 0.8, // Alertar a $80
    costPerMTok: 0.14, // DeepSeek é barato (~$0.14 por 1M tokens)
    priority: 3, // TERCEIRO (último resort)
  },
} as const;

// ── Tipos de Estratégia ──

export type ProviderType = keyof typeof PROVIDER_BUDGETS;

export interface ProviderStatus {
  provider: ProviderType;
  available: boolean;
  costToday: number;
  costMonth: number;
  percentOfMonth: number;
  nextProvider?: ProviderType;
  reason?: string;
}

export interface StrategyDecision {
  provider: ProviderType;
  reason: string;
  isDegraded: boolean; // true se usando provider não-ideal
}

// ── Funções de Controle ──

/**
 * Calcular custo aproximado baseado em tokens
 */
export function estimateCost(
  provider: ProviderType,
  tokensUsed: number
): number {
  const config = PROVIDER_BUDGETS[provider];
  if (!config) return 0;

  // tokensUsed é tipicamente (tokensIn + tokensOut)
  // DeepSeek cobra: $0.14 por 1M input, $0.28 por 1M output
  // Aproximar como média $0.21 por 1M total
  return (tokensUsed / 1_000_000) * config.costPerMTok;
}

/**
 * Obter custo total do mês até agora (do banco de dados)
 */
export async function getCostToday(provider: ProviderType): Promise<number> {
  try {
    const result = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(CAST(cost_estimate AS FLOAT)), 0)`,
      })
      .from(aiUsageLogs)
      .where(
        sql`provider = ${provider} AND DATE(created_at) = CURRENT_DATE`
      )
      .execute();

    return result[0]?.totalCost ?? 0;
  } catch (error) {
    console.error("[PROVIDER] Failed to get daily cost:", error);
    return 0;
  }
}

/**
 * Obter custo total do mês (from 1st to today)
 */
export async function getCostThisMonth(provider: ProviderType): Promise<number> {
  try {
    const result = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(CAST(cost_estimate AS FLOAT)), 0)`,
      })
      .from(aiUsageLogs)
      .where(
        sql`provider = ${provider}
            AND DATE_TRUNC('month', created_at)::date = DATE_TRUNC('month', CURRENT_DATE)::date`
      )
      .execute();

    return result[0]?.totalCost ?? 0;
  } catch (error) {
    console.error("[PROVIDER] Failed to get monthly cost:", error);
    return 0;
  }
}

/**
 * Verificar se provider ainda tem orçamento disponível
 */
export async function isProviderAvailable(
  provider: ProviderType
): Promise<ProviderStatus> {
  const config = PROVIDER_BUDGETS[provider];
  if (!config) {
    return {
      provider,
      available: false,
      costToday: 0,
      costMonth: 0,
      percentOfMonth: 0,
      reason: "Provider não configurado",
    };
  }

  const costToday = await getCostToday(provider);
  const costMonth = await getCostThisMonth(provider);
  const percentOfMonth = (costMonth / config.monthlyBudget) * 100;

  // Gratuitos sempre disponíveis
  if (
    provider === "gemini" ||
    provider === "openrouter_free"
  ) {
    return {
      provider,
      available: true,
      costToday,
      costMonth,
      percentOfMonth: 0, // Não aplicável
    };
  }

  // Provedores pagos — verificar orçamento
  const available = costMonth < config.monthlyBudget;

  return {
    provider,
    available,
    costToday,
    costMonth,
    percentOfMonth,
    reason: available
      ? undefined
      : `Orçamento excedido: $${costMonth.toFixed(2)} / $${config.monthlyBudget}`,
  };
}

/**
 * ESTRATÉGIA DE SELEÇÃO DE PROVIDER
 *
 * Lógica:
 * 1. Tenta Gemini Free (sempre)
 * 2. Se falhar, tenta OpenRouter Free (sempre)
 * 3. Se falhar, tenta DeepSeek Paid (último resort, se tiver orçamento)
 */
export async function selectNextProvider(
  excludeProviders: ProviderType[] = []
): Promise<StrategyDecision> {
  const providers: ProviderType[] = ["gemini", "openrouter_free", "deepseek"];

  for (const provider of providers) {
    if (excludeProviders.includes(provider)) {
      console.log(`[STRATEGY] Pulando ${provider} (já tentou)`);
      continue;
    }

    const status = await isProviderAvailable(provider);

    if (status.available) {
      const isDegraded =
        provider !== "gemini" && provider !== "openrouter_free";

      const reason =
        provider === "gemini"
          ? "Gemini Free disponível"
          : provider === "openrouter_free"
            ? "OpenRouter Free disponível (Gemini falhou)"
            : `DeepSeek Paid (último resort, $${status.costMonth.toFixed(2)}/$100)`;

      return {
        provider,
        reason,
        isDegraded,
      };
    } else {
      console.warn(
        `[STRATEGY] ${provider} indisponível:`,
        status.reason
      );
    }
  }

  // Fallback final — usar DeepSeek mesmo que exceda orçamento (com warning)
  console.error(
    "[STRATEGY] TODOS os provedores falharam ou excederam orçamento!"
  );

  return {
    provider: "deepseek",
    reason: "FALLBACK FINAL: DeepSeek (pode exceder orçamento)",
    isDegraded: true,
  };
}

/**
 * Monitoramento: alertar quando atingir 80% do orçamento
 */
export async function checkBudgetAlerts(): Promise<
  Array<{ provider: ProviderType; status: ProviderStatus }>
> {
  const alerts: Array<{ provider: ProviderType; status: ProviderStatus }> = [];

  for (const provider of ["deepseek"] as const) {
    const status = await isProviderAvailable(provider);

    if (status.percentOfMonth >= PROVIDER_BUDGETS[provider].alertAt * 100) {
      alerts.push({ provider, status });

      // Log para sistema de alertas
      console.warn(
        `⚠️ BUDGET ALERT: ${provider} em ${status.percentOfMonth.toFixed(1)}% do orçamento mensal`
      );
    }
  }

  return alerts;
}

/**
 * Dashboard de uso por provider
 */
export async function getProviderUsageDashboard(): Promise<
  Record<
    ProviderType,
    {
      costToday: number;
      costMonth: number;
      percentOfMonth: number;
      budget: number;
      available: boolean;
    }
  >
> {
  const result: Record<
    ProviderType,
    {
      costToday: number;
      costMonth: number;
      percentOfMonth: number;
      budget: number;
      available: boolean;
    }
  > = {} as any;

  for (const provider of [
    "gemini",
    "openrouter_free",
    "deepseek",
  ] as const) {
    const status = await isProviderAvailable(provider);
    const config = PROVIDER_BUDGETS[provider];

    result[provider] = {
      costToday: status.costToday,
      costMonth: status.costMonth,
      percentOfMonth: status.percentOfMonth,
      budget: config.monthlyBudget,
      available: status.available,
    };
  }

  return result;
}

/**
 * Log estruturado de decisão de provider
 */
export async function logProviderDecision(
  decision: StrategyDecision,
  feature: string,
  userId?: string
): Promise<void> {
  try {
    const config = PROVIDER_BUDGETS[decision.provider];
    const costMonth = await getCostThisMonth(decision.provider);

    console.log(
      `🤖 [PROVIDER DECISION]
       Feature: ${feature}
       Selected: ${decision.provider} (priority ${config.priority})
       Reason: ${decision.reason}
       Degraded: ${decision.isDegraded}
       Cost this month: $${costMonth.toFixed(2)} / $${config.monthlyBudget}
       User: ${userId || "anonymous"}`
    );
  } catch (error) {
    console.error("[PROVIDER] Failed to log decision:", error);
  }
}
