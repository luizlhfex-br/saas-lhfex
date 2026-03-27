CREATE TABLE IF NOT EXISTS "promotion_watch_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "channel" varchar(30) NOT NULL,
  "label" varchar(160) NOT NULL,
  "query" text NOT NULL,
  "source_url" text,
  "notes" text,
  "priority" smallint NOT NULL DEFAULT 5,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_checked_at" timestamp,
  "last_status" varchar(20) NOT NULL DEFAULT 'idle',
  "last_error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "promotion_watch_sources_user_id_idx"
  ON "promotion_watch_sources" ("user_id");

CREATE INDEX IF NOT EXISTS "promotion_watch_sources_channel_idx"
  ON "promotion_watch_sources" ("channel");

CREATE INDEX IF NOT EXISTS "promotion_watch_sources_active_idx"
  ON "promotion_watch_sources" ("is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "promotion_watch_sources_user_channel_query_uidx"
  ON "promotion_watch_sources" ("user_id", "channel", "query");

CREATE TABLE IF NOT EXISTS "promotion_tag_friends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "instagram_handle" varchar(120) NOT NULL,
  "daily_limit" smallint NOT NULL DEFAULT 5,
  "weekly_limit" smallint NOT NULL DEFAULT 20,
  "priority" smallint NOT NULL DEFAULT 5,
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_tagged_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "promotion_tag_friends_user_id_idx"
  ON "promotion_tag_friends" ("user_id");

CREATE INDEX IF NOT EXISTS "promotion_tag_friends_active_idx"
  ON "promotion_tag_friends" ("is_active");

CREATE INDEX IF NOT EXISTS "promotion_tag_friends_priority_idx"
  ON "promotion_tag_friends" ("priority");

CREATE UNIQUE INDEX IF NOT EXISTS "promotion_tag_friends_user_handle_uidx"
  ON "promotion_tag_friends" ("user_id", "instagram_handle");

CREATE TABLE IF NOT EXISTS "promotion_discoveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "source_id" uuid,
  "channel" varchar(30) NOT NULL,
  "title" varchar(255) NOT NULL,
  "organizer" varchar(255),
  "external_url" text NOT NULL,
  "external_id" varchar(160),
  "prize" varchar(500),
  "end_date" date,
  "rules_summary" text,
  "participation_notes" text,
  "score" smallint NOT NULL DEFAULT 50,
  "needs_friends" boolean NOT NULL DEFAULT false,
  "suggested_friends" text,
  "raw_payload" text,
  "status" varchar(20) NOT NULL DEFAULT 'new',
  "imported_promotion_id" uuid,
  "discovered_at" timestamp NOT NULL DEFAULT now(),
  "last_analyzed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp,
  CONSTRAINT "promotion_discoveries_source_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "promotion_watch_sources"("id") ON DELETE SET NULL,
  CONSTRAINT "promotion_discoveries_imported_promotion_id_fk"
    FOREIGN KEY ("imported_promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "promotion_discoveries_user_id_idx"
  ON "promotion_discoveries" ("user_id");

CREATE INDEX IF NOT EXISTS "promotion_discoveries_source_id_idx"
  ON "promotion_discoveries" ("source_id");

CREATE INDEX IF NOT EXISTS "promotion_discoveries_status_idx"
  ON "promotion_discoveries" ("status");

CREATE INDEX IF NOT EXISTS "promotion_discoveries_discovered_at_idx"
  ON "promotion_discoveries" ("discovered_at");

CREATE UNIQUE INDEX IF NOT EXISTS "promotion_discoveries_user_url_uidx"
  ON "promotion_discoveries" ("user_id", "external_url");

CREATE TABLE IF NOT EXISTS "promotion_tag_friend_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "friend_id" uuid NOT NULL,
  "discovery_id" uuid,
  "promotion_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'executed',
  "notes" text,
  "used_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "promotion_tag_friend_usage_friend_id_fk"
    FOREIGN KEY ("friend_id") REFERENCES "promotion_tag_friends"("id") ON DELETE CASCADE,
  CONSTRAINT "promotion_tag_friend_usage_discovery_id_fk"
    FOREIGN KEY ("discovery_id") REFERENCES "promotion_discoveries"("id") ON DELETE SET NULL,
  CONSTRAINT "promotion_tag_friend_usage_promotion_id_fk"
    FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "promotion_tag_friend_usage_user_id_idx"
  ON "promotion_tag_friend_usage" ("user_id");

CREATE INDEX IF NOT EXISTS "promotion_tag_friend_usage_friend_id_idx"
  ON "promotion_tag_friend_usage" ("friend_id");

CREATE INDEX IF NOT EXISTS "promotion_tag_friend_usage_discovery_id_idx"
  ON "promotion_tag_friend_usage" ("discovery_id");

CREATE INDEX IF NOT EXISTS "promotion_tag_friend_usage_promotion_id_idx"
  ON "promotion_tag_friend_usage" ("promotion_id");
