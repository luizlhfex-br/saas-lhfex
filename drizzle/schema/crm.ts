import { pgTable, uuid, varchar, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const clientTypeEnum = pgEnum("client_type", ["importer", "exporter", "both"]);
export const clientStatusEnum = pgEnum("client_status", ["active", "inactive", "prospect"]);

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  cnpj: text("cnpj").notNull(),
  razaoSocial: varchar("razao_social", { length: 500 }).notNull(),
  nomeFantasia: varchar("nome_fantasia", { length: 500 }),
  ramoAtividade: varchar("ramo_atividade", { length: 255 }),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  clientType: clientTypeEnum("client_type").notNull().default("importer"),
  status: clientStatusEnum("status").notNull().default("active"),
  monthlyVolume: varchar("monthly_volume", { length: 100 }),
  preferredCurrency: varchar("preferred_currency", { length: 3 }).default("USD"),
  preferredIncoterm: varchar("preferred_incoterm", { length: 10 }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 255 }),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  linkedin: varchar("linkedin", { length: 500 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
