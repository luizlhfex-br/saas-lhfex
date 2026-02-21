import { data } from "react-router";
import type { Route } from "./+types/api.automations-cron-health";
import { requireAuth } from "~/lib/auth.server";
import { listCronJobs } from "~/lib/cron.server";
import { db } from "~/lib/db.server";
import { automationLogs } from "../../drizzle/schema";
import { desc, sql } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const jobs = listCronJobs();

  const jobsHealth = await Promise.all(
    jobs.map(async (job) => {
      const [lastExecution] = await db
        .select({
          executedAt: automationLogs.executedAt,
          status: automationLogs.status,
        })
        .from(automationLogs)
        .orderBy(desc(automationLogs.executedAt))
        .limit(1);

      const uptime = lastExecution?.executedAt
        ? Math.round((Date.now() - new Date(lastExecution.executedAt).getTime()) / 1000 / 60)
        : -1;

      return {
        name: job.name,
        expression: job.expression,
        status: uptime >= 0 ? "active" : "idle",
        lastRunMinutesAgo: uptime >= 0 ? uptime : null,
        lastExecutedAt: lastExecution?.executedAt || null,
      };
    }),
  );

  const successCount = jobsHealth.filter((j) => j.status === "active").length;

  return data({
    jobs: jobsHealth,
    totalJobs: jobs.length,
    activeJobs: successCount,
    healthStatus: successCount === jobs.length ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
  });
}
