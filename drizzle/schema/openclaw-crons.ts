import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const openclawCrons = pgTable("openclaw_crons", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  schedule: varchar("schedule", { length: 50 }).notNull(),
  message: text("message").notNull(),
  channel: varchar("channel", { length: 20 }).default("telegram").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunResult: varchar("last_run_result", { length: 20 }), // ok|error
  recentLogs: jsonb("recent_logs").$type<Array<{ timestamp: string; result: string; notes?: string }>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
