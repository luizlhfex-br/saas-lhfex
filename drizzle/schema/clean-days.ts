/**
 * Clean Days Schema (Dia Limpo — Streak Tracker)
 *
 * Sistema privado para rastreamento de dias limpos (Luiz).
 * Sem nome de vício — apenas "Dia Limpo".
 * Interface visual semelhante ao GitHub contributions.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const cleanDays = pgTable(
  "clean_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Data do dia (formato YYYY-MM-DD)
    date: date("date").notNull(),

    // true = dia limpo, false = não foi um dia limpo (recaída)
    isClean: boolean("is_clean").notNull().default(true),

    // Nota opcional (privada)
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // Um registro por usuário por dia
    uniqueIndex("clean_days_user_date_idx").on(t.userId, t.date),
  ]
);

export type CleanDay = typeof cleanDays.$inferSelect;
export type NewCleanDay = typeof cleanDays.$inferInsert;
