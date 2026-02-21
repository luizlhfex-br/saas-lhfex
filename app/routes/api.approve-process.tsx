import { data } from "react-router";
import type { Route } from "./+types/api.approve-process";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processes, processTimeline } from "../../drizzle/schema";
import { logAudit } from "~/lib/audit.server";
import { eq } from "drizzle-orm";
import { fireTrigger } from "~/lib/automation-engine.server";

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const processId = formData.get("processId") as string;
  const action_type = formData.get("action") as string; // "approve" or "reject"
  const notes = formData.get("notes") as string;

  if (!processId || !action_type) {
    return data({ error: "Missing required fields" }, { status: 400 });
  }

  const [proc] = await db.select().from(processes).where(eq(processes.id, processId)).limit(1);
  if (!proc) {
    return data({ error: "Process not found" }, { status: 404 });
  }

  if (proc.status !== "pending_approval") {
    return data({ error: "Process is not pending approval" }, { status: 400 });
  }

  if (action_type === "approve") {
    await db.update(processes).set({
      status: "in_progress",
      approvedBy: user.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(processes.id, processId));

    await db.insert(processTimeline).values({
      processId,
      status: "in_progress",
      title: "Processo aprovado",
      description: notes || `Aprovado por ${user.name}`,
      createdBy: user.id,
    });

    try {
      await fireTrigger({
        type: "process_status_change",
        userId: user.id,
        data: {
          processId,
          processRef: proc.reference,
          oldStatus: "pending_approval",
          newStatus: "in_progress",
        },
      });
    } catch (error) {
      console.error("[AUTOMATION] Failed to fire process_status_change trigger:", error);
    }
  } else {
    await db.update(processes).set({
      status: "draft",
      updatedAt: new Date(),
    }).where(eq(processes.id, processId));

    await db.insert(processTimeline).values({
      processId,
      status: "draft",
      title: "Aprovacao rejeitada",
      description: notes || `Rejeitado por ${user.name}`,
      createdBy: user.id,
    });

    try {
      await fireTrigger({
        type: "process_status_change",
        userId: user.id,
        data: {
          processId,
          processRef: proc.reference,
          oldStatus: "pending_approval",
          newStatus: "draft",
        },
      });
    } catch (error) {
      console.error("[AUTOMATION] Failed to fire process_status_change trigger:", error);
    }
  }

  await logAudit({
    userId: user.id,
    action: "update",
    entity: "process",
    entityId: processId,
    changes: { action: action_type, notes, previousStatus: "pending_approval" },
    request,
  });

  return data({ success: true, action: action_type });
}
