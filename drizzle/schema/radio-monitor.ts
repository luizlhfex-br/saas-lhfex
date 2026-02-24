import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, index } from "drizzle-orm/pg-core";

export const radioStations = pgTable(
  "radio_stations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    frequency: varchar("frequency", { length: 20 }), // "FM 104.5", "AM 1200"
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 2 }),
    streamUrl: text("stream_url"), // URL for live stream monitoring
    isActive: boolean("is_active").notNull().default(true),
    monitoringEnabled: boolean("monitoring_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("radio_stations_city_idx").on(table.city),
    index("radio_stations_active_idx").on(table.isActive),
  ]
);

export const radioMonitorEvents = pgTable(
  "radio_monitor_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stationId: uuid("station_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    audioUrl: text("audio_url"), // S3 URL to recorded audio segment
    transcriptionText: text("transcription_text"),
    detectedPromotionKeywords: text("detected_promotion_keywords"), // JSON array of keywords found
    confidence: decimal("confidence", { precision: 5, scale: 2 }), // 0-100 confidence score
    isPromotion: boolean("is_promotion").notNull().default(false),
    companyName: varchar("company_name", { length: 255 }),
    promotionDetails: text("promotion_details"), // Extracted details (prize, deadline, etc)
    reviewed: boolean("reviewed").notNull().default(false),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("radio_monitor_events_station_idx").on(table.stationId),
    index("radio_monitor_events_recorded_idx").on(table.recordedAt),
    index("radio_monitor_events_promotion_idx").on(table.isPromotion),
  ]
);

export const radioMonitorKeywords = pgTable(
  "radio_monitor_keywords",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stationId: uuid("station_id"), // nullable = keyword global; uuid = keyword específica da estação
    keyword: varchar("keyword", { length: 255 }).notNull(),
    category: varchar("category", { length: 50 }), // "promotion", "raffle", "discount", "contest"
    priority: varchar("priority", { length: 20 }).notNull().default("medium"), // "low", "medium", "high"
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("radio_monitor_keywords_station_idx").on(table.stationId),
    index("radio_monitor_keywords_category_idx").on(table.category),
    index("radio_monitor_keywords_active_idx").on(table.isActive),
  ]
);
