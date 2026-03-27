CREATE TABLE IF NOT EXISTS "personal_news_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "topic" varchar(30) NOT NULL,
  "name" varchar(160) NOT NULL,
  "source_type" varchar(30) NOT NULL DEFAULT 'google_news_rss',
  "query" text NOT NULL,
  "source_url" text,
  "max_items" integer NOT NULL DEFAULT 4,
  "priority" smallint NOT NULL DEFAULT 5,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_checked_at" timestamp,
  "last_status" varchar(20) NOT NULL DEFAULT 'idle',
  "last_error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "personal_news_sources_user_id_idx"
  ON "personal_news_sources" ("user_id");

CREATE INDEX IF NOT EXISTS "personal_news_sources_topic_idx"
  ON "personal_news_sources" ("topic");

CREATE INDEX IF NOT EXISTS "personal_news_sources_active_idx"
  ON "personal_news_sources" ("is_active");

CREATE TABLE IF NOT EXISTS "personal_news_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "source_id" uuid,
  "topic" varchar(30) NOT NULL,
  "title" varchar(500) NOT NULL,
  "summary" text,
  "url" text NOT NULL,
  "source_name" varchar(255),
  "published_at" timestamp,
  "digest_date" date,
  "relevance_score" smallint NOT NULL DEFAULT 50,
  "is_read" boolean NOT NULL DEFAULT false,
  "is_starred" boolean NOT NULL DEFAULT false,
  "telegram_sent_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp,
  CONSTRAINT "personal_news_items_source_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "personal_news_sources"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "personal_news_items_user_id_idx"
  ON "personal_news_items" ("user_id");

CREATE INDEX IF NOT EXISTS "personal_news_items_topic_idx"
  ON "personal_news_items" ("topic");

CREATE INDEX IF NOT EXISTS "personal_news_items_digest_date_idx"
  ON "personal_news_items" ("digest_date");

CREATE INDEX IF NOT EXISTS "personal_news_items_starred_idx"
  ON "personal_news_items" ("is_starred");

CREATE UNIQUE INDEX IF NOT EXISTS "personal_news_items_user_url_uidx"
  ON "personal_news_items" ("user_id", "url");

CREATE TABLE IF NOT EXISTS "personal_news_digests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "digest_date" date NOT NULL,
  "title" varchar(255) NOT NULL,
  "topics" text NOT NULL,
  "digest_markdown" text NOT NULL,
  "telegram_message" text,
  "telegram_sent_at" timestamp,
  "item_count" integer NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "personal_news_digests_user_id_idx"
  ON "personal_news_digests" ("user_id");

CREATE INDEX IF NOT EXISTS "personal_news_digests_digest_date_idx"
  ON "personal_news_digests" ("digest_date");

CREATE INDEX IF NOT EXISTS "personal_news_digests_status_idx"
  ON "personal_news_digests" ("status");

CREATE UNIQUE INDEX IF NOT EXISTS "personal_news_digests_user_date_uidx"
  ON "personal_news_digests" ("user_id", "digest_date");
