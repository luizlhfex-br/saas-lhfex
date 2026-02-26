import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const missionControlTasks = pgTable("mission_control_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  column: varchar("column", { length: 50 }).default("inbox").notNull(), // inbox|todo|in_progress|review|done|blocked
  priority: varchar("priority", { length: 20 }).default("medium").notNull(), // low|medium|high|urgent
  source: varchar("source", { length: 50 }).default("manual").notNull(), // manual|openclaw|airton|maria|iana
  sourceAgent: varchar("source_agent", { length: 50 }),
  notes: text("notes"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
