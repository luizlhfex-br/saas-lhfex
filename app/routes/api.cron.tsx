import type { Route } from "./+types/api.cron";
import { requireAuth } from "~/lib/auth.server";
import { triggerCronJob, listCronJobs } from "~/lib/cron.server";
import { data } from "react-router";

/**
 * API endpoint to manually trigger cron jobs (development/testing)
 * GET /api/cron?job=job_name — list or trigger a specific job
 */

export async function loader({ request }: Route.LoaderArgs) {
  // Protect with auth
  const { user } = await requireAuth(request);
  
  // Only allow admins or specific users
  if (user.email !== process.env.ADMIN_EMAIL) {
    return data({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const job = url.searchParams.get("job");

  if (!job) {
    // List all available cron jobs
    const jobs = listCronJobs();
    return data({ jobs, message: "Available cron jobs. Use ?job=name to trigger." });
  }

  // Trigger specific job
  try {
    await triggerCronJob(job);
    return data({
      ok: true,
      job,
      message: `Cron job "${job}" triggered successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Unknown error", job },
      { status: 400 }
    );
  }
}
