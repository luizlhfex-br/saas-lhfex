import { data } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { triggerCronJob, listCronJobs } from "~/lib/cron.server";
import { logAudit } from "~/lib/audit.server";
import { getClientIP } from "~/lib/rate-limit.server";
import { canManageGlobalAutomations } from "~/lib/rbac.server";

function getAdminEmails(): Set<string> {
  const entries = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const fallback = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (fallback) {
    entries.push(fallback);
  }

  return new Set(entries);
}

function canAccessCronControls(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return getAdminEmails().has(normalizedEmail) || canManageGlobalAutomations(normalizedEmail);
}

async function denyCronAccess(request: Request, userId: string, email: string) {
  await logAudit({
    userId,
    action: "access_denied",
    entity: "cron_job",
    details: {
      email,
      ip: getClientIP(request),
      method: request.method,
    },
    request,
  });
}

export async function loader({ request }: { request: Request }) {
  const { user } = await requireAuth(request);

  if (!canAccessCronControls(user.email)) {
    await denyCronAccess(request, user.id, user.email);
    return data({ error: "Unauthorized" }, { status: 403 });
  }

  const jobs = listCronJobs();
  return data({ jobs, message: "Available cron jobs. Use POST to trigger a job." });
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireAuth(request);

  if (!canAccessCronControls(user.email)) {
    await denyCronAccess(request, user.id, user.email);
    return data({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const job = String(formData.get("job") || "").trim();
  if (!job) {
    return data({ error: "job is required" }, { status: 400 });
  }

  try {
    await triggerCronJob(job);
    await logAudit({
      userId: user.id,
      action: "trigger",
      entity: "cron_job",
      changes: { job },
      request,
    });

    return data({
      ok: true,
      job,
      message: `Cron job "${job}" triggered successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Unknown error", job },
      { status: 400 },
    );
  }
}
