import { pgTable, uuid, varchar, text, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const clientTypeEnum = pgEnum("client_type", ["importer", "exporter", "both"]);
export const clientStatusEnum = pgEnum("client_status", ["active", "inactive", "prospect"]);

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  cnpj: text("cnpj").notNull(),
  razaoSocial: varchar("razao_social", { length: 500 }).notNull(),
  nomeFantasia: varchar("nome_fantasia", { length: 500 }),
  cnaeCode: varchar("cnae_code", { length: 7 }),
  cnaeDescription: varchar("cnae_description", { length: 500 }),
  address: text("address"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  clientType: clientTypeEnum("client_type").notNull().default("importer"),
  status: clientStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("clients_cnpj_idx").on(table.cnpj),
  index("clients_status_idx").on(table.status),
]);

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
