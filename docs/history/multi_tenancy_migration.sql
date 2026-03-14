-- Multi-Tenancy Migration Script
-- This script safely migrates the database to support multi-tenancy

-- Step 1: Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE,
  cnpj varchar(18),
  razao_social varchar(500),
  nome_fantasia varchar(500) NOT NULL,
  address text,
  city varchar(255),
  state varchar(2),
  zip_code varchar(10),
  country varchar(100) DEFAULT 'Brasil',
  phone varchar(30),
  email varchar(255),
  website varchar(500),
  ie varchar(30),
  im varchar(30),
  cnae varchar(7),
  cnae_description varchar(500),
  bank_name varchar(100),
  bank_agency varchar(20),
  bank_account varchar(30),
  bank_pix varchar(255),
  plan varchar(50) DEFAULT 'free',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 2: Create user_companies junction table
CREATE TABLE IF NOT EXISTS user_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role varchar(50) NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 3: Insert default company from company_profile
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Check if companies table is empty
  IF NOT EXISTS (SELECT 1 FROM companies) THEN
    INSERT INTO companies (slug, cnpj, razao_social, nome_fantasia, address, city, state, zip_code, country, phone, email, website, ie, im, cnae, cnae_description, bank_name, bank_agency, bank_account, bank_pix, plan, is_active)
    SELECT 
      COALESCE(LOWER(REPLACE(SUBSTRING(cnpj::text, 1, 6), '.', '-')), 'lhfex-default'),
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
    LIMIT 1
    ON CONFLICT (slug) DO NOTHING;
  END IF;
  
  -- Get the company_id for later use
  SELECT id INTO v_company_id FROM companies ORDER BY created_at ASC LIMIT 1;
  
  -- Associate all users with the company
  IF v_company_id IS NOT NULL THEN
    INSERT INTO user_companies (user_id, company_id, role, is_primary)
    SELECT id, v_company_id, 'owner', true FROM users
    WHERE NOT EXISTS (SELECT 1 FROM user_companies uc WHERE uc.user_id = users.id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Step 4: Add company_id columns (nullable first)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE processes ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS company_id uuid;

-- Step 5: Populate company_id from the default company
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM companies LIMIT 1;
  
  IF v_company_id IS NOT NULL THEN
    UPDATE clients SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE processes SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE invoices SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE automations SET company_id = v_company_id WHERE company_id IS NULL;
    UPDATE cash_movements SET company_id = v_company_id WHERE company_id IS NULL;
    
    RAISE NOTICE 'Populated company_id for all existing records with company: %', v_company_id;
  END IF;
END $$;

-- Step 6: Add NOT NULL constraints and create indexes
ALTER TABLE clients ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE processes ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE automations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE cash_movements ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS clients_company_idx ON clients(company_id);
CREATE INDEX IF NOT EXISTS processes_company_idx ON processes(company_id);
CREATE INDEX IF NOT EXISTS invoices_company_idx ON invoices(company_id);
CREATE INDEX IF NOT EXISTS automations_company_idx ON automations(company_id);
CREATE INDEX IF NOT EXISTS cash_movements_company_idx ON cash_movements(company_id);
CREATE INDEX IF NOT EXISTS user_companies_user_idx ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS user_companies_company_idx ON user_companies(company_id);

-- Step 7: Add missing columns
ALTER TABLE processes ADD COLUMN IF NOT EXISTS cost_control_enabled boolean DEFAULT false;
ALTER TABLE processes ADD COLUMN IF NOT EXISTS estimated_cost numeric(15, 2);
ALTER TABLE processes ADD COLUMN IF NOT EXISTS actual_cost numeric(15, 2);
ALTER TABLE processes ADD COLUMN IF NOT EXISTS cost_notes text;

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS user_lucky_numbers text;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS official_lucky_number varchar(120);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS inferred_lucky_number varchar(120);

-- Step 8: Add foreign key constraints (safely)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'clients_company_id_fk'
  ) THEN
    ALTER TABLE clients ADD CONSTRAINT clients_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'processes_company_id_fk'
  ) THEN
    ALTER TABLE processes ADD CONSTRAINT processes_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invoices_company_id_fk'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'automations_company_id_fk'
  ) THEN
    ALTER TABLE automations ADD CONSTRAINT automations_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cash_movements_company_id_fk'
  ) THEN
    ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_company_id_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Verification
SELECT COUNT(*) as companies_count FROM companies;
SELECT COUNT(*) as user_companies_count FROM user_companies;
SELECT COUNT(*) as clients_with_company FROM clients WHERE company_id IS NOT NULL;
SELECT COUNT(*) as processes_with_company FROM processes WHERE company_id IS NOT NULL;
SELECT COUNT(*) as invoices_with_company FROM invoices WHERE company_id IS NOT NULL;
