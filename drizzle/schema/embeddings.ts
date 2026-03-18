import { customType, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { companies, users } from "./auth";

export const vector768 = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    if (Array.isArray(value)) {
      return value.map((item) => Number(item));
    }

    if (typeof value === "string") {
      return value
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(",")
        .map((item) => Number.parseFloat(item.trim()))
        .filter((item) => Number.isFinite(item));
    }

    return [];
  },
});

export const embeddingDocuments = pgTable(
  "embedding_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeType: varchar("scope_type", { length: 20 }).notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 40 }).notNull(),
    sourceId: varchar("source_id", { length: 120 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    bodyHash: varchar("body_hash", { length: 64 }).notNull(),
    language: varchar("language", { length: 12 }).notNull().default("pt-BR"),
    embeddingModel: varchar("embedding_model", { length: 120 }).notNull(),
    embeddingDimensions: integer("embedding_dimensions").notNull().default(768),
    lastEmbeddedAt: timestamp("last_embedded_at", { withTimezone: true }),
    isActive: integer("is_active").notNull().default(1),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("embedding_documents_scope_idx").on(table.scopeType, table.companyId, table.userId),
    index("embedding_documents_source_idx").on(table.sourceType, table.sourceId),
    index("embedding_documents_company_idx").on(table.companyId, table.updatedAt),
  ],
);

export const embeddingChunks = pgTable(
  "embedding_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull().references(() => embeddingDocuments.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    chunkText: text("chunk_text").notNull(),
    chunkHash: varchar("chunk_hash", { length: 64 }).notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    embedding: vector768("embedding").notNull(),
    normalized: integer("normalized").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("embedding_chunks_document_idx").on(table.documentId, table.chunkIndex),
    index("embedding_chunks_company_idx").on(table.companyId, table.updatedAt),
  ],
);

export const embeddingJobs = pgTable(
  "embedding_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeType: varchar("scope_type", { length: 20 }).notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 40 }).notNull(),
    sourceId: varchar("source_id", { length: 120 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("embedding_jobs_scope_idx").on(table.scopeType, table.companyId, table.userId),
    index("embedding_jobs_status_idx").on(table.status, table.updatedAt),
    index("embedding_jobs_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export type EmbeddingDocument = typeof embeddingDocuments.$inferSelect;
export type EmbeddingChunk = typeof embeddingChunks.$inferSelect;
export type EmbeddingJob = typeof embeddingJobs.$inferSelect;
