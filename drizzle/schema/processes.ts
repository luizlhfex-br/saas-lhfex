import { pgTable, uuid, varchar, text, timestamp, integer, numeric, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { clients } from "./crm";

export const processTypeEnum = pgEnum("process_type", ["import", "export"]);
export const processStatusEnum = pgEnum("process_status", [
  "draft", "in_progress", "awaiting_docs", "customs_clearance",
  "in_transit", "delivered", "completed", "cancelled",
]);

export const processes = pgTable("processes", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: varchar("reference", { length: 50 }).notNull().unique(),
  processType: processTypeEnum("process_type").notNull(),
  status: processStatusEnum("status").notNull().default("draft"),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  description: text("description"),
  hsCode: varchar("hs_code", { length: 20 }),
  hsDescription: text("hs_description"),
  incoterm: varchar("incoterm", { length: 10 }),
  originCountry: varchar("origin_country", { length: 100 }),
  destinationCountry: varchar("destination_country", { length: 100 }).default("Brasil"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  totalValue: numeric("total_value", { precision: 15, scale: 2 }),
  totalWeight: numeric("total_weight", { precision: 12, scale: 3 }),
  containerCount: integer("container_count"),
  containerType: varchar("container_type", { length: 20 }),
  vessel: varchar("vessel", { length: 255 }),
  bl: varchar("bl", { length: 100 }),
  etd: timestamp("etd", { withTimezone: true }),
  eta: timestamp("eta", { withTimezone: true }),
  actualDeparture: timestamp("actual_departure", { withTimezone: true }),
  actualArrival: timestamp("actual_arrival", { withTimezone: true }),
  portOfOrigin: varchar("port_of_origin", { length: 255 }),
  portOfDestination: varchar("port_of_destination", { length: 255 }),
  customsBroker: varchar("customs_broker", { length: 255 }),
  diNumber: varchar("di_number", { length: 50 }),
  diDate: timestamp("di_date", { withTimezone: true }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("processes_client_id_idx").on(table.clientId),
  index("processes_status_idx").on(table.status),
  index("processes_created_by_idx").on(table.createdBy),
]);

export const processDocuments = pgTable("process_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  processId: uuid("process_id").notNull().references(() => processes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const processTimeline = pgTable("process_timeline", {
  id: uuid("id").defaultRandom().primaryKey(),
  processId: uuid("process_id").notNull().references(() => processes.id, { onDelete: "cascade" }),
  status: processStatusEnum("status").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
