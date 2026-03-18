import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "~/lib/db.server";
import { embeddingChunks, embeddingDocuments, embeddingJobs } from "../../drizzle/schema";

export type EmbeddingScopeType = "business" | "personal" | "system";

export type EmbeddingSourceType =
  | "client"
  | "contact"
  | "process"
  | "promotion"
  | "radio"
  | "doc"
  | "note"
  | "knowledge";

export type EmbeddingSearchResult = {
  documentId: string;
  chunkId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  chunkText: string;
  score: number;
  metadata: Record<string, unknown> | null;
};

export type EmbeddingSystemStatus = {
  enabled: boolean;
  provider: string;
  model: string;
  dimensions: number;
  extensionEnabled: boolean;
  documents: number;
  chunks: number;
  jobs: number;
  pendingJobs: number;
  failedJobs: number;
};

const EMBEDDINGS_ENABLED = process.env.EMBEDDINGS_ENABLED !== "false";
const EMBEDDINGS_PROVIDER = process.env.EMBEDDINGS_PROVIDER?.trim() || "gemini_api";
const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-004";
const EMBEDDINGS_DIMENSIONS = Number(process.env.EMBEDDINGS_DIMENSIONS || 768);
const EMBEDDINGS_MAX_CHARS = Number(process.env.EMBEDDINGS_MAX_CHARS || 4000);
const EMBEDDINGS_OVERLAP_CHARS = Number(process.env.EMBEDDINGS_OVERLAP_CHARS || 400);
const EMBEDDINGS_MAX_RESULTS = Number(process.env.EMBEDDINGS_MAX_RESULTS || 8);

let embeddingClient: GoogleGenAI | null = null;

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.25));
}

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function serializeVector(values: number[]): string {
  return `[${values.map((value) => Number.isFinite(value) ? value : 0).join(",")}]`;
}

function chunkText(text: string): Array<{ chunkText: string; tokenCount: number; chunkHash: string }> {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunks: Array<{ chunkText: string; tokenCount: number; chunkHash: string }> = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const slice = normalized.slice(cursor, cursor + EMBEDDINGS_MAX_CHARS);
    const safeBreak = slice.lastIndexOf("\n\n");
    const end = safeBreak > EMBEDDINGS_MAX_CHARS * 0.6 ? cursor + safeBreak : cursor + EMBEDDINGS_MAX_CHARS;
    const chunk = normalizeText(normalized.slice(cursor, end));

    if (chunk) {
      chunks.push({
        chunkText: chunk,
        tokenCount: estimateTokens(chunk),
        chunkHash: hashText(chunk),
      });
    }

    if (end <= cursor) {
      break;
    }

    cursor = Math.max(end - EMBEDDINGS_OVERLAP_CHARS, cursor + 1);
  }

  return chunks;
}

function getEmbeddingsClient(): GoogleGenAI | null {
  if (embeddingClient) return embeddingClient;

  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  embeddingClient = new GoogleGenAI({ apiKey });
  return embeddingClient;
}

export function getEmbeddingsConfig() {
  return {
    enabled: EMBEDDINGS_ENABLED,
    provider: EMBEDDINGS_PROVIDER,
    model: EMBEDDINGS_MODEL,
    dimensions: EMBEDDINGS_DIMENSIONS,
    maxResults: EMBEDDINGS_MAX_RESULTS,
  };
}

export async function getEmbeddingSystemStatus(): Promise<EmbeddingSystemStatus> {
  const extensionRows = await db.execute(sql<{ enabled: boolean }>`
    select exists (
      select 1
      from pg_extension
      where extname = 'vector'
    ) as enabled
  `);
  const enabled = extensionRows[0]?.enabled ?? false;

  const [documentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(embeddingDocuments);
  const [chunkCount] = await db.select({ count: sql<number>`count(*)::int` }).from(embeddingChunks);
  const [jobCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    })
    .from(embeddingJobs);

  return {
    enabled: EMBEDDINGS_ENABLED,
    provider: EMBEDDINGS_PROVIDER,
    model: EMBEDDINGS_MODEL,
    dimensions: EMBEDDINGS_DIMENSIONS,
    extensionEnabled: Boolean(enabled),
    documents: documentCount?.count ?? 0,
    chunks: chunkCount?.count ?? 0,
    jobs: jobCounts?.total ?? 0,
    pendingJobs: jobCounts?.pending ?? 0,
    failedJobs: jobCounts?.failed ?? 0,
  };
}

async function embedTexts(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const client = getEmbeddingsClient();
  if (!client) {
    throw new Error("GEMINI_API_KEY ou GOOGLE_API_KEY nao configurada para embeddings");
  }

  const response = await client.models.embedContent({
    model: EMBEDDINGS_MODEL,
    contents: texts.length === 1 ? texts[0] : texts,
    config: {
      taskType,
      outputDimensionality: EMBEDDINGS_DIMENSIONS,
    },
  });

  const embeddings = response.embeddings ?? [];
  return embeddings
    .map((embedding) => embedding.values ?? [])
    .filter((values) => values.length > 0);
}

export async function indexEmbeddingDocument(input: {
  scopeType: EmbeddingScopeType;
  sourceType: EmbeddingSourceType;
  sourceId: string;
  title: string;
  body: string;
  companyId?: string | null;
  userId?: string | null;
  language?: string;
  metadata?: Record<string, unknown> | null;
}) {
  if (!EMBEDDINGS_ENABLED) {
    return { skipped: true, reason: "embeddings_disabled" } as const;
  }

  const normalizedBody = normalizeText(input.body);
  if (!normalizedBody) {
    return { skipped: true, reason: "empty_body" } as const;
  }

  const bodyHash = hashText(normalizedBody);
  const chunks = chunkText(normalizedBody);
  if (chunks.length === 0) {
    return { skipped: true, reason: "no_chunks" } as const;
  }

  const [existingDoc] = await db
    .select({ id: embeddingDocuments.id, bodyHash: embeddingDocuments.bodyHash })
    .from(embeddingDocuments)
    .where(
      and(
        eq(embeddingDocuments.scopeType, input.scopeType),
        eq(embeddingDocuments.sourceType, input.sourceType),
        eq(embeddingDocuments.sourceId, input.sourceId),
        input.companyId ? eq(embeddingDocuments.companyId, input.companyId) : isNull(embeddingDocuments.companyId),
        input.userId ? eq(embeddingDocuments.userId, input.userId) : isNull(embeddingDocuments.userId),
      ),
    )
    .limit(1);

  if (existingDoc?.bodyHash === bodyHash) {
    return { skipped: true, reason: "unchanged" } as const;
  }

  const [documentRow] = existingDoc
    ? await db
        .update(embeddingDocuments)
        .set({
          title: input.title,
          bodyHash,
          language: input.language ?? "pt-BR",
          embeddingModel: EMBEDDINGS_MODEL,
          embeddingDimensions: EMBEDDINGS_DIMENSIONS,
          lastEmbeddedAt: new Date(),
          isActive: 1,
          metadata: input.metadata ?? null,
          updatedAt: new Date(),
        })
        .where(eq(embeddingDocuments.id, existingDoc.id))
        .returning({ id: embeddingDocuments.id })
    : await db
        .insert(embeddingDocuments)
        .values({
          scopeType: input.scopeType,
          companyId: input.companyId ?? null,
          userId: input.userId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          title: input.title,
          bodyHash,
          language: input.language ?? "pt-BR",
          embeddingModel: EMBEDDINGS_MODEL,
          embeddingDimensions: EMBEDDINGS_DIMENSIONS,
          lastEmbeddedAt: new Date(),
          isActive: 1,
          metadata: input.metadata ?? null,
        })
        .returning({ id: embeddingDocuments.id });

  if (!documentRow) {
    throw new Error("Nao foi possivel salvar o documento de embedding");
  }

  await db.delete(embeddingChunks).where(eq(embeddingChunks.documentId, documentRow.id));

  const vectors = await embedTexts(chunks.map((chunk) => chunk.chunkText), "RETRIEVAL_DOCUMENT");
  if (vectors.length !== chunks.length) {
    throw new Error("O modelo de embeddings nao retornou a quantidade esperada de vetores");
  }

  await db.insert(embeddingChunks).values(
    chunks.map((chunk, index) => ({
      documentId: documentRow.id,
      companyId: input.companyId ?? null,
      userId: input.userId ?? null,
      chunkIndex: index,
      chunkText: chunk.chunkText,
      chunkHash: chunk.chunkHash,
      tokenCount: chunk.tokenCount,
      embedding: vectors[index] ?? [],
      normalized: 1,
      metadata: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        title: input.title,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  return {
    skipped: false,
    documentId: documentRow.id,
    chunkCount: chunks.length,
    bodyHash,
  } as const;
}

export async function queueEmbeddingJob(input: {
  scopeType: EmbeddingScopeType;
  sourceType: EmbeddingSourceType;
  sourceId?: string | null;
  companyId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const [row] = await db
    .insert(embeddingJobs)
    .values({
      scopeType: input.scopeType,
      companyId: input.companyId ?? null,
      userId: input.userId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      status: "pending",
      metadata: input.metadata ?? null,
    })
    .returning({ id: embeddingJobs.id });

  return row;
}

export async function searchEmbeddingChunks(input: {
  query: string;
  scopeType: EmbeddingScopeType;
  companyId?: string | null;
  userId?: string | null;
  sourceTypes?: EmbeddingSourceType[];
  limit?: number;
}) {
  if (!EMBEDDINGS_ENABLED) {
    return [] as EmbeddingSearchResult[];
  }

  const queryText = normalizeText(input.query);
  if (!queryText) return [];

  const [queryVector] = await embedTexts([queryText], "RETRIEVAL_QUERY");
  if (!queryVector) return [];

  const vectorLiteral = `'${serializeVector(queryVector)}'::vector`;
  const conditions = [
    eq(embeddingDocuments.scopeType, input.scopeType),
    input.companyId ? eq(embeddingDocuments.companyId, input.companyId) : undefined,
    input.userId ? eq(embeddingDocuments.userId, input.userId) : undefined,
    input.sourceTypes && input.sourceTypes.length > 0 ? inArray(embeddingDocuments.sourceType, input.sourceTypes) : undefined,
    eq(embeddingDocuments.isActive, 1),
  ].filter(Boolean);

  const rows = await db
    .select({
      documentId: embeddingDocuments.id,
      chunkId: embeddingChunks.id,
      sourceType: embeddingDocuments.sourceType,
      sourceId: embeddingDocuments.sourceId,
      title: embeddingDocuments.title,
      chunkText: embeddingChunks.chunkText,
      metadata: embeddingChunks.metadata,
      score: sql<number>`1 - (${embeddingChunks.embedding} <=> ${sql.raw(vectorLiteral)})`,
    })
    .from(embeddingChunks)
    .innerJoin(embeddingDocuments, eq(embeddingChunks.documentId, embeddingDocuments.id))
    .where(and(...conditions))
    .orderBy(sql.raw(`"embedding_chunks"."embedding" <=> '${serializeVector(queryVector)}'::vector`))
    .limit(input.limit ?? EMBEDDINGS_MAX_RESULTS);

  return rows.map((row) => ({
    ...row,
    score: Number(row.score ?? 0),
    metadata: row.metadata as Record<string, unknown> | null,
  }));
}

export async function markEmbeddingJobStatus(input: {
  jobId: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  errorMessage?: string | null;
  attempts?: number;
}) {
  await db
    .update(embeddingJobs)
    .set({
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      attempts: input.attempts ?? undefined,
      startedAt: input.status === "running" ? new Date() : undefined,
      finishedAt: ["done", "failed", "skipped"].includes(input.status) ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(embeddingJobs.id, input.jobId));
}
