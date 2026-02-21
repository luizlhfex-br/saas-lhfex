import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const financialCategories = pgTable("financial_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 10 }).notNull(), // income | expense
  name: varchar("name", { length: 100 }).notNull(),
  parentId: uuid("parent_id"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("financial_categories_type_idx").on(table.type),
  index("financial_categories_name_idx").on(table.name),
  index("financial_categories_parent_idx").on(table.parentId),
]);
