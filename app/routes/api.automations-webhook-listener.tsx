import { data } from "react-router";
import type { Route } from "./+types/api.automations-webhook-listener";
import { db } from "~/lib/db.server";
import { automationLogs } from "../../drizzle/schema";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const payload = await request.json();
  const { automationId, status = "success", input = {}, errorMessage } = payload;

  if (!automationId) {
    return data({ error: "automationId is required" }, { status: 400 });
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
      errorMessage: errorMessage || null,
    })
    .returning({ id: automationLogs.id });

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
