import { data } from "react-router";
import type { Route } from "./+types/api.automations-logs";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { automationLogs, automations } from "../../drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";

function escapeCsv(value: unknown): string {
  const raw = String(value ?? "");
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const mode = (url.searchParams.get("mode") || "all").toLowerCase();
  const status = (url.searchParams.get("status") || "all").toLowerCase();
  const period = (url.searchParams.get("period") || "7d").toLowerCase();
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "10", 10), 5), 50);
  const offset = (page - 1) * pageSize;

  const whereClauses = [] as any[];

  const now = new Date();
  let periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "24h") {
    periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === "30d") {
    periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  whereClauses.push(sql`${automationLogs.executedAt} >= ${periodStart}`);

  if (mode === "manual") {
    whereClauses.push(sql`${automationLogs.input} ->> '_manualRun' = 'true'`);
  } else if (mode === "automatic") {
    whereClauses.push(sql`coalesce(${automationLogs.input} ->> '_manualRun', 'false') != 'true'`);
  }

  if (status === "success" || status === "error" || status === "skipped") {
    whereClauses.push(eq(automationLogs.status, status as any));
  }

  if (q) {
    const qLike = `%${q.toLowerCase()}%`;
    whereClauses.push(
      sql`(
        lower(coalesce(${automations.name}, '')) like ${qLike}
        or lower(coalesce(${automationLogs.status}::text, '')) like ${qLike}
        or lower(coalesce(${automationLogs.errorMessage}, '')) like ${qLike}
      )`,
    );
  }

  const whereExpr = whereClauses.length > 0 ? and(...whereClauses) : undefined;

  const query = db
    .select({
      id: automationLogs.id,
      automationId: automationLogs.automationId,
      automationName: automations.name,
      status: automationLogs.status,
      input: automationLogs.input,
      errorMessage: automationLogs.errorMessage,
      executedAt: automationLogs.executedAt,
    })
    .from(automationLogs)
    .leftJoin(automations, eq(automationLogs.automationId, automations.id))
    .where(whereExpr)
    .orderBy(desc(automationLogs.executedAt));

  if (format === "csv") {
    const csvRows = await query.limit(1000);
    const header = ["id", "automationId", "automationName", "status", "mode", "executedAt", "errorMessage"];
    const lines = csvRows.map((row) => {
      const modeLabel = (row.input as any)?._manualRun ? "manual" : "automatic";
      return [
        escapeCsv(row.id),
        escapeCsv(row.automationId),
        escapeCsv(row.automationName || ""),
        escapeCsv(row.status),
        escapeCsv(modeLabel),
        escapeCsv(row.executedAt ? new Date(row.executedAt).toISOString() : ""),
        escapeCsv(row.errorMessage || ""),
      ].join(",");
    });

    const csv = [header.join(","), ...lines].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=automations-logs.csv",
        "Cache-Control": "no-store",
      },
    });
  }

  const rows = await query.limit(pageSize + 1).offset(offset);

  const metricRows = await query.limit(500);

  const totalExecutions = metricRows.length;
  const successCount = metricRows.filter((row) => row.status === "success").length;
  const errorCount = metricRows.filter((row) => row.status === "error").length;
  const skippedCount = metricRows.filter((row) => row.status === "skipped").length;
  const manualCount = metricRows.filter((row) => Boolean((row.input as any)?._manualRun)).length;

  const sortedAsc = [...metricRows].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
  );

  let averageIntervalMinutes = 0;
  if (sortedAsc.length >= 2) {
    let totalDiffMs = 0;
    for (let i = 1; i < sortedAsc.length; i++) {
      totalDiffMs += new Date(sortedAsc[i].executedAt).getTime() - new Date(sortedAsc[i - 1].executedAt).getTime();
    }
    averageIntervalMinutes = Math.round(totalDiffMs / (sortedAsc.length - 1) / 60000);
  }

  const errorWhere = whereExpr
    ? and(whereExpr, eq(automationLogs.status, "error" as any))
    : eq(automationLogs.status, "error" as any);

  const topErrorAutomations = await db
    .select({
      automationId: automationLogs.automationId,
      automationName: automations.name,
      errors: sql<number>`count(*)::int`,
    })
    .from(automationLogs)
    .leftJoin(automations, eq(automationLogs.automationId, automations.id))
    .where(errorWhere)
    .groupBy(automationLogs.automationId, automations.name)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const hasNext = rows.length > pageSize;
  const logs = hasNext ? rows.slice(0, pageSize) : rows;

  return data({
    logs,
    page,
    pageSize,
    hasPrev: page > 1,
    hasNext,
    mode,
    status,
    period,
    q,
    metrics: {
      totalExecutions,
      successCount,
      errorCount,
      skippedCount,
      manualCount,
      automaticCount: Math.max(totalExecutions - manualCount, 0),
      errorRate: totalExecutions > 0 ? Number(((errorCount / totalExecutions) * 100).toFixed(1)) : 0,
      successRate: totalExecutions > 0 ? Number(((successCount / totalExecutions) * 100).toFixed(1)) : 0,
      averageIntervalMinutes,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
    },
    topErrorAutomations,
  });
}
