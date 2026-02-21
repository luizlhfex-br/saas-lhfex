import { data } from "react-router";
import type { Route } from "./+types/api.automations-notify-failure";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automationLogs, automations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const logId = formData.get("logId") as string;
  const notifyVia = (formData.get("notifyVia") || "notification").toString();

  if (!logId) {
    return data({ error: "logId is required" }, { status: 400 });
  }

  const [log] = await db
    .select({
      id: automationLogs.id,
      automationId: automationLogs.automationId,
      status: automationLogs.status,
      errorMessage: automationLogs.errorMessage,
    })
    .from(automationLogs)
    .where(eq(automationLogs.id, logId))
    .limit(1);

  if (!log) {
    return data({ error: "Log not found" }, { status: 404 });
  }

  const [automation] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, log.automationId))
    .limit(1);

  if (!automation) {
    return data({ error: "Automation not found" }, { status: 404 });
  }

  const message = `Falha na automação "${automation.name}": ${log.errorMessage || "Erro desconhecido"}`;

  let notificationResult: Record<string, unknown> = {
    ok: true,
    logId,
    message,
    channel: notifyVia,
  };

  switch (notifyVia) {
    case "telegram":
      notificationResult.botMessage = message;
      notificationResult.sentTo = process.env.TELEGRAM_ADMIN_USERS;
      break;
    case "email":
      notificationResult.emailTo = user.email;
      notificationResult.emailSubject = `Falha da automação: ${automation.name}`;
      break;
    case "notification":
    default:
      notificationResult.notificationType = "automation_failure";
      notificationResult.recipientId = user.id;
  }

  return data({
    ...notificationResult,
    timestamp: new Date().toISOString(),
  });
}
