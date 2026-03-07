ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS cost_control_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(15,2),
  ADD COLUMN IF NOT EXISTS actual_cost numeric(15,2),
  ADD COLUMN IF NOT EXISTS cost_notes text;
