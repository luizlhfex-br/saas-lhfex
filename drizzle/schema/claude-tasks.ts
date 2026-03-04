import { pgTable, uuid, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const claudeTasks = pgTable("claude_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  prompt: text("prompt").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | running | done | error
  result: text("result"),
  errorMsg: text("error_msg"),
  source: varchar("source", { length: 50 }).default("openclaw"), // quem criou
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
