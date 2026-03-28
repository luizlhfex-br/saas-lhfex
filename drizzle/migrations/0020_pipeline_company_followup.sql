ALTER TABLE IF EXISTS "deals"
  ADD COLUMN IF NOT EXISTS "company_id" uuid;

ALTER TABLE IF EXISTS "deals"
  ADD COLUMN IF NOT EXISTS "next_action" varchar(500);

ALTER TABLE IF EXISTS "deals"
  ADD COLUMN IF NOT EXISTS "next_follow_up_at" timestamp with time zone;

ALTER TABLE IF EXISTS "deals"
  ADD COLUMN IF NOT EXISTS "lost_reason" text;

UPDATE "deals" AS d
SET "company_id" = c."company_id"
FROM "clients" AS c
WHERE d."client_id" = c."id"
  AND d."company_id" IS NULL;

UPDATE "deals" AS d
SET "company_id" = uc."company_id"
FROM "user_companies" AS uc
WHERE d."created_by" = uc."user_id"
  AND uc."is_primary" = true
  AND d."company_id" IS NULL;

UPDATE "deals"
SET "company_id" = fallback_company."id"
FROM (
  SELECT "id"
  FROM "companies"
  ORDER BY "created_at" ASC
  LIMIT 1
) AS fallback_company
WHERE "deals"."company_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'deals'
      AND column_name = 'company_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "deals"
      ALTER COLUMN "company_id" SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deals_company_id_fkey'
  ) THEN
    ALTER TABLE "deals"
      ADD CONSTRAINT "deals_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "deals_company_id_idx"
  ON "deals" ("company_id");

CREATE INDEX IF NOT EXISTS "deals_company_stage_idx"
  ON "deals" ("company_id", "stage");

CREATE INDEX IF NOT EXISTS "deals_next_follow_up_idx"
  ON "deals" ("next_follow_up_at");
