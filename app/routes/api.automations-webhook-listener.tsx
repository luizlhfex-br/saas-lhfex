import { data } from "react-router";
import type { Route } from "./+types/api.automations-webhook-listener";
import { db } from "~/lib/db.server";
import { automationLogs, automations } from "../../drizzle/schema";
import { buildApiError } from "~/lib/api-error";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "~/lib/rate-limit.server";
import { hasValidAutomationsWebhookRequest } from "~/lib/webhook-security.server";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { logAudit } from "~/lib/audit.server";

const automationWebhookSchema = z.object({
  automationId: z.uuid(),
  status: z.enum(["success", "error", "skipped"]).default("success"),
  input: z.record(z.string(), z.unknown()).default({}),
  errorMessage: z.string().max(4000).nullable().optional(),
});

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data(buildApiError("METHOD_NOT_ALLOWED", "Method not allowed"), { status: 405 });
  }

  const ip = getClientIP(request);
  const rateCheck = await checkRateLimit(
    `automations-webhook:${ip}`,
    RATE_LIMITS.generalApi.maxAttempts,
    RATE_LIMITS.generalApi.windowMs,
  );

  if (!rateCheck.allowed) {
    return data(
      buildApiError("RATE_LIMITED", "Too many webhook requests", {
        retryAfter: rateCheck.retryAfterSeconds,
      }),
      { status: 429 },
    );
  }

  const rawPayload = await request.text();
  if (!hasValidAutomationsWebhookRequest(request, rawPayload)) {
    await logAudit({
      userId: null,
      action: "access_denied",
      entity: "webhook_event",
      details: {
        source: "automations_webhook_listener",
        ip,
      },
      request,
    });

    return data(buildApiError("UNAUTHORIZED", "Invalid webhook signature"), { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return data(buildApiError("INVALID_INPUT", "Malformed JSON payload"), { status: 400 });
  }

  const parsed = automationWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return data(
      buildApiError("INVALID_INPUT", "Invalid webhook payload", {
        details: parsed.error.flatten(),
      }),
      { status: 400 },
    );
  }

  const { automationId, status, input, errorMessage } = parsed.data;

  const [automation] = await db
    .select({
      id: automations.id,
      companyId: automations.companyId,
    })
    .from(automations)
    .where(eq(automations.id, automationId))
    .limit(1);

  if (!automation) {
    return data(buildApiError("INVALID_INPUT", "Automation not found"), { status: 404 });
  }

  const [log] = await db
    .insert(automationLogs)
    .values({
      automationId,
      status: status as any,
      input,
      output: {
        source: "webhook_listener",
        externalEvent: true,
      },
      errorMessage: errorMessage ?? null,
    })
    .returning({ id: automationLogs.id });

  await logAudit({
    userId: null,
    action: "trigger",
    entity: "webhook_event",
    entityId: log.id,
    changes: {
      automationId,
      companyId: automation.companyId,
      status,
      source: "webhook_listener",
    },
    request,
  });

  return data(
    {
      ok: true,
      logId: log.id,
      message: "Webhook event logged",
      timestamp: new Date().toISOString(),
    },
    { status: 201 },
  );
}
