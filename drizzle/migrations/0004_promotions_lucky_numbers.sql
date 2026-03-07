ALTER TABLE "promotions"
  ADD COLUMN IF NOT EXISTS "user_lucky_numbers" text,
  ADD COLUMN IF NOT EXISTS "official_lucky_number" varchar(120),
  ADD COLUMN IF NOT EXISTS "inferred_lucky_number" varchar(120);