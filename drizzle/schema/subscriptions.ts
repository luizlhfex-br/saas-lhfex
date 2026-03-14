import { pgTable, uuid, varchar, text, numeric, integer, date, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./auth";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url"),
    category: varchar("category", { length: 50 }).notNull().default("other"),
    valueAmount: numeric("value_amount", { precision: 12, scale: 2 }).notNull(),
    valueCurrency: varchar("value_currency", { length: 3 }).notNull().default("BRL"),
    dueDay: integer("due_day"),
    dueDate: date("due_date"),
    recurrence: varchar("recurrence", { length: 20 }).notNull().default("monthly"),
    paymentMethod: varchar("payment_method", { length: 50 }),
    loginHint: text("login_hint"),
    notes: text("notes"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    alertDaysBefore: integer("alert_days_before").notNull().default(7),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("subscriptions_company_id_idx").on(table.companyId),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_due_date_idx").on(table.dueDate),
    index("subscriptions_deleted_at_idx").on(table.deletedAt),
  ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
