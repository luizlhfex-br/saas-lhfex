import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum, integer, index } from "drizzle-orm/pg-core";
import { companies, users } from "./auth";
import { processes } from "./processes";

export const openclawRunStatusEnum = pgEnum("openclaw_run_status", [
  "queued",
  "running",
  "success",
  "error",
  "skipped",
]);

export const openclawHeartbeatStatusEnum = pgEnum("openclaw_heartbeat_status", [
  "healthy",
  "degraded",
  "offline",
]);

export const openclawHandoffStatusEnum = pgEnum("openclaw_handoff_status", [
  "requested",
  "accepted",
  "completed",
  "blocked",
]);

export const openclawWorkItemStatusEnum = pgEnum("openclaw_work_item_status", [
  "backlog",
  "ready",
  "in_progress",
  "blocked",
  "review",
  "done",
  "archived",
]);

export const openclawWorkItemPriorityEnum = pgEnum("openclaw_work_item_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const openclawAgentRuns = pgTable(
  "openclaw_agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: varchar("agent_id", { length: 50 }).notNull(),
    agentName: varchar("agent_name", { length: 120 }),
    agentRole: varchar("agent_role", { length: 120 }),
    provider: varchar("provider", { length: 80 }),
    model: varchar("model", { length: 120 }),
    status: openclawRunStatusEnum("status").notNull().default("running"),
    input: jsonb("input"),
    output: jsonb("output"),
    errorMessage: text("error_message"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("openclaw_agent_runs_company_id_idx").on(table.companyId),
    index("openclaw_agent_runs_agent_id_idx").on(table.agentId, table.startedAt),
    index("openclaw_agent_runs_status_idx").on(table.status, table.startedAt),
  ],
);

export const openclawAgentHeartbeats = pgTable(
  "openclaw_agent_heartbeats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: varchar("agent_id", { length: 50 }).notNull(),
    agentName: varchar("agent_name", { length: 120 }),
    status: openclawHeartbeatStatusEnum("status").notNull().default("healthy"),
    provider: varchar("provider", { length: 80 }),
    model: varchar("model", { length: 120 }),
    summary: text("summary"),
    details: jsonb("details"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("openclaw_agent_heartbeats_company_id_idx").on(table.companyId),
    index("openclaw_agent_heartbeats_agent_id_idx").on(table.agentId, table.checkedAt),
    index("openclaw_agent_heartbeats_status_idx").on(table.status, table.checkedAt),
  ],
);

export const openclawAgentHandoffs = pgTable(
  "openclaw_agent_handoffs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fromAgentId: varchar("from_agent_id", { length: 50 }),
    toAgentId: varchar("to_agent_id", { length: 50 }).notNull(),
    status: openclawHandoffStatusEnum("status").notNull().default("requested"),
    objective: text("objective").notNull(),
    context: jsonb("context"),
    dataConsulted: jsonb("data_consulted"),
    expectedDelivery: text("expected_delivery"),
    criteria: text("criteria"),
    riskKnown: text("risk_known"),
    result: jsonb("result"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("openclaw_agent_handoffs_company_id_idx").on(table.companyId),
    index("openclaw_agent_handoffs_to_agent_idx").on(table.toAgentId, table.createdAt),
    index("openclaw_agent_handoffs_status_idx").on(table.status, table.createdAt),
  ],
);

export const openclawAgentWorkItems = pgTable(
  "openclaw_agent_work_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: varchar("agent_id", { length: 50 }).notNull(),
    processId: uuid("process_id").references(() => processes.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: openclawWorkItemStatusEnum("status").notNull().default("backlog"),
    priority: openclawWorkItemPriorityEnum("priority").notNull().default("medium"),
    source: varchar("source", { length: 60 }),
    context: jsonb("context"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("openclaw_agent_work_items_company_id_idx").on(table.companyId),
    index("openclaw_agent_work_items_agent_id_idx").on(table.agentId, table.status, table.updatedAt),
    index("openclaw_agent_work_items_status_idx").on(table.status, table.priority, table.updatedAt),
    index("openclaw_agent_work_items_process_id_idx").on(table.processId),
  ],
);
