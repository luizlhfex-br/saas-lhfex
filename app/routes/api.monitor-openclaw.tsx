/**
 * GET /api/monitor-openclaw
 *
 * Health check do runtime de agentes.
 * Primeiro tenta o gateway HTTP legado. Se ele nao responder,
 * faz fallback para a fundacao de observabilidade, que cobre o Hermes.
 */

import { data } from "react-router";
import type { Route } from "./+types/api.monitor-openclaw";
import { getPrimaryCompanyId } from "~/lib/company-context.server";
import { getOpenClawObservabilitySnapshot } from "~/lib/openclaw-observability.server";

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL;
const OPENCLAW_BOT_TOKEN = process.env.TELEGRAM_OPENCLAW_BOT_TOKEN;
const LUIZ_CHAT_ID = process.env.TELEGRAM_LUIZ_CHAT_ID;
const OPENCLAW_USER_ID = process.env.OPENCLAW_USER_ID;
const HEARTBEAT_MAX_AGE_MINUTES = Number(process.env.OPENCLAW_MONITOR_MAX_HEARTBEAT_AGE_MINUTES || "1440");
const HEARTBEAT_MAX_AGE_MS = HEARTBEAT_MAX_AGE_MINUTES * 60 * 1000;

let lastAlertSentAt = 0;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

type GatewayProbeResult = {
  ok: boolean;
  reason?: string;
  status?: number;
  checkedAt: string;
  source: "gateway";
};

type HeartbeatProbeResult = {
  ok: boolean;
  reason?: string;
  checkedAt: string;
  source: "observability";
  heartbeat?: {
    agentId: string;
    agentName: string | null;
    status: string;
    provider: string | null;
    model: string | null;
    checkedAt: string;
    ageMinutes: number;
  };
};

export async function loader({ request }: Route.LoaderArgs) {
  if (request.method !== "GET") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const gatewayProbe = await probeGateway();
  if (gatewayProbe.ok) {
    return data({
      ok: true,
      openclaw: "online",
      runtime: "gateway",
      checkedAt: gatewayProbe.checkedAt,
      source: gatewayProbe.source,
    });
  }

  const heartbeatProbe = await probeObservability();
  if (heartbeatProbe.ok) {
    return data({
      ok: true,
      openclaw: "online",
      runtime: "observability",
      checkedAt: heartbeatProbe.checkedAt,
      source: heartbeatProbe.source,
      gatewayProbe: gatewayProbe.ok ? null : { status: gatewayProbe.status ?? null, reason: gatewayProbe.reason ?? null },
      heartbeat: heartbeatProbe.heartbeat ?? null,
    });
  }

  const reason = heartbeatProbe.reason ?? gatewayProbe.reason ?? "monitor_unavailable";
  await sendOfflineAlert(reason);

  return data(
    {
      ok: false,
      openclaw: "offline",
      reason,
      checkedAt: new Date().toISOString(),
      gatewayProbe: gatewayProbe.ok ? null : { status: gatewayProbe.status ?? null, reason: gatewayProbe.reason ?? null },
      heartbeat: heartbeatProbe.heartbeat ?? null,
    },
    { status: 503 }
  );
}

async function probeGateway(): Promise<GatewayProbeResult> {
  const checkedAt = new Date().toISOString();

  if (!OPENCLAW_GATEWAY_URL) {
    return {
      ok: false,
      reason: "OPENCLAW_GATEWAY_URL not configured",
      checkedAt,
      source: "gateway",
    };
  }

  try {
    const healthUrl = new URL("/health", OPENCLAW_GATEWAY_URL).toString();
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        checkedAt,
        source: "gateway",
      };
    }

    return {
      ok: false,
      reason: `HTTP ${res.status}`,
      status: res.status,
      checkedAt,
      source: "gateway",
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "gateway_unreachable",
      checkedAt,
      source: "gateway",
    };
  }
}

async function probeObservability(): Promise<HeartbeatProbeResult> {
  const checkedAt = new Date().toISOString();

  if (!OPENCLAW_USER_ID) {
    return {
      ok: false,
      reason: "OPENCLAW_USER_ID not configured",
      checkedAt,
      source: "observability",
    };
  }

  try {
    const companyId = await getPrimaryCompanyId(OPENCLAW_USER_ID);
    const snapshot = await getOpenClawObservabilitySnapshot(companyId);
    const latest = [...snapshot.latestHeartbeatsByAgent]
      .sort((left, right) => right.checkedAt.getTime() - left.checkedAt.getTime())[0];

    if (!latest) {
      return {
        ok: false,
        reason: "No heartbeat recorded",
        checkedAt,
        source: "observability",
      };
    }

    const ageMs = Date.now() - latest.checkedAt.getTime();
    const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
    const heartbeat = {
      agentId: latest.agentId,
      agentName: latest.agentName ?? null,
      status: latest.status,
      provider: latest.provider ?? null,
      model: latest.model ?? null,
      checkedAt: latest.checkedAt.toISOString(),
      ageMinutes,
    };

    if (latest.status !== "offline" && ageMs <= HEARTBEAT_MAX_AGE_MS) {
      return {
        ok: true,
        checkedAt,
        source: "observability",
        heartbeat,
      };
    }

    return {
      ok: false,
      reason:
        latest.status === "offline"
          ? `Latest heartbeat offline (${latest.agentId})`
          : `Latest heartbeat too old (${ageMinutes} min)`,
      checkedAt,
      source: "observability",
      heartbeat,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "observability_unreachable",
      checkedAt,
      source: "observability",
    };
  }
}

async function sendOfflineAlert(reason: string) {
  const now = Date.now();
  if (now - lastAlertSentAt < ALERT_COOLDOWN_MS) return;
  if (!OPENCLAW_BOT_TOKEN || !LUIZ_CHAT_ID) return;

  lastAlertSentAt = now;

  const message = [
    "OpenClaw/Hermes OFFLINE",
    "",
    `Motivo: ${reason}`,
    `Detectado: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} BRT`,
    "",
    "Verifique o runtime de agentes no VPS.",
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${OPENCLAW_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: LUIZ_CHAT_ID, text: message }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // non-blocking
  }
}
