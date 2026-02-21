/**
 * AI Metrics & Alerting Module
 * Tracks AI provider health, failures, latency, and costs
 * Sends alerts via Telegram when providers fail or exceed thresholds
 */

import { db } from "~/lib/db.server";
import { aiUsageLogs } from "drizzle/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { sendTelegramNotification } from "~/lib/telegram-notifier.server";

// --- Types ---

export interface AIMetrics {
  provider: string;
  feature: string;
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  totalCost: number;
  errorCount: number;
  lastError?: string;
  lastUsed?: Date;
}

export interface AIAlert {
  severity: "warning" | "critical";
  provider: string;
  feature: string;
  message: string;
  metrics?: Partial<AIMetrics>;
  timestamp: Date;
}

// --- Configuration ---

const ALERT_THRESHOLDS = {
  errorRate: 0.3, // Alert if >30% errors
  latencyMs: 10000, // Alert if avg latency >10s
  costDaily: 5.0, // Alert if daily cost >$5
  consecutiveFailures: 5, // Alert after 5 consecutive failures
};

const METRICS_WINDOW_HOURS = 24; // Analyze last 24 hours
const ALERT_COOLDOWN_MS = 3600000; // Don't re-alert for same issue within 1 hour

// In-memory cache for alert cooldowns
const alertCooldowns = new Map<string, number>();

// --- Metrics Collection ---

/**
 * Get metrics for a specific provider and feature
 */
export async function getProviderMetrics(
  provider: string,
  feature: string,
  windowHours: number = METRICS_WINDOW_HOURS
): Promise<AIMetrics> {
  const since = new Date(Date.now() - windowHours * 3600000);

  const logs = await db
    .select()
    .from(aiUsageLogs)
    .where(
      and(
        sql`${aiUsageLogs.provider} = ${provider}`,
        sql`${aiUsageLogs.feature} = ${feature}`,
        gte(aiUsageLogs.createdAt, since)
      )
    );

  const totalRequests = logs.length;
  const successCount = logs.filter((l) => l.success).length;
  const errorCount = totalRequests - successCount;
  const successRate = totalRequests > 0 ? successCount / totalRequests : 0;

  const latencies = logs.filter((l) => l.latencyMs).map((l) => l.latencyMs!);
  const avgLatencyMs =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

  const totalCost = logs.reduce(
    (sum, l) => sum + (parseFloat(l.costEstimate || "0") || 0),
    0
  );

  const errors = logs.filter((l) => !l.success);
  const lastError = errors.length > 0 ? errors[errors.length - 1].errorMessage || undefined : undefined;

  const lastUsed = logs.length > 0 ? logs[logs.length - 1].createdAt : undefined;

  return {
    provider,
    feature,
    totalRequests,
    successRate,
    avgLatencyMs,
    totalCost,
    errorCount,
    lastError,
    lastUsed,
  };
}

/**
 * Get aggregated metrics across all providers for a feature
 */
export async function getFeatureMetrics(
  feature: string,
  windowHours: number = METRICS_WINDOW_HOURS
): Promise<Record<string, AIMetrics>> {
  const providers = ["gemini", "openrouter_free", "openrouter_paid", "deepseek"];
  const metrics: Record<string, AIMetrics> = {};

  for (const provider of providers) {
    metrics[provider] = await getProviderMetrics(provider, feature, windowHours);
  }

  return metrics;
}

/**
 * Get system-wide AI metrics across all features
 */
export async function getSystemMetrics(
  windowHours: number = METRICS_WINDOW_HOURS
): Promise<Record<string, Record<string, AIMetrics>>> {
  const features = ["chat", "ncm_classification", "life_agent", "ocr"];
  const systemMetrics: Record<string, Record<string, AIMetrics>> = {};

  for (const feature of features) {
    systemMetrics[feature] = await getFeatureMetrics(feature, windowHours);
  }

  return systemMetrics;
}

/**
 * Track consecutive failures for a provider/feature combo
 */
const consecutiveFailures = new Map<string, number>();

export function recordFailure(provider: string, feature: string): number {
  const key = `${provider}:${feature}`;
  const current = consecutiveFailures.get(key) || 0;
  const updated = current + 1;
  consecutiveFailures.set(key, updated);
  return updated;
}

export function recordSuccess(provider: string, feature: string): void {
  const key = `${provider}:${feature}`;
  consecutiveFailures.delete(key);
}

// --- Alerting ---

/**
 * Check if we should alert based on cooldown
 */
function shouldAlert(alertKey: string): boolean {
  const lastAlert = alertCooldowns.get(alertKey);
  if (!lastAlert) return true;

  const elapsed = Date.now() - lastAlert;
  return elapsed > ALERT_COOLDOWN_MS;
}

/**
 * Mark alert as sent to prevent spam
 */
function markAlerted(alertKey: string): void {
  alertCooldowns.set(alertKey, Date.now());
}

/**
 * Send alert via Telegram
 */
async function sendAlert(alert: AIAlert): Promise<void> {
  const emoji = alert.severity === "critical" ? "🚨" : "⚠️";
  const message = `${emoji} **AI Provider Alert**

**Severity**: ${alert.severity.toUpperCase()}
**Provider**: ${alert.provider}
**Feature**: ${alert.feature}
**Message**: ${alert.message}

**Time**: ${alert.timestamp.toLocaleString("pt-BR")}
${
  alert.metrics
    ? `
**Metrics**:
- Error Rate: ${((1 - (alert.metrics.successRate || 0)) * 100).toFixed(1)}%
- Avg Latency: ${alert.metrics.avgLatencyMs?.toFixed(0)}ms
- Total Cost: $${alert.metrics.totalCost?.toFixed(4)}
`
    : ""
}`;

  try {
    await sendTelegramNotification(message);
    console.log(`[AI_METRICS] Alert sent: ${alert.provider}/${alert.feature} - ${alert.message}`);
  } catch (error) {
    console.error("[AI_METRICS] Failed to send alert:", error);
  }
}

/**
 * Check metrics and trigger alerts if thresholds exceeded
 */
export async function checkAndAlert(
  provider: string,
  feature: string
): Promise<void> {
  const metrics = await getProviderMetrics(provider, feature);
  const alerts: AIAlert[] = [];

  // Check error rate
  if (metrics.totalRequests >= 10 && metrics.successRate < (1 - ALERT_THRESHOLDS.errorRate)) {
    const alertKey = `error_rate:${provider}:${feature}`;
    if (shouldAlert(alertKey)) {
      alerts.push({
        severity: "critical",
        provider,
        feature,
        message: `High error rate: ${((1 - metrics.successRate) * 100).toFixed(1)}% (threshold: ${ALERT_THRESHOLDS.errorRate * 100}%)`,
        metrics,
        timestamp: new Date(),
      });
      markAlerted(alertKey);
    }
  }

  // Check latency
  if (metrics.totalRequests > 0 && metrics.avgLatencyMs > ALERT_THRESHOLDS.latencyMs) {
    const alertKey = `latency:${provider}:${feature}`;
    if (shouldAlert(alertKey)) {
      alerts.push({
        severity: "warning",
        provider,
        feature,
        message: `High latency: ${metrics.avgLatencyMs.toFixed(0)}ms (threshold: ${ALERT_THRESHOLDS.latencyMs}ms)`,
        metrics,
        timestamp: new Date(),
      });
      markAlerted(alertKey);
    }
  }

  // Check daily cost
  if (metrics.totalCost > ALERT_THRESHOLDS.costDaily) {
    const alertKey = `cost:${provider}:${feature}`;
    if (shouldAlert(alertKey)) {
      alerts.push({
        severity: "warning",
        provider,
        feature,
        message: `Daily cost exceeded: $${metrics.totalCost.toFixed(4)} (threshold: $${ALERT_THRESHOLDS.costDaily})`,
        metrics,
        timestamp: new Date(),
      });
      markAlerted(alertKey);
    }
  }

  // Check consecutive failures
  const failures = consecutiveFailures.get(`${provider}:${feature}`) || 0;
  if (failures >= ALERT_THRESHOLDS.consecutiveFailures) {
    const alertKey = `consecutive:${provider}:${feature}`;
    if (shouldAlert(alertKey)) {
      alerts.push({
        severity: "critical",
        provider,
        feature,
        message: `${failures} consecutive failures detected`,
        metrics,
        timestamp: new Date(),
      });
      markAlerted(alertKey);
    }
  }

  // Send all alerts
  for (const alert of alerts) {
    await sendAlert(alert);
  }
}

/**
 * Scheduled job to check all providers/features
 */
export async function runMetricsCheck(): Promise<void> {
  const features = ["chat", "ncm_classification", "life_agent", "ocr"];
  const providers = ["gemini", "openrouter_free", "openrouter_paid", "deepseek"];

  console.log("[AI_METRICS] Running scheduled metrics check...");

  for (const feature of features) {
    for (const provider of providers) {
      try {
        await checkAndAlert(provider, feature);
      } catch (error) {
        console.error(`[AI_METRICS] Check failed for ${provider}/${feature}:`, error);
      }
    }
  }

  console.log("[AI_METRICS] Metrics check completed");
}

/**
 * Get summary dashboard data
 */
export async function getMetricsDashboard(): Promise<{
  overall: {
    totalRequests: number;
    overallSuccessRate: number;
    totalCost: number;
    avgLatencyMs: number;
  };
  byFeature: Record<string, AIMetrics>;
  byProvider: Record<string, AIMetrics>;
  alerts: AIAlert[];
}> {
  const systemMetrics = await getSystemMetrics();

  // Aggregate overall stats
  const allMetrics: AIMetrics[] = [];
  for (const feature of Object.keys(systemMetrics)) {
    for (const provider of Object.keys(systemMetrics[feature])) {
      allMetrics.push(systemMetrics[feature][provider]);
    }
  }

  const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const totalSuccess = allMetrics.reduce(
    (sum, m) => sum + m.totalRequests * m.successRate,
    0
  );
  const overallSuccessRate = totalRequests > 0 ? totalSuccess / totalRequests : 0;
  const totalCost = allMetrics.reduce((sum, m) => sum + m.totalCost, 0);
  const avgLatencyMs =
    allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.avgLatencyMs, 0) / allMetrics.length
      : 0;

  // Aggregate by feature
  const byFeature: Record<string, AIMetrics> = {};
  for (const [feature, providers] of Object.entries(systemMetrics)) {
    const featureMetrics = Object.values(providers);
    const requests = featureMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const success = featureMetrics.reduce(
      (sum, m) => sum + m.totalRequests * m.successRate,
      0
    );
    const latency =
      featureMetrics.reduce((sum, m) => sum + m.avgLatencyMs * m.totalRequests, 0) /
      (requests || 1);

    byFeature[feature] = {
      provider: "all",
      feature,
      totalRequests: requests,
      successRate: requests > 0 ? success / requests : 0,
      avgLatencyMs: latency,
      totalCost: featureMetrics.reduce((sum, m) => sum + m.totalCost, 0),
      errorCount: featureMetrics.reduce((sum, m) => sum + m.errorCount, 0),
    };
  }

  // Aggregate by provider
  const byProvider: Record<string, AIMetrics> = {};
  const providers = ["gemini", "openrouter_free", "openrouter_paid", "deepseek"];
  for (const provider of providers) {
    const providerMetrics: AIMetrics[] = [];
    for (const feature of Object.keys(systemMetrics)) {
      providerMetrics.push(systemMetrics[feature][provider]);
    }

    const requests = providerMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const success = providerMetrics.reduce(
      (sum, m) => sum + m.totalRequests * m.successRate,
      0
    );
    const latency =
      providerMetrics.reduce((sum, m) => sum + m.avgLatencyMs * m.totalRequests, 0) /
      (requests || 1);

    byProvider[provider] = {
      provider,
      feature: "all",
      totalRequests: requests,
      successRate: requests > 0 ? success / requests : 0,
      avgLatencyMs: latency,
      totalCost: providerMetrics.reduce((sum, m) => sum + m.totalCost, 0),
      errorCount: providerMetrics.reduce((sum, m) => sum + m.errorCount, 0),
    };
  }

  return {
    overall: {
      totalRequests,
      overallSuccessRate,
      totalCost,
      avgLatencyMs,
    },
    byFeature,
    byProvider,
    alerts: [], // Could extend to return recent alerts from DB
  };
}
