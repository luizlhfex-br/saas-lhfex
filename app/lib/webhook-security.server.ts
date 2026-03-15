import { createHash, timingSafeEqual } from "crypto";

type TelegramWebhookKind = "saas" | "openclaw";

function safeCompare(expected: string | null, received: string | null): boolean {
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function buildDerivedTelegramSecret(prefix: TelegramWebhookKind, rawSecret: string): string {
  const digest = createHash("sha256")
    .update(`${prefix}:${rawSecret}`)
    .digest("hex");

  return `lhfex_${prefix}_${digest.slice(0, 48)}`;
}

export function getWebhookSetupKey(): string | null {
  return process.env.WEBHOOK_SETUP_KEY || process.env.OPENCLAW_TOOLS_API_KEY || null;
}

export function hasValidWebhookSetupRequest(request: Request): boolean {
  return safeCompare(getWebhookSetupKey(), request.headers.get("X-Webhook-Setup-Key"));
}

export function getTelegramWebhookSecret(kind: TelegramWebhookKind): string | null {
  const explicitSecret = kind === "saas"
    ? process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN
    : process.env.OPENCLAW_TELEGRAM_WEBHOOK_SECRET_TOKEN;

  if (explicitSecret) {
    return explicitSecret;
  }

  const fallbackSecret = process.env.OPENCLAW_TOOLS_API_KEY;
  if (!fallbackSecret) {
    return null;
  }

  return buildDerivedTelegramSecret(kind, fallbackSecret);
}

export function hasValidTelegramWebhookRequest(
  request: Request,
  kind: TelegramWebhookKind,
): boolean {
  return safeCompare(
    getTelegramWebhookSecret(kind),
    request.headers.get("X-Telegram-Bot-Api-Secret-Token"),
  );
}
