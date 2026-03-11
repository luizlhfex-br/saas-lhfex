-- Fase 1: Create companies table
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

-- Fase 2: Create user_companies junction table
CREATE TABLE IF NOT EXISTS "public"."user_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"role" varchar(50) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Fase 3: Migrate existing company_profile to companies table
DO $$
DECLARE
	v_company_id uuid;
	v_company_name varchar;
BEGIN
	-- Check if there's existing data in company_profile
	IF EXISTS (SELECT 1 FROM company_profile LIMIT 1) THEN
		-- Get existing company data or create default
		WITH inserted AS (
			INSERT INTO "public"."companies" (
				slug, cnpj, razao_social, nome_fantasia, 
				address, city, state, zip_code, country, 
				phone, email, website, ie, im, cnae, cnae_description,
				bank_name, bank_agency, bank_account, bank_pix, plan, is_active
			)
			SELECT 
				COALESCE(LOWER(REPLACE(SUBSTRING(cnpj, 1, 6), '.', '-')), 'lhfex-default'),
				cnpj, razao_social, nomeFantasia,
				address, city, state, zip_code, country,
				phone, email, website, ie, im, cnae, cnaeDescription,
				bankName, bankAgency, bankAccount, bankPix, 'pro', true
			FROM company_profile
			LIMIT 1
			ON CONFLICT (slug) DO UPDATE SET updated_at = now()
			RETURNING id, nome_fantasia
		)
		SELECT id, nome_fantasia INTO v_company_id, v_company_name FROM inserted;
	ELSE
		-- Create default company if no company_profile exists
		INSERT INTO "public"."companies" (slug, nome_fantasia, plan, is_active)
		VALUES ('lhfex-default', 'LHFEX Default', 'pro', true)
		ON CONFLICT (slug) DO UPDATE SET updated_at = now()
		RETURNING id, nome_fantasia INTO v_company_id, v_company_name;
	END IF;
	
	-- Associate all existing users with the company
	INSERT INTO "public"."user_companies" (user_id, company_id, role, is_primary)
	SELECT u.id, v_company_id, 'owner', true
	FROM "public"."users" u
	WHERE NOT EXISTS (
		SELECT 1 FROM "public"."user_companies" uc 
		WHERE uc.user_id = u.id AND uc.company_id = v_company_id
	)
	ON CONFLICT DO NOTHING;
	
	-- Store the company ID for later use
	PERFORM set_config('app.default_company_id', v_company_id::text, false);
	
	RAISE NOTICE 'Migration: Default company created/migrated: %, ID: %', v_company_name, v_company_id;
END $$;

-- Fase 4: Add company_id column to sessions
ALTER TABLE "public"."sessions" 
ADD COLUMN IF NOT EXISTS "company_id" uuid 
REFERENCES "public"."companies"("id") ON DELETE set null;

-- Fase 5: Add company_id to business tables (with temp nullable columns)
ALTER TABLE "public"."clients" 
ADD COLUMN IF NOT EXISTS "company_id" uuid;

ALTER TABLE "public"."processes" 
ADD COLUMN IF NOT EXISTS "company_id" uuid;

ALTER TABLE "public"."invoices" 
ADD COLUMN IF NOT EXISTS "company_id" uuid;

ALTER TABLE "public"."automations" 
ADD COLUMN IF NOT EXISTS "company_id" uuid;

ALTER TABLE "public"."cash_movements" 
ADD COLUMN IF NOT EXISTS "company_id" uuid;

-- Fase 6: Get default company ID for data population
DO $$
DECLARE
	v_company_id uuid;
BEGIN
	-- Get the first (and should be only) company
	SELECT id INTO v_company_id FROM "public"."companies" LIMIT 1;
	
	IF v_company_id IS NOT NULL THEN
		-- Populate company_id for all existing records
		UPDATE "public"."clients" SET company_id = v_company_id WHERE company_id IS NULL;
		UPDATE "public"."processes" SET company_id = v_company_id WHERE company_id IS NULL;
		UPDATE "public"."invoices" SET company_id = v_company_id WHERE company_id IS NULL;
		UPDATE "public"."automations" SET company_id = v_company_id WHERE company_id IS NULL;
		UPDATE "public"."cash_movements" SET company_id = v_company_id WHERE company_id IS NULL;
		
		RAISE NOTICE 'Data migration complete. All business records associated with company: %', v_company_id;
	END IF;
END $$;

-- Fase 7: Add NOT NULL constraint and foreign keys
ALTER TABLE "public"."clients" 
ALTER COLUMN "company_id" SET NOT NULL,
ADD CONSTRAINT "clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;

ALTER TABLE "public"."processes" 
ALTER COLUMN "company_id" SET NOT NULL,
ADD CONSTRAINT "processes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;

ALTER TABLE "public"."invoices" 
ALTER COLUMN "company_id" SET NOT NULL,
ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;

ALTER TABLE "public"."automations" 
ALTER COLUMN "company_id" SET NOT NULL,
ADD CONSTRAINT "automations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;

ALTER TABLE "public"."cash_movements" 
ALTER COLUMN "company_id" SET NOT NULL,
ADD CONSTRAINT "cash_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;

-- Fase 8: Add indexes
CREATE INDEX IF NOT EXISTS "clients_company_idx" ON "public"."clients" ("company_id");
CREATE INDEX IF NOT EXISTS "processes_company_id_idx" ON "public"."processes" ("company_id");
CREATE INDEX IF NOT EXISTS "invoices_company_id_idx" ON "public"."invoices" ("company_id");
CREATE INDEX IF NOT EXISTS "automations_company_id_idx" ON "public"."automations" ("company_id");
CREATE INDEX IF NOT EXISTS "cash_movements_company_id_idx" ON "public"."cash_movements" ("company_id");
CREATE INDEX IF NOT EXISTS "user_companies_user_idx" ON "public"."user_companies" ("user_id");
CREATE INDEX IF NOT EXISTS "user_companies_company_idx" ON "public"."user_companies" ("company_id");

-- Fase 9: Add missing columns from 0008 migration
ALTER TABLE "processes" 
ADD COLUMN IF NOT EXISTS "cost_control_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "processes" 
ADD COLUMN IF NOT EXISTS "estimated_cost" numeric(15, 2);
ALTER TABLE "processes" 
ADD COLUMN IF NOT EXISTS "actual_cost" numeric(15, 2);
ALTER TABLE "processes" 
ADD COLUMN IF NOT EXISTS "cost_notes" text;

ALTER TABLE "promotions" 
ADD COLUMN IF NOT EXISTS "user_lucky_numbers" text;
ALTER TABLE "promotions" 
ADD COLUMN IF NOT EXISTS "official_lucky_number" varchar(120);
ALTER TABLE "promotions" 
ADD COLUMN IF NOT EXISTS "inferred_lucky_number" varchar(120);
