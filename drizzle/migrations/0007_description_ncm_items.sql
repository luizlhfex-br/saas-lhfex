-- Migration 0007: Create description_ncm_items table for COMEX Descrição/NCM module

-- Create enum type
DO $$ BEGIN
  CREATE TYPE description_ncm_status AS ENUM ('draft', 'approved', 'revised');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS description_ncm_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_number varchar(100),
  supplier varchar(255),
  input_description text NOT NULL,
  generated_description text,
  suggested_ncm varchar(20),
  approved_ncm varchar(20),
  status description_ncm_status NOT NULL DEFAULT 'draft',
  observations text,
  prompt_version varchar(20) DEFAULT '1.0',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desc_ncm_user_idx ON description_ncm_items (user_id);
CREATE INDEX IF NOT EXISTS desc_ncm_status_idx ON description_ncm_items (status);
CREATE INDEX IF NOT EXISTS desc_ncm_reference_idx ON description_ncm_items (reference_number);
