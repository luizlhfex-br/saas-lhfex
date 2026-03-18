DO $$
BEGIN
  CREATE TYPE "openclaw_run_status" AS ENUM ('queued', 'running', 'success', 'error', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE "openclaw_heartbeat_status" AS ENUM ('healthy', 'degraded', 'offline');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE "openclaw_handoff_status" AS ENUM ('requested', 'accepted', 'completed', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE "openclaw_work_item_status" AS ENUM ('backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE "openclaw_work_item_priority" AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "openclaw_agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" varchar(50) NOT NULL,
  "agent_name" varchar(120),
  "agent_role" varchar(120),
  "provider" varchar(80),
  "model" varchar(120),
  "status" "openclaw_run_status" DEFAULT 'running' NOT NULL,
  "input" jsonb,
  "output" jsonb,
  "error_message" text,
  "prompt_tokens" integer,
  "completion_tokens" integer,
  "total_tokens" integer,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "openclaw_agent_runs_company_id_idx" ON "openclaw_agent_runs" ("company_id");
CREATE INDEX IF NOT EXISTS "openclaw_agent_runs_agent_id_idx" ON "openclaw_agent_runs" ("agent_id", "started_at");
CREATE INDEX IF NOT EXISTS "openclaw_agent_runs_status_idx" ON "openclaw_agent_runs" ("status", "started_at");

CREATE TABLE IF NOT EXISTS "openclaw_agent_heartbeats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" varchar(50) NOT NULL,
  "agent_name" varchar(120),
  "status" "openclaw_heartbeat_status" DEFAULT 'healthy' NOT NULL,
  "provider" varchar(80),
  "model" varchar(120),
  "summary" text,
  "details" jsonb,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "openclaw_agent_heartbeats_company_id_idx" ON "openclaw_agent_heartbeats" ("company_id");
CREATE INDEX IF NOT EXISTS "openclaw_agent_heartbeats_agent_id_idx" ON "openclaw_agent_heartbeats" ("agent_id", "checked_at");
CREATE INDEX IF NOT EXISTS "openclaw_agent_heartbeats_status_idx" ON "openclaw_agent_heartbeats" ("status", "checked_at");

CREATE TABLE IF NOT EXISTS "openclaw_agent_handoffs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "from_agent_id" varchar(50),
  "to_agent_id" varchar(50) NOT NULL,
  "status" "openclaw_handoff_status" DEFAULT 'requested' NOT NULL,
  "objective" text NOT NULL,
  "context" jsonb,
  "data_consulted" jsonb,
  "expected_delivery" text,
  "criteria" text,
  "risk_known" text,
  "result" jsonb,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "openclaw_agent_handoffs_company_id_idx" ON "openclaw_agent_handoffs" ("company_id");
CREATE INDEX IF NOT EXISTS "openclaw_agent_handoffs_to_agent_idx" ON "openclaw_agent_handoffs" ("to_agent_id", "created_at");
CREATE INDEX IF NOT EXISTS "openclaw_agent_handoffs_status_idx" ON "openclaw_agent_handoffs" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "openclaw_agent_work_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" varchar(50) NOT NULL,
  "process_id" uuid REFERENCES "processes"("id") ON DELETE SET NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  "status" "openclaw_work_item_status" DEFAULT 'backlog' NOT NULL,
  "priority" "openclaw_work_item_priority" DEFAULT 'medium' NOT NULL,
  "source" varchar(60),
  "context" jsonb,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "openclaw_agent_work_items_company_id_idx" ON "openclaw_agent_work_items" ("company_id");
CREATE INDEX IF NOT EXISTS "openclaw_agent_work_items_agent_id_idx" ON "openclaw_agent_work_items" ("agent_id", "status", "updated_at");
CREATE INDEX IF NOT EXISTS "openclaw_agent_work_items_status_idx" ON "openclaw_agent_work_items" ("status", "priority", "updated_at");
CREATE INDEX IF NOT EXISTS "openclaw_agent_work_items_process_id_idx" ON "openclaw_agent_work_items" ("process_id");
