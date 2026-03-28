import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies, users } from "./auth";
import { processes } from "./processes";

export const processTaxScenarioEnum = pgEnum("process_tax_scenario", ["air", "sea", "other"]);
export const processTaxExpenseKindEnum = pgEnum("process_tax_expense_kind", ["tax_base", "final"]);

export const processTaxWorkbooks = pgTable(
  "process_tax_workbooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    processId: uuid("process_id").notNull().references(() => processes.id, { onDelete: "cascade" }),
    scenario: processTaxScenarioEnum("scenario").notNull().default("other"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).notNull().default("0"),
    freightTotalUsd: numeric("freight_total_usd", { precision: 15, scale: 2 }).notNull().default("0"),
    stateIcmsRate: numeric("state_icms_rate", { precision: 5, scale: 2 }).notNull().default("18"),
    quoteDate: timestamp("quote_date", { withTimezone: true }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("process_tax_workbooks_process_id_uidx").on(table.processId),
    index("process_tax_workbooks_company_id_idx").on(table.companyId),
  ],
);

export const processTaxItems = pgTable(
  "process_tax_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workbookId: uuid("workbook_id").notNull().references(() => processTaxWorkbooks.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    partNumber: varchar("part_number", { length: 120 }),
    description: text("description"),
    ncm: varchar("ncm", { length: 20 }),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull().default("0"),
    fobUsd: numeric("fob_usd", { precision: 15, scale: 2 }).notNull().default("0"),
    netWeightKg: numeric("net_weight_kg", { precision: 15, scale: 3 }).notNull().default("0"),
    iiRate: numeric("ii_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    ipiRate: numeric("ipi_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    pisRate: numeric("pis_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cofinsRate: numeric("cofins_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    icmsRate: numeric("icms_rate", { precision: 5, scale: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("process_tax_items_workbook_id_idx").on(table.workbookId),
    index("process_tax_items_company_id_idx").on(table.companyId),
    index("process_tax_items_ncm_idx").on(table.ncm),
  ],
);

export const processTaxExpenses = pgTable(
  "process_tax_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workbookId: uuid("workbook_id").notNull().references(() => processTaxWorkbooks.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    kind: processTaxExpenseKindEnum("kind").notNull(),
    label: varchar("label", { length: 180 }).notNull(),
    amountBrl: numeric("amount_brl", { precision: 15, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("process_tax_expenses_workbook_id_idx").on(table.workbookId),
    index("process_tax_expenses_company_id_idx").on(table.companyId),
    index("process_tax_expenses_kind_idx").on(table.kind),
  ],
);
