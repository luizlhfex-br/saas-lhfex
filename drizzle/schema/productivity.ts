/**
 * Productivity Schema
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// 3-3-3 Method: Daily Planner
export const daily333 = pgTable("daily_333", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  deepWork: text("deep_work"),
  quickTasks: text("quick_tasks"),
  maintenance: text("maintenance"),
  completedDeepWork: boolean("completed_deep_work").default(false),
  completedQuickTasks: text("completed_quick_tasks"),
  completedMaintenance: text("completed_maintenance"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const seinfeldHabits = pgTable("seinfeld_habits", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).default("✅"),
  color: varchar("color", { length: 20 }).default("green"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seinfeldLogs = pgTable("seinfeld_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  habitId: uuid("habit_id")
    .notNull()
    .references(() => seinfeldHabits.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  done: boolean("done").notNull().default(true),
});

export type Daily333 = typeof daily333.$inferSelect;
export type NewDaily333 = typeof daily333.$inferInsert;
export type SeinfeldHabit = typeof seinfeldHabits.$inferSelect;
export type NewSeinfeldHabit = typeof seinfeldHabits.$inferInsert;
export type SeinfeldLog = typeof seinfeldLogs.$inferSelect;
export type NewSeinfeldLog = typeof seinfeldLogs.$inferInsert;