DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_tax_scenario') THEN
    CREATE TYPE "process_tax_scenario" AS ENUM ('air', 'sea', 'other');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_tax_expense_kind') THEN
    CREATE TYPE "process_tax_expense_kind" AS ENUM ('tax_base', 'final');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "process_tax_workbooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "process_id" uuid NOT NULL REFERENCES "processes"("id") ON DELETE CASCADE,
  "scenario" "process_tax_scenario" NOT NULL DEFAULT 'other',
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "exchange_rate" numeric(12, 6) NOT NULL DEFAULT '0',
  "freight_total_usd" numeric(15, 2) NOT NULL DEFAULT '0',
  "state_icms_rate" numeric(5, 2) NOT NULL DEFAULT '18',
  "quote_date" timestamp with time zone,
  "notes" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "process_tax_workbooks_process_id_uidx"
  ON "process_tax_workbooks" ("process_id");

CREATE INDEX IF NOT EXISTS "process_tax_workbooks_company_id_idx"
  ON "process_tax_workbooks" ("company_id");

CREATE TABLE IF NOT EXISTS "process_tax_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workbook_id" uuid NOT NULL REFERENCES "process_tax_workbooks"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "part_number" varchar(120),
  "description" text,
  "ncm" varchar(20),
  "quantity" numeric(15, 3) NOT NULL DEFAULT '0',
  "fob_usd" numeric(15, 2) NOT NULL DEFAULT '0',
  "net_weight_kg" numeric(15, 3) NOT NULL DEFAULT '0',
  "ii_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  "ipi_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  "pis_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  "cofins_rate" numeric(5, 2) NOT NULL DEFAULT '0',
  "icms_rate" numeric(5, 2),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "process_tax_items_workbook_id_idx"
  ON "process_tax_items" ("workbook_id");

CREATE INDEX IF NOT EXISTS "process_tax_items_company_id_idx"
  ON "process_tax_items" ("company_id");

CREATE INDEX IF NOT EXISTS "process_tax_items_ncm_idx"
  ON "process_tax_items" ("ncm");

CREATE TABLE IF NOT EXISTS "process_tax_expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workbook_id" uuid NOT NULL REFERENCES "process_tax_workbooks"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "kind" "process_tax_expense_kind" NOT NULL,
  "label" varchar(180) NOT NULL,
  "amount_brl" numeric(15, 2) NOT NULL DEFAULT '0',
  "notes" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "process_tax_expenses_workbook_id_idx"
  ON "process_tax_expenses" ("workbook_id");

CREATE INDEX IF NOT EXISTS "process_tax_expenses_company_id_idx"
  ON "process_tax_expenses" ("company_id");

CREATE INDEX IF NOT EXISTS "process_tax_expenses_kind_idx"
  ON "process_tax_expenses" ("kind");
