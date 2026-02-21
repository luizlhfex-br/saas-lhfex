CREATE TABLE "automation_version_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"version" varchar(20) NOT NULL,
	"previous_config" jsonb,
	"new_config" jsonb,
	"changes" jsonb NOT NULL,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"parent_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"phase" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"items" text NOT NULL,
	"notes" text,
	"required_by" date,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_to_tr_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"customized_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid,
	"process_id" uuid,
	"alert_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_date" date NOT NULL,
	"severity" varchar(20) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_procurement_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"previous_value" text,
	"new_value" text,
	"reason" text,
	"changed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_procurement_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"process_number" varchar(50) NOT NULL,
	"organization_name" varchar(255) NOT NULL,
	"modality_code" varchar(20) NOT NULL,
	"modality_label" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"budget_estimate" numeric(15, 2),
	"budget_currency" varchar(3) DEFAULT 'BRL',
	"publication_date" date,
	"closure_date" date,
	"contracted_value" numeric(15, 2),
	"contest_count" integer DEFAULT 0,
	"proposal_count" integer DEFAULT 0,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "public_procurement_notices_process_number_unique" UNIQUE("process_number")
);
--> statement-breakpoint
CREATE TABLE "public_procurement_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"lot_number" integer NOT NULL,
	"item_number" integer NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"estimated_unit_price" numeric(15, 2),
	"estimated_total_price" numeric(15, 2),
	"ncm_code" varchar(8),
	"specifications" text,
	"status" varchar(50) NOT NULL,
	"contractor_name" varchar(255),
	"contractor_cnpj" varchar(20),
	"agreed_price" numeric(15, 2),
	"delivery_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tr_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"tags" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_finance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" varchar(20) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL',
	"payment_method" varchar(50),
	"recurring_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "personal_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"target_value" numeric(15, 2),
	"current_value" numeric(15, 2),
	"unit" varchar(50),
	"start_date" date,
	"deadline" date,
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(50) DEFAULT 'in_progress',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_type" varchar(50) NOT NULL,
	"asset_name" varchar(255) NOT NULL,
	"ticker" varchar(20),
	"quantity" numeric(20, 8) NOT NULL,
	"purchase_price" numeric(15, 2) NOT NULL,
	"purchase_date" date NOT NULL,
	"current_price" numeric(15, 2),
	"current_value" numeric(15, 2),
	"gain_loss" numeric(15, 2),
	"gain_loss_percent" numeric(8, 2),
	"broker" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "personal_routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"routine_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"frequency" varchar(50) NOT NULL,
	"target_value" numeric(10, 2),
	"unit" varchar(30),
	"start_date" date,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"location" varchar(255),
	"estimated_budget" numeric(12, 2),
	"actual_spend" numeric(12, 2),
	"accommodation" text,
	"activities" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"company" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text,
	"prize" varchar(500),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"rules" text,
	"participation_status" varchar(50) DEFAULT 'pending',
	"link" varchar(500),
	"proof_of_participation" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "routine_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"completed" boolean NOT NULL,
	"value" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD COLUMN "subcategory" varchar(100);--> statement-breakpoint
ALTER TABLE "cash_movements" ADD COLUMN "has_invoice" varchar(1) DEFAULT 'N' NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD COLUMN "settlement_date" date;--> statement-breakpoint
ALTER TABLE "automation_version_history" ADD CONSTRAINT "automation_version_history_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_version_history" ADD CONSTRAINT "automation_version_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checklists" ADD CONSTRAINT "compliance_checklists_notice_id_public_procurement_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."public_procurement_notices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_to_tr_template" ADD CONSTRAINT "notice_to_tr_template_notice_id_public_procurement_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."public_procurement_notices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_to_tr_template" ADD CONSTRAINT "notice_to_tr_template_template_id_tr_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."tr_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_procurement_history" ADD CONSTRAINT "public_procurement_history_notice_id_public_procurement_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."public_procurement_notices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_procurement_processes" ADD CONSTRAINT "public_procurement_processes_notice_id_public_procurement_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."public_procurement_notices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_tracking" ADD CONSTRAINT "routine_tracking_routine_id_personal_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."personal_routines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_version_history_automation_id_idx" ON "automation_version_history" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "financial_categories_type_idx" ON "financial_categories" USING btree ("type");--> statement-breakpoint
CREATE INDEX "financial_categories_name_idx" ON "financial_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "financial_categories_parent_idx" ON "financial_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "compliance_checklists_notice_id_idx" ON "compliance_checklists" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "compliance_checklists_phase_idx" ON "compliance_checklists" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "notice_to_tr_template_notice_id_idx" ON "notice_to_tr_template" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "notice_to_tr_template_template_id_idx" ON "notice_to_tr_template" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "procurement_alerts_notice_id_idx" ON "procurement_alerts" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "procurement_alerts_due_date_idx" ON "procurement_alerts" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "procurement_alerts_severity_idx" ON "procurement_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "procurement_history_notice_id_idx" ON "public_procurement_history" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "procurement_history_change_type_idx" ON "public_procurement_history" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "procurement_notices_user_id_idx" ON "public_procurement_notices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "procurement_notices_process_number_idx" ON "public_procurement_notices" USING btree ("process_number");--> statement-breakpoint
CREATE INDEX "procurement_notices_status_idx" ON "public_procurement_notices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "procurement_notices_closure_date_idx" ON "public_procurement_notices" USING btree ("closure_date");--> statement-breakpoint
CREATE INDEX "procurement_processes_notice_id_idx" ON "public_procurement_processes" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "procurement_processes_status_idx" ON "public_procurement_processes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tr_templates_user_id_idx" ON "tr_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tr_templates_category_idx" ON "tr_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "personal_finance_user_id_idx" ON "personal_finance" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_finance_date_idx" ON "personal_finance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "personal_finance_category_idx" ON "personal_finance" USING btree ("category");--> statement-breakpoint
CREATE INDEX "personal_finance_recurring_id_idx" ON "personal_finance" USING btree ("recurring_id");--> statement-breakpoint
CREATE INDEX "personal_goals_user_id_idx" ON "personal_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_goals_category_idx" ON "personal_goals" USING btree ("category");--> statement-breakpoint
CREATE INDEX "personal_goals_deadline_idx" ON "personal_goals" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "personal_investments_user_id_idx" ON "personal_investments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_investments_asset_type_idx" ON "personal_investments" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "personal_routines_user_id_idx" ON "personal_routines" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_routines_routine_type_idx" ON "personal_routines" USING btree ("routine_type");--> statement-breakpoint
CREATE INDEX "planned_time_off_user_id_idx" ON "planned_time_off" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "planned_time_off_start_date_idx" ON "planned_time_off" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "promotions_user_id_idx" ON "promotions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "promotions_type_idx" ON "promotions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "promotions_end_date_idx" ON "promotions" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "promotions_participation_status_idx" ON "promotions" USING btree ("participation_status");--> statement-breakpoint
CREATE INDEX "routine_tracking_routine_id_idx" ON "routine_tracking" USING btree ("routine_id");--> statement-breakpoint
CREATE INDEX "routine_tracking_user_id_idx" ON "routine_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "routine_tracking_date_idx" ON "routine_tracking" USING btree ("date");