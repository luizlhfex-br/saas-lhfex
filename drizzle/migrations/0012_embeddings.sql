CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "embedding_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_type" varchar(20) NOT NULL,
  "company_id" uuid,
  "user_id" uuid,
  "source_type" varchar(40) NOT NULL,
  "source_id" varchar(120) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body_hash" varchar(64) NOT NULL,
  "language" varchar(12) NOT NULL DEFAULT 'pt-BR',
  "embedding_model" varchar(120) NOT NULL,
  "embedding_dimensions" integer NOT NULL DEFAULT 768,
  "last_embedded_at" timestamp with time zone,
  "is_active" integer NOT NULL DEFAULT 1,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "embedding_documents"
    ADD CONSTRAINT "embedding_documents_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "embedding_documents"
    ADD CONSTRAINT "embedding_documents_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "embedding_documents_scope_idx" ON "embedding_documents" USING btree ("scope_type","company_id","user_id");
CREATE INDEX IF NOT EXISTS "embedding_documents_source_idx" ON "embedding_documents" USING btree ("source_type","source_id");
CREATE INDEX IF NOT EXISTS "embedding_documents_company_idx" ON "embedding_documents" USING btree ("company_id","updated_at");

CREATE TABLE IF NOT EXISTS "embedding_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "company_id" uuid,
  "user_id" uuid,
  "chunk_index" integer NOT NULL,
  "chunk_text" text NOT NULL,
  "chunk_hash" varchar(64) NOT NULL,
  "token_count" integer NOT NULL DEFAULT 0,
  "embedding" vector(768) NOT NULL,
  "normalized" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "embedding_chunks"
    ADD CONSTRAINT "embedding_chunks_document_id_embedding_documents_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "public"."embedding_documents"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "embedding_chunks"
    ADD CONSTRAINT "embedding_chunks_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "embedding_chunks"
    ADD CONSTRAINT "embedding_chunks_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "embedding_chunks_document_idx" ON "embedding_chunks" USING btree ("document_id","chunk_index");
CREATE INDEX IF NOT EXISTS "embedding_chunks_company_idx" ON "embedding_chunks" USING btree ("company_id","updated_at");
CREATE INDEX IF NOT EXISTS "embedding_chunks_embedding_hnsw_idx" ON "embedding_chunks" USING hnsw ("embedding" vector_cosine_ops);

CREATE TABLE IF NOT EXISTS "embedding_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_type" varchar(20) NOT NULL,
  "company_id" uuid,
  "user_id" uuid,
  "source_type" varchar(40) NOT NULL,
  "source_id" varchar(120),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "error_message" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "embedding_jobs"
    ADD CONSTRAINT "embedding_jobs_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "embedding_jobs"
    ADD CONSTRAINT "embedding_jobs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "embedding_jobs_scope_idx" ON "embedding_jobs" USING btree ("scope_type","company_id","user_id");
CREATE INDEX IF NOT EXISTS "embedding_jobs_status_idx" ON "embedding_jobs" USING btree ("status","updated_at");
CREATE INDEX IF NOT EXISTS "embedding_jobs_source_idx" ON "embedding_jobs" USING btree ("source_type","source_id");
