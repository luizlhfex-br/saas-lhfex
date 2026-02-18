import { pgTable, uuid, text, varchar, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const ncmClassificationStatusEnum = pgEnum("ncm_classification_status", [
  "draft", "approved", "revised",
]);

export const ncmClassifications = pgTable("ncm_classifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  inputDescription: text("input_description").notNull(),
  suggestedNcm: varchar("suggested_ncm", { length: 20 }),
  approvedNcm: varchar("approved_ncm", { length: 20 }),
  generatedDescription: text("generated_description"),
  promptVersion: varchar("prompt_version", { length: 20 }).default("2.0"),
  status: ncmClassificationStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ncm_class_user_idx").on(table.userId),
  index("ncm_class_status_idx").on(table.status),
]);
