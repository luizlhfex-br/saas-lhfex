import { data } from "react-router";
import type { Route } from "./+types/api.automations-test-webhook";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const automationId = formData.get("automationId") as string;

  if (!automationId) {
    return data({ error: "automationId is required" }, { status: 400 });
  }

  const [automation] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, automationId))
    .limit(1);

  if (!automation) {
    return data({ error: "Automation not found" }, { status: 404 });
  }

  if (automation.actionType !== "webhook") {
    return data(
      { error: "This automation is not a webhook action" },
      { status: 400 },
    );
  }

  const webhookUrl = (automation.actionConfig as any)?.url;
  if (!webhookUrl) {
    return data({ error: "Webhook URL not configured" }, { status: 400 });
  }

  const testPayload = {
    test: true,
    automationId,
    automationName: automation.name,
    timestamp: new Date().toISOString(),
    triggerType: automation.triggerType,
  };

  let statusCode: number | null = null;
  let responseTime = 0;
  let success = false;
  let errorMessage: string | null = null;

  const startTime = Date.now();
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });
    responseTime = Date.now() - startTime;
    statusCode = response.status;
    success = response.ok;

    if (!response.ok) {
      errorMessage = `HTTP ${response.status}`;
    }
  } catch (error) {
    responseTime = Date.now() - startTime;
    errorMessage = error instanceof Error ? error.message : "Unknown error";
    statusCode = null;
  }

  return data({
    ok: success,
    automationId,
    webhookUrl: webhookUrl.substring(0, 100) + (webhookUrl.length > 100 ? "..." : ""),
    statusCode,
    responseTime,
    success,
    errorMessage,
    testPayload,
    timestamp: new Date().toISOString(),
  });
}
