import { pgTable, uuid, varchar, text, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const notificationTypeEnum = pgEnum("notification_type", [
  // Valores usados pelo notifications-generator.server.ts
  "info",
  "success",
  "warning",
  "error",
  "invoice",
  "process",
  "changelog",
  // Valores legados / sistema
  "system",
  "automation",
  "approval_request",
  "process_status",
  "invoice_due",
  "eta_approaching",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull().default("system"),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  link: varchar("link", { length: 500 }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_user_read_idx").on(table.userId, table.read),
]);
