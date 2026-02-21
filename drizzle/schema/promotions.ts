import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, varchar as varcharType, index } from "drizzle-orm/pg-core";
import { companyProfile } from "./company-profile";

export const companyPromotions = pgTable(
  "company_promotions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 50 }).notNull(), // "discount", "gift", "raffle", "cashback"
    discountType: varchar("discount_type", { length: 20 }), // "percentage" or "fixed"
    discountValue: decimal("discount_value", { precision: 10, scale: 2 }),
    minPurchaseAmount: decimal("min_purchase_amount", { precision: 10, scale: 2 }),
    maxUsageCount: integer("max_usage_count"),
    currentUsageCount: integer("current_usage_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    promotionCode: varchar("promotion_code", { length: 50 }),
    telegramMessage: text("telegram_message"), // Para enviar ao Telegram
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("company_promotions_company_idx").on(table.companyId),
    index("company_promotions_active_idx").on(table.isActive),
  ]
);

export const companyRaffles = pgTable(
  "company_raffles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    promotionId: uuid("promotion_id"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    prizeDescription: text("prize_description"),
    prizeValue: decimal("prize_value", { precision: 10, scale: 2 }),
    numberOfWinners: integer("number_of_winners").notNull().default(1),
    participationRequired: varchar("participation_required", { length: 100 }), // Purchase amount, comment, share, etc
    drawDate: timestamp("draw_date", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isDrawn: boolean("is_drawn").notNull().default(false),
    telegramMessage: text("telegram_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("company_raffles_company_idx").on(table.companyId),
    index("company_raffles_draw_date_idx").on(table.drawDate),
  ]
);

export const companyRaffleParticipants = pgTable(
  "company_raffle_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    raffleId: uuid("raffle_id").notNull(),
    participantName: varchar("participant_name", { length: 255 }).notNull(),
    participantEmail: varchar("participant_email", { length: 255 }),
    participantPhone: varchar("participant_phone", { length: 30 }),
    ticketNumber: integer("ticket_number"),
    isWinner: boolean("is_winner").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("company_raffle_participants_raffle_idx").on(table.raffleId),
    index("company_raffle_participants_winner_idx").on(table.isWinner),
  ]
);
