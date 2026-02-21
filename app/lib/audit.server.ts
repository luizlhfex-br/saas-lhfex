import { db } from "./db.server";
import { auditLogs } from "drizzle/schema";

interface AuditParams {
  userId: string;
  action: "create" | "update" | "delete" | "upload" | "download" | "login" | "logout" | "cleanup";
  entity: "client" | "contact" | "process" | "invoice" | "document" | "user" | "session" | "automation_log";
  entityId?: string;
  changes?: Record<string, unknown>;
  request?: Request;
}

export async function logAudit({ userId, action, entity, entityId, changes, request }: AuditParams): Promise<void> {
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
      userId,
      action,
      entity,
      entityId: entityId || null,
      changes: changes || null,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("[AUDIT] Failed to log:", error);
  }
}
