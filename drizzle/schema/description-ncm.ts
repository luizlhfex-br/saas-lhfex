import { pgTable, uuid, text, varchar, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const descriptionNcmStatusEnum = pgEnum("description_ncm_status", [
  "draft", "approved", "revised",
]);

export const descriptionNcmItems = pgTable("description_ncm_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referenceNumber: varchar("reference_number", { length: 100 }),
  supplier: varchar("supplier", { length: 255 }),
  inputDescription: text("input_description").notNull(),
  generatedDescription: text("generated_description"),
  suggestedNcm: varchar("suggested_ncm", { length: 20 }),
  approvedNcm: varchar("approved_ncm", { length: 20 }),
  status: descriptionNcmStatusEnum("status").notNull().default("draft"),
  observations: text("observations"),
  promptVersion: varchar("prompt_version", { length: 20 }).default("1.0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("desc_ncm_user_idx").on(table.userId),
  index("desc_ncm_status_idx").on(table.status),
  index("desc_ncm_reference_idx").on(table.referenceNumber),
]);
