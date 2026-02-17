import { pgTable, uuid, varchar, text, timestamp, numeric, date, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { clients } from "./crm";
import { processes } from "./processes";

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "cancelled"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["receivable", "payable"]);

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: varchar("number", { length: 50 }).notNull().unique(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  processId: uuid("process_id").references(() => processes.id, { onDelete: "set null" }),
  type: transactionTypeEnum("type").notNull().default("receivable"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  currency: varchar("currency", { length: 3 }).default("BRL"),
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 4 }),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxes: numeric("taxes", { precision: 15, scale: 2 }).default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  paidDate: date("paid_date"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }),
  description: text("description"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("invoices_client_id_idx").on(table.clientId),
  index("invoices_process_id_idx").on(table.processId),
  index("invoices_status_idx").on(table.status),
]);

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
