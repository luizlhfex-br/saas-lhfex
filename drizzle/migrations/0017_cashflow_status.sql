ALTER TABLE "cash_movements"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'settled';

CREATE INDEX IF NOT EXISTS "cash_movements_status_idx"
  ON "cash_movements" ("status");
