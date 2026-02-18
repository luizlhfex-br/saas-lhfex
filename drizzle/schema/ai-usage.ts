import { pgTable, uuid, varchar, integer, numeric, text, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const aiProviderEnum = pgEnum("ai_provider", [
  "gemini", "openrouter_free", "openrouter_paid", "deepseek",
]);

export const aiFeatureEnum = pgEnum("ai_feature", [
  "chat", "ncm_classification", "ocr", "enrichment", "telegram",
]);

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: aiProviderEnum("provider").notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  feature: aiFeatureEnum("feature").notNull().default("chat"),
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  costEstimate: numeric("cost_estimate", { precision: 10, scale: 6 }).default("0"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ai_usage_provider_idx").on(table.provider),
  index("ai_usage_created_idx").on(table.createdAt),
  index("ai_usage_feature_idx").on(table.feature),
]);
