ALTER TABLE "personal_finance"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'settled';

ALTER TABLE "personal_finance"
  ADD COLUMN IF NOT EXISTS "settled_at" date;

ALTER TABLE "personal_finance"
  ADD COLUMN IF NOT EXISTS "is_fixed" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "personal_finance_status_idx"
  ON "personal_finance" ("status");

CREATE TABLE IF NOT EXISTS "personal_finance_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "month" varchar(7) NOT NULL,
  "income_goal" numeric(12, 2),
  "expense_limit" numeric(12, 2),
  "savings_goal" numeric(12, 2),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "personal_finance_goals_user_id_idx"
  ON "personal_finance_goals" ("user_id");

CREATE INDEX IF NOT EXISTS "personal_finance_goals_month_idx"
  ON "personal_finance_goals" ("month");

CREATE UNIQUE INDEX IF NOT EXISTS "personal_finance_goals_user_month_uidx"
  ON "personal_finance_goals" ("user_id", "month");
