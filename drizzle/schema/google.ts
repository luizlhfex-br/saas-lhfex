import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const googleTokens = pgTable("google_tokens", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text().notNull(),
  refreshToken: text(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  scope: text(), // "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets"
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  disconnectedAt: timestamp({ withTimezone: true }), // soft delete
});

export type GoogleToken = typeof googleTokens.$inferSelect;
export type GoogleTokenInput = typeof googleTokens.$inferInsert;
