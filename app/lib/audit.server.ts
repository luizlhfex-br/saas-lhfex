import { db } from "./db.server";
import { auditLogs } from "drizzle/schema";

interface AuditParams {
  userId: string | null;
  action:
    | "create"
    | "update"
    | "delete"
    | "upload"
    | "download"
    | "login"
    | "logout"
    | "cleanup"
    | "login_failed"
    | "login_blocked";
  entity: "client" | "contact" | "process" | "invoice" | "document" | "user" | "session" | "automation_log";
  entityId?: string;
  changes?: Record<string, unknown>;
  details?: Record<string, unknown>;
  request?: Request;
}

export async function logAudit({ userId, action, entity, entityId, changes, details, request }: AuditParams): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (request) {
      ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || null;
      userAgent = request.headers.get("user-agent") || null;
    }

    await db.insert(auditLogs).values({
      userId: userId || "system",
      action,
      entity,
      entityId: entityId || null,
      changes: (changes || details) || null,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("[AUDIT] Failed to log:", error);
  }
}
