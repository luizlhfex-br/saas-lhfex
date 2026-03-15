/**
 * GET /api/monitor-openclaw
 *
 * Health check endpoint para o OpenClaw gateway.
 * Pode ser registrado no UptimeRobot / BetterUptime / Coolify Health Check
 * para receber alerta se o OpenClaw cair.
 *
 * Retorna 200 { ok: true, openclaw: "online" } se online
 * Retorna 503 { ok: false, openclaw: "offline" } se offline
 * E envia alerta via Telegram se offline.
 */

import { data } from "react-router";
import type { Route } from "./+types/api.monitor-openclaw";

// Coolify expõe o OpenClaw internamente via OPENCLAW_GATEWAY_URL
// ex: http://openclaw-ai:18789 (Docker network) ou URL pública
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL;

// Para enviar alerta se offline
const OPENCLAW_BOT_TOKEN = process.env.TELEGRAM_OPENCLAW_BOT_TOKEN;
const LUIZ_CHAT_ID = process.env.TELEGRAM_LUIZ_CHAT_ID;

// Evita spam de alertas — controle em memória (reseta a cada restart)
let lastAlertSentAt = 0;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min entre alertas

export async function loader({ request }: Route.LoaderArgs) {
  // Aceita apenas GET — protege contra bots randômicos
  if (request.method !== "GET") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  if (!OPENCLAW_GATEWAY_URL) {
    // Sem URL configurada, retorna unknown — não é erro fatal
    return data({
      ok: true,
      openclaw: "unknown",
      reason: "OPENCLAW_GATEWAY_URL not configured",
    });
  }

  try {
    const healthUrl = new URL("/health", OPENCLAW_GATEWAY_URL).toString();
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return data({
        ok: true,
        openclaw: "online",
        checkedAt: new Date().toISOString(),
        checkedUrl: healthUrl,
      });
    }

    // Resposta com erro HTTP
    await sendOfflineAlert(`HTTP ${res.status}`);
    return data(
      {
        ok: false,
        openclaw: "offline",
        reason: `HTTP ${res.status}`,
        checkedAt: new Date().toISOString(),
        checkedUrl: healthUrl,
      },
      { status: 503 }
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : "timeout";
    await sendOfflineAlert(reason);
    return data(
      {
        ok: false,
        openclaw: "offline",
        reason,
        checkedAt: new Date().toISOString(),
        checkedUrl: OPENCLAW_GATEWAY_URL,
      },
      { status: 503 }
    );
  }
}

async function sendOfflineAlert(reason: string) {
  const now = Date.now();
  if (now - lastAlertSentAt < ALERT_COOLDOWN_MS) return; // cooldown
  if (!OPENCLAW_BOT_TOKEN || !LUIZ_CHAT_ID) return;

  lastAlertSentAt = now;

  const msg = `🔴 *OpenClaw OFFLINE*\n\nMotivo: \`${reason}\`\nDetectado: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} BRT\n\nVerifique o container no Coolify.`;

  try {
    await fetch(`https://api.telegram.org/bot${OPENCLAW_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: LUIZ_CHAT_ID, text: msg, parse_mode: "Markdown" }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silent — se o Telegram falhar também, não há o que fazer
  }
}
