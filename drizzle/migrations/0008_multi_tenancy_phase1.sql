-- Multi-Tenancy Phase 1: Safe Data Migration
-- Creates companies and user_companies tables with data migration

-- Step 1: Create companies table
CREATE TABLE IF NOT EXISTS "public"."companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"cnpj" varchar(18),
	"razao_social" varchar(500),
	"nome_fantasia" varchar(500) NOT NULL,
	"address" text,
	"city" varchar(255),
	"state" varchar(2),
	"zip_code" varchar(10),
	"country" varchar(100) DEFAULT 'Brasil' NOT NULL,
	"phone" varchar(30),
	"email" varchar(255),
	"website" varchar(500),
	"ie" varchar(30),
	"im" varchar(30),
	"cnae" varchar(7),
	"cnae_description" varchar(500),
	"bank_name" varchar(100),
	"bank_agency" varchar(20),
	"bank_account" varchar(30),
	"bank_pix" varchar(255),
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);

-- Step 2: Create user_companies table
CREATE TABLE IF NOT EXISTS "public"."user_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"role" varchar(50) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Step 3: Populate default company from company_profile
INSERT INTO "public"."companies" (slug, cnpj, razao_social, nome_fantasia, address, city, state, zip_code, country, phone, email, website, ie, im, cnae, cnae_description, bank_name, bank_agency, bank_account, bank_pix, plan, is_active)
SELECT 
	COALESCE(LOWER(REPLACE(SUBSTRING(cnpj, 1, 6), '.', '-')), 'lhfex-default'),
	cnpj,
	razao_social,
	COALESCE(nomeFantasia, 'LHFEX Default'),
	address,
	city,
	state,
	zip_code,
	COALESCE(country, 'Brasil'),
	phone,
	email,
	website,
	ie,
	im,
	cnae,
	cnaeDescription,
	bankName,
	bankAgency,
	bankAccount,
	bankPix,
	'pro',
	true
FROM company_profile
ON CONFLICT (slug) DO NOTHING;

-- Step 4: If no company was created from company_profile, create default
INSERT INTO "public"."companies" (slug, nome_fantasia)
VALUES ('lhfex-default', 'LHFEX Default')
ON CONFLICT (slug) DO NOTHING;

-- Step 5: Associate all users with default company
INSERT INTO "public"."user_companies" (user_id, company_id, role, is_primary)
SELECT u.id, c.id, 'owner', true
FROM "public"."users" u, "public"."companies" c
WHERE c.slug = 'lhfex-default' 
  AND NOT EXISTS (SELECT 1 FROM "public"."user_companies" uc WHERE uc.user_id = u.id)
ON CONFLICT DO NOTHING;

-- Step 6: Add company_id columns as nullable first
ALTER TABLE "public"."sessions" ADD COLUMN IF NOT EXISTS "company_id" uuid REFERENCES "public"."companies"("id") ON DELETE set null;
ALTER TABLE "public"."clients" ADD COLUMN IF NOT EXISTS "company_id" uuid;
ALTER TABLE "public"."processes" ADD COLUMN IF NOT EXISTS "company_id" uuid;
ALTER TABLE "public"."invoices" ADD COLUMN IF NOT EXISTS "company_id" uuid;
ALTER TABLE "public"."automations" ADD COLUMN IF NOT EXISTS "company_id" uuid;
ALTER TABLE "public"."cash_movements" ADD COLUMN IF NOT EXISTS "company_id" uuid;

-- Step 7: Populate company_id with default company
UPDATE "public"."clients" 
SET company_id = (SELECT id FROM "public"."companies" WHERE slug = 'lhfex-default' LIMIT 1)
WHERE company_id IS NULL;

UPDATE "public"."processes" 
SET company_id = (SELECT id FROM "public"."companies" WHERE slug = 'lhfex-default' LIMIT 1)
WHERE company_id IS NULL;

UPDATE "public"."invoices" 
SET company_id = (SELECT id FROM "public"."companies" WHERE slug = 'lhfex-default' LIMIT 1)
WHERE company_id IS NULL;

UPDATE "public"."automations" 
SET company_id = (SELECT id FROM "public"."companies" WHERE slug = 'lhfex-default' LIMIT 1)
WHERE company_id IS NULL;

UPDATE "public"."cash_movements" 
SET company_id = (SELECT id FROM "public"."companies" WHERE slug = 'lhfex-default' LIMIT 1)
WHERE company_id IS NULL;

-- Step 8: Create indexes
CREATE INDEX IF NOT EXISTS "clients_company_idx" ON "public"."clients" ("company_id");
CREATE INDEX IF NOT EXISTS "processes_company_id_idx" ON "public"."processes" ("company_id");
CREATE INDEX IF NOT EXISTS "invoices_company_id_idx" ON "public"."invoices" ("company_id");
CREATE INDEX IF NOT EXISTS "automations_company_id_idx" ON "public"."automations" ("company_id");
CREATE INDEX IF NOT EXISTS "cash_movements_company_id_idx" ON "public"."cash_movements" ("company_id");
CREATE INDEX IF NOT EXISTS "user_companies_user_idx" ON "public"."user_companies" ("user_id");
CREATE INDEX IF NOT EXISTS "user_companies_company_idx" ON "public"."user_companies" ("company_id");

-- Step 9: Add missing columns
ALTER TABLE "public"."processes" ADD COLUMN IF NOT EXISTS "cost_control_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."processes" ADD COLUMN IF NOT EXISTS "estimated_cost" numeric(15, 2);
ALTER TABLE "public"."processes" ADD COLUMN IF NOT EXISTS "actual_cost" numeric(15, 2);
ALTER TABLE "public"."processes" ADD COLUMN IF NOT EXISTS "cost_notes" text;

ALTER TABLE "public"."promotions" ADD COLUMN IF NOT EXISTS "user_lucky_numbers" text;
ALTER TABLE "public"."promotions" ADD COLUMN IF NOT EXISTS "official_lucky_number" varchar(120);
ALTER TABLE "public"."promotions" ADD COLUMN IF NOT EXISTS "inferred_lucky_number" varchar(120);
