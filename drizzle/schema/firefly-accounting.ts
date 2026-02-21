import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, integer, index } from "drizzle-orm/pg-core";
import { companyProfile } from "./company-profile";

/**
 * Firefly Accounting System - Phase 1
 * Triple-entry accounting with accounts, transactions, and budgets
 */

export const fireflyAccounts = pgTable(
  "firefly_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    accountType: varchar("account_type", { length: 50 }).notNull(), // "asset", "liability", "equity", "revenue", "expense"
    accountNumber: varchar("account_number", { length: 50 }), // Chart of accounts code
    currency: varchar("currency", { length: 3 }).notNull().default("BRL"),
    currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("firefly_accounts_company_idx").on(table.companyId),
    index("firefly_accounts_type_idx").on(table.accountType),
  ]
);

export const fireflyTransactions = pgTable(
  "firefly_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("BRL"),
    debitAccountId: uuid("debit_account_id").notNull(), // Account being debited
    creditAccountId: uuid("credit_account_id").notNull(), // Account being credited
    category: varchar("category", { length: 100 }),
    reference: varchar("reference", { length: 100 }), // Invoice number, check number, etc
    attachmentUrl: text("attachment_url"), // S3 URL to receipt/invoice
    notes: text("notes"),
    isReconciled: boolean("is_reconciled").notNull().default(false),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("firefly_transactions_company_idx").on(table.companyId),
    index("firefly_transactions_date_idx").on(table.transactionDate),
    index("firefly_transactions_debit_idx").on(table.debitAccountId),
    index("firefly_transactions_credit_idx").on(table.creditAccountId),
  ]
);

export const fireflyBudgets = pgTable(
  "firefly_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    accountId: uuid("account_id").notNull(), // Account this budget applies to
    period: varchar("period", { length: 20 }).notNull(), // "monthly", "quarterly", "yearly"
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    plannedAmount: decimal("planned_amount", { precision: 15, scale: 2 }).notNull(),
    actualAmount: decimal("actual_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("BRL"),
    alertThreshold: integer("alert_threshold"), // Percentage (0-100) to trigger alert
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("firefly_budgets_company_idx").on(table.companyId),
    index("firefly_budgets_account_idx").on(table.accountId),
    index("firefly_budgets_period_idx").on(table.startDate, table.endDate),
  ]
);

export const fireflyRecurringTransactions = pgTable(
  "firefly_recurring_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("BRL"),
    debitAccountId: uuid("debit_account_id").notNull(),
    creditAccountId: uuid("credit_account_id").notNull(),
    frequency: varchar("frequency", { length: 20 }).notNull(), // "daily", "weekly", "monthly", "yearly"
    nextRunDate: timestamp("next_run_date", { withTimezone: true }).notNull(),
    lastRunDate: timestamp("last_run_date", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("firefly_recurring_company_idx").on(table.companyId),
    index("firefly_recurring_next_run_idx").on(table.nextRunDate),
  ]
);
