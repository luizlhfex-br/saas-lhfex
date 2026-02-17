import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const triggerTypeEnum = pgEnum("trigger_type", [
  "process_status_change",
  "invoice_due_soon",
  "new_client",
  "eta_approaching",
  "scheduled",
]);

export const actionTypeEnum = pgEnum("action_type", [
  "send_email",
  "create_notification",
  "call_agent",
  "webhook",
]);

export const automationStatusEnum = pgEnum("automation_log_status", ["success", "error", "skipped"]);

export const automations = pgTable("automations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  triggerType: triggerTypeEnum("trigger_type").notNull(),
  triggerConfig: jsonb("trigger_config").notNull().default({}),
  actionType: actionTypeEnum("action_type").notNull(),
  actionConfig: jsonb("action_config").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("automations_enabled_idx").on(table.enabled),
]);

export const automationLogs = pgTable("automation_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  automationId: uuid("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  status: automationStatusEnum("status").notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("automation_logs_automation_id_idx").on(table.automationId),
]);
