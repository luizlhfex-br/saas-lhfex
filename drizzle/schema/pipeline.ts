import { pgTable, uuid, varchar, text, timestamp, numeric, pgEnum, index } from "drizzle-orm/pg-core";
import { users, companies } from "./auth";
import { clients, contacts } from "./crm";

export const dealStageEnum = pgEnum("deal_stage", [
  "prospect",
  "qualification",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  title: varchar("title", { length: 300 }).notNull(),
  value: numeric("value", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  stage: dealStageEnum("stage").notNull().default("prospect"),
  nextAction: varchar("next_action", { length: 500 }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  lostReason: text("lost_reason"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("deals_company_id_idx").on(table.companyId),
  index("deals_stage_idx").on(table.stage),
  index("deals_client_id_idx").on(table.clientId),
  index("deals_company_stage_idx").on(table.companyId, table.stage),
  index("deals_next_follow_up_idx").on(table.nextFollowUpAt),
]);

export const dealActivities = pgTable("deal_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: varchar("type", { length: 50 }).default("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
