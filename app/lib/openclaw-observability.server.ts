import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "~/lib/db.server";
import {
  openclawAgentHandoffs,
  openclawAgentHeartbeats,
  openclawAgentRuns,
  openclawAgentWorkItems,
} from "../../drizzle/schema";

type RecordJson = Record<string, unknown> | null;

type OpenClawRunStatus = "queued" | "running" | "success" | "error" | "skipped";
type OpenClawHeartbeatStatus = "healthy" | "degraded" | "offline";
type OpenClawHandoffStatus = "requested" | "accepted" | "completed" | "blocked";
type OpenClawWorkItemStatus = "backlog" | "ready" | "in_progress" | "blocked" | "review" | "done" | "archived";
type OpenClawWorkItemPriority = "low" | "medium" | "high" | "urgent";

export type OpenClawRunRecord = {
  id: string;
  companyId: string;
  agentId: string;
  agentName: string | null;
  agentRole: string | null;
  provider: string | null;
  model: string | null;
  status: string;
  input: RecordJson;
  output: RecordJson;
  errorMessage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
};

export type OpenClawHeartbeatRecord = {
  id: string;
  companyId: string;
  agentId: string;
  agentName: string | null;
  status: string;
  provider: string | null;
  model: string | null;
  summary: string | null;
  details: RecordJson;
  checkedAt: Date;
  createdAt: Date;
};

export type OpenClawHandoffRecord = {
  id: string;
  companyId: string;
  fromAgentId: string | null;
  toAgentId: string;
  status: string;
  objective: string;
  context: RecordJson;
  dataConsulted: RecordJson;
  expectedDelivery: string | null;
  criteria: string | null;
  riskKnown: string | null;
  result: RecordJson;
  createdAt: Date;
  completedAt: Date | null;
};

export type OpenClawWorkItemRecord = {
  id: string;
  companyId: string;
  agentId: string;
  processId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string | null;
  context: RecordJson;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OpenClawObservabilitySnapshot = {
  heartbeatCounts: {
    healthy: number;
    degraded: number;
    offline: number;
    total: number;
  };
  runCounts: {
    queued: number;
    running: number;
    success: number;
    error: number;
    skipped: number;
    total: number;
  };
  workItemCounts: {
    backlog: number;
    ready: number;
    inProgress: number;
    blocked: number;
    review: number;
    done: number;
    archived: number;
    total: number;
  };
  recentHeartbeats: OpenClawHeartbeatRecord[];
  recentRuns: OpenClawRunRecord[];
  recentHandoffs: OpenClawHandoffRecord[];
  recentWorkItems: OpenClawWorkItemRecord[];
  latestHeartbeatsByAgent: OpenClawHeartbeatRecord[];
};

function normalizeJson(value: unknown): RecordJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function recordOpenClawRun(input: {
  companyId: string;
  agentId: string;
  agentName?: string;
  agentRole?: string;
  provider?: string;
  model?: string;
  status?: string;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  startedAt?: Date;
  finishedAt?: Date | null;
  createdBy?: string | null;
}) {
  const [row] = await db
    .insert(openclawAgentRuns)
    .values({
      companyId: input.companyId,
      agentId: input.agentId,
      agentName: input.agentName ?? null,
      agentRole: input.agentRole ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      status: (input.status ?? "running") as OpenClawRunStatus,
      input: input.input ?? null,
      output: input.output ?? null,
      errorMessage: input.errorMessage ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      startedAt: input.startedAt ?? new Date(),
      finishedAt: input.finishedAt ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning({ id: openclawAgentRuns.id });

  return row;
}

export async function recordOpenClawHeartbeat(input: {
  companyId: string;
  agentId: string;
  agentName?: string;
  status?: string;
  provider?: string;
  model?: string;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  checkedAt?: Date;
  createdBy?: string | null;
}) {
  const [row] = await db
    .insert(openclawAgentHeartbeats)
    .values({
      companyId: input.companyId,
      agentId: input.agentId,
      agentName: input.agentName ?? null,
      status: (input.status ?? "healthy") as OpenClawHeartbeatStatus,
      provider: input.provider ?? null,
      model: input.model ?? null,
      summary: input.summary ?? null,
      details: input.details ?? null,
      checkedAt: input.checkedAt ?? new Date(),
      createdBy: input.createdBy ?? null,
    })
    .returning({ id: openclawAgentHeartbeats.id });

  return row;
}

export async function recordOpenClawHandoff(input: {
  companyId: string;
  fromAgentId?: string | null;
  toAgentId: string;
  status?: string;
  objective: string;
  context?: Record<string, unknown> | null;
  dataConsulted?: Record<string, unknown> | null;
  expectedDelivery?: string | null;
  criteria?: string | null;
  riskKnown?: string | null;
  result?: Record<string, unknown> | null;
  createdBy?: string | null;
  completedAt?: Date | null;
}) {
  const [row] = await db
    .insert(openclawAgentHandoffs)
    .values({
      companyId: input.companyId,
      fromAgentId: input.fromAgentId ?? null,
      toAgentId: input.toAgentId,
      status: (input.status ?? "requested") as OpenClawHandoffStatus,
      objective: input.objective,
      context: input.context ?? null,
      dataConsulted: input.dataConsulted ?? null,
      expectedDelivery: input.expectedDelivery ?? null,
      criteria: input.criteria ?? null,
      riskKnown: input.riskKnown ?? null,
      result: input.result ?? null,
      createdBy: input.createdBy ?? null,
      completedAt: input.completedAt ?? null,
    })
    .returning({ id: openclawAgentHandoffs.id });

  return row;
}

export async function recordOpenClawWorkItem(input: {
  companyId: string;
  agentId: string;
  processId?: string | null;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  source?: string | null;
  context?: Record<string, unknown> | null;
  dueAt?: Date | null;
  completedAt?: Date | null;
  createdBy?: string | null;
}) {
  const [row] = await db
    .insert(openclawAgentWorkItems)
    .values({
      companyId: input.companyId,
      agentId: input.agentId,
      processId: input.processId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: (input.status ?? "backlog") as OpenClawWorkItemStatus,
      priority: (input.priority ?? "medium") as OpenClawWorkItemPriority,
      source: input.source ?? null,
      context: input.context ?? null,
      dueAt: input.dueAt ?? null,
      completedAt: input.completedAt ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning({ id: openclawAgentWorkItems.id });

  return row;
}

export async function updateOpenClawWorkItem(input: {
  companyId: string;
  workItemId: string;
  status?: string;
  priority?: string;
  title?: string;
  description?: string | null;
  source?: string | null;
  context?: Record<string, unknown> | null;
  dueAt?: Date | null;
  completedAt?: Date | null;
}) {
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.status) updates.status = input.status;
  if (input.priority) updates.priority = input.priority;
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.source !== undefined) updates.source = input.source;
  if (input.context !== undefined) updates.context = input.context;
  if (input.dueAt !== undefined) updates.dueAt = input.dueAt;
  if (input.completedAt !== undefined) updates.completedAt = input.completedAt;

  await db
    .update(openclawAgentWorkItems)
    .set(updates)
    .where(and(eq(openclawAgentWorkItems.id, input.workItemId), eq(openclawAgentWorkItems.companyId, input.companyId)));
}

export async function getOpenClawObservabilitySnapshot(companyId: string): Promise<OpenClawObservabilitySnapshot> {
  const [heartbeats, runs, handoffs, workItems, runCounts, heartbeatCounts, workItemCounts] = await Promise.all([
    db
      .select()
      .from(openclawAgentHeartbeats)
      .where(eq(openclawAgentHeartbeats.companyId, companyId))
      .orderBy(desc(openclawAgentHeartbeats.checkedAt))
      .limit(30),
    db
      .select()
      .from(openclawAgentRuns)
      .where(eq(openclawAgentRuns.companyId, companyId))
      .orderBy(desc(openclawAgentRuns.startedAt))
      .limit(20),
    db
      .select()
      .from(openclawAgentHandoffs)
      .where(eq(openclawAgentHandoffs.companyId, companyId))
      .orderBy(desc(openclawAgentHandoffs.createdAt))
      .limit(20),
    db
      .select()
      .from(openclawAgentWorkItems)
      .where(and(eq(openclawAgentWorkItems.companyId, companyId), isNull(openclawAgentWorkItems.deletedAt)))
      .orderBy(desc(openclawAgentWorkItems.updatedAt))
      .limit(30),
    db
      .select({
        queued: sql<number>`count(*) filter (where status = 'queued')::int`,
        running: sql<number>`count(*) filter (where status = 'running')::int`,
        success: sql<number>`count(*) filter (where status = 'success')::int`,
        error: sql<number>`count(*) filter (where status = 'error')::int`,
        skipped: sql<number>`count(*) filter (where status = 'skipped')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(openclawAgentRuns)
      .where(eq(openclawAgentRuns.companyId, companyId)),
    db
      .select({
        healthy: sql<number>`count(*) filter (where status = 'healthy')::int`,
        degraded: sql<number>`count(*) filter (where status = 'degraded')::int`,
        offline: sql<number>`count(*) filter (where status = 'offline')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(openclawAgentHeartbeats)
      .where(eq(openclawAgentHeartbeats.companyId, companyId)),
    db
      .select({
        backlog: sql<number>`count(*) filter (where status = 'backlog')::int`,
        ready: sql<number>`count(*) filter (where status = 'ready')::int`,
        inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
        blocked: sql<number>`count(*) filter (where status = 'blocked')::int`,
        review: sql<number>`count(*) filter (where status = 'review')::int`,
        done: sql<number>`count(*) filter (where status = 'done')::int`,
        archived: sql<number>`count(*) filter (where status = 'archived')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(openclawAgentWorkItems)
      .where(and(eq(openclawAgentWorkItems.companyId, companyId), isNull(openclawAgentWorkItems.deletedAt))),
  ]);

  const latestHeartbeatsByAgent = Array.from(
    heartbeats
      .reduce((map, heartbeat) => {
        if (!map.has(heartbeat.agentId)) {
          map.set(heartbeat.agentId, heartbeat);
        }
        return map;
      }, new Map<string, (typeof heartbeats)[number]>()),
  ).map(([, heartbeat]) => heartbeat);

  return {
    heartbeatCounts: heartbeatCounts[0] ?? { healthy: 0, degraded: 0, offline: 0, total: 0 },
    runCounts: runCounts[0] ?? { queued: 0, running: 0, success: 0, error: 0, skipped: 0, total: 0 },
    workItemCounts: workItemCounts[0] ?? { backlog: 0, ready: 0, inProgress: 0, blocked: 0, review: 0, done: 0, archived: 0, total: 0 },
    recentHeartbeats: heartbeats.map((row) => ({
      ...row,
      details: normalizeJson(row.details),
    })) as OpenClawHeartbeatRecord[],
    recentRuns: runs.map((row) => ({
      ...row,
      input: normalizeJson(row.input),
      output: normalizeJson(row.output),
    })) as OpenClawRunRecord[],
    recentHandoffs: handoffs.map((row) => ({
      ...row,
      context: normalizeJson(row.context),
      dataConsulted: normalizeJson(row.dataConsulted),
      result: normalizeJson(row.result),
    })) as OpenClawHandoffRecord[],
    recentWorkItems: workItems.map((row) => ({
      ...row,
      context: normalizeJson(row.context),
    })) as OpenClawWorkItemRecord[],
    latestHeartbeatsByAgent: latestHeartbeatsByAgent.map((row) => ({
      ...row,
      details: normalizeJson(row.details),
    })) as OpenClawHeartbeatRecord[],
  };
}
