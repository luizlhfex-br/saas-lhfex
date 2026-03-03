CREATE TYPE "public"."bill_category" AS ENUM('subscription', 'rent', 'credit_card', 'utility', 'loan', 'insurance', 'tax', 'other');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."ai_feature" ADD VALUE 'openclaw';--> statement-breakpoint
CREATE TABLE "personal_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_date" date,
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(20) DEFAULT 'pending',
	"category" varchar(50) DEFAULT 'personal',
	"notify_telegram" boolean DEFAULT true,
	"notify_days_before" integer DEFAULT 1,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "personal_wishlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"creator" varchar(255),
	"year" integer,
	"genre" varchar(100),
	"notes" text,
	"status" varchar(20) DEFAULT 'want',
	"rating" smallint,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pessoas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome_completo" varchar(255) NOT NULL,
	"cpf" varchar(14),
	"rg" varchar(30),
	"nascimento" date,
	"celular" varchar(30),
	"email" varchar(255),
	"instagram" varchar(100),
	"endereco" text,
	"senhas" text,
	"notas" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "promotion_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" varchar(18),
	"razao_social" varchar(500),
	"nome_fantasia" varchar(500),
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"bank_agency" varchar(20) NOT NULL,
	"bank_account" varchar(30) NOT NULL,
	"bank_pix" varchar(255),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"discount_type" varchar(20),
	"discount_value" numeric(10, 2),
	"min_purchase_amount" numeric(10, 2),
	"max_usage_count" integer,
	"current_usage_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"promotion_code" varchar(50),
	"telegram_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_raffle_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raffle_id" uuid NOT NULL,
	"participant_name" varchar(255) NOT NULL,
	"participant_email" varchar(255),
	"participant_phone" varchar(30),
	"ticket_number" integer,
	"is_winner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_raffles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"promotion_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"prize_description" text,
	"prize_value" numeric(10, 2),
	"number_of_winners" integer DEFAULT 1 NOT NULL,
	"participation_required" varchar(100),
	"draw_date" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_drawn" boolean DEFAULT false NOT NULL,
	"telegram_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radio_monitor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"audio_url" text,
	"transcription_text" text,
	"detected_promotion_keywords" text,
	"confidence" numeric(5, 2),
	"is_promotion" boolean DEFAULT false NOT NULL,
	"company_name" varchar(255),
	"promotion_details" text,
	"reviewed" boolean DEFAULT false NOT NULL,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radio_monitor_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid,
	"keyword" varchar(255) NOT NULL,
	"category" varchar(50),
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radio_monitor_songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"artist" varchar(255) NOT NULL,
	"album" varchar(255),
	"release_year" integer,
	"confidence" numeric(5, 2),
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radio_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"frequency" varchar(20),
	"city" varchar(100),
	"state" varchar(2),
	"stream_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"monitoring_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firefly_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"account_number" varchar(50),
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"current_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firefly_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"account_id" uuid NOT NULL,
	"period" varchar(20) NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"planned_amount" numeric(15, 2) NOT NULL,
	"actual_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"alert_threshold" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firefly_recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"debit_account_id" uuid NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"next_run_date" timestamp with time zone NOT NULL,
	"last_run_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firefly_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"description" varchar(500) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"debit_account_id" uuid NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"category" varchar(100),
	"reference" varchar(100),
	"attachment_url" text,
	"notes" text,
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"paid_at" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" "bill_category" NOT NULL,
	"description" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL',
	"due_day" integer,
	"next_due_date" date NOT NULL,
	"start_date" date,
	"end_date" date,
	"is_recurring" boolean DEFAULT true,
	"recurrence_months" integer DEFAULT 1,
	"is_auto_debit" boolean DEFAULT false,
	"payment_method" varchar(50),
	"alert_days_before" integer DEFAULT 3,
	"alert_one_day_before" boolean DEFAULT true,
	"status" "bill_status" DEFAULT 'active',
	"link" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mission_control_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"column" varchar(50) DEFAULT 'inbox' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"source" varchar(50) DEFAULT 'manual' NOT NULL,
	"source_agent" varchar(50),
	"notes" text,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openclaw_crons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"schedule" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"channel" varchar(20) DEFAULT 'telegram' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_result" varchar(20),
	"recent_logs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_study_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" varchar(255) NOT NULL,
	"nivel" varchar(20) DEFAULT 'graduacao' NOT NULL,
	"instituicao" varchar(255),
	"periodo_atual" varchar(50),
	"status" varchar(20) DEFAULT 'ativo' NOT NULL,
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_study_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tipo" varchar(30) DEFAULT 'prova' NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"data" date NOT NULL,
	"peso" numeric(5, 2),
	"nota" numeric(5, 2),
	"concluido" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_study_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" varchar(255) NOT NULL,
	"professor" varchar(255),
	"carga_horaria" integer,
	"nota_final" numeric(5, 2),
	"frequencia" numeric(5, 2),
	"status" varchar(20) DEFAULT 'cursando' NOT NULL,
	"anotacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "clean_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_clean" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'system'::text;--> statement-breakpoint
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'success', 'warning', 'error', 'invoice', 'process', 'changelog', 'system', 'automation', 'approval_request', 'process_status', 'invoice_due', 'eta_approaching');--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'system'::"public"."notification_type";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "external_id" varchar(100);--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "source" varchar(50) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "company_bank_accounts" ADD CONSTRAINT "company_bank_company_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_control_tasks" ADD CONSTRAINT "mission_control_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_study_events" ADD CONSTRAINT "personal_study_events_subject_id_personal_study_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."personal_study_subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_study_subjects" ADD CONSTRAINT "personal_study_subjects_course_id_personal_study_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."personal_study_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clean_days" ADD CONSTRAINT "clean_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_tasks_user_id_idx" ON "personal_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_tasks_status_idx" ON "personal_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "personal_tasks_due_date_idx" ON "personal_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "personal_tasks_priority_idx" ON "personal_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "personal_wishlist_user_id_idx" ON "personal_wishlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_wishlist_type_idx" ON "personal_wishlist" USING btree ("type");--> statement-breakpoint
CREATE INDEX "personal_wishlist_status_idx" ON "personal_wishlist" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pessoas_user_id_idx" ON "pessoas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pessoas_nome_idx" ON "pessoas" USING btree ("nome_completo");--> statement-breakpoint
CREATE INDEX "promotion_sites_user_id_idx" ON "promotion_sites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "promotion_sites_active_idx" ON "promotion_sites" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "company_promotions_company_idx" ON "company_promotions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_promotions_active_idx" ON "company_promotions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "company_raffle_participants_raffle_idx" ON "company_raffle_participants" USING btree ("raffle_id");--> statement-breakpoint
CREATE INDEX "company_raffle_participants_winner_idx" ON "company_raffle_participants" USING btree ("is_winner");--> statement-breakpoint
CREATE INDEX "company_raffles_company_idx" ON "company_raffles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_raffles_draw_date_idx" ON "company_raffles" USING btree ("draw_date");--> statement-breakpoint
CREATE INDEX "radio_monitor_events_station_idx" ON "radio_monitor_events" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "radio_monitor_events_recorded_idx" ON "radio_monitor_events" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "radio_monitor_events_promotion_idx" ON "radio_monitor_events" USING btree ("is_promotion");--> statement-breakpoint
CREATE INDEX "radio_monitor_keywords_station_idx" ON "radio_monitor_keywords" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "radio_monitor_keywords_category_idx" ON "radio_monitor_keywords" USING btree ("category");--> statement-breakpoint
CREATE INDEX "radio_monitor_keywords_active_idx" ON "radio_monitor_keywords" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "radio_monitor_songs_station_idx" ON "radio_monitor_songs" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "radio_monitor_songs_detected_idx" ON "radio_monitor_songs" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "radio_stations_city_idx" ON "radio_stations" USING btree ("city");--> statement-breakpoint
CREATE INDEX "radio_stations_active_idx" ON "radio_stations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "firefly_accounts_company_idx" ON "firefly_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "firefly_accounts_type_idx" ON "firefly_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "firefly_budgets_company_idx" ON "firefly_budgets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "firefly_budgets_account_idx" ON "firefly_budgets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "firefly_budgets_period_idx" ON "firefly_budgets" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "firefly_recurring_company_idx" ON "firefly_recurring_transactions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "firefly_recurring_next_run_idx" ON "firefly_recurring_transactions" USING btree ("next_run_date");--> statement-breakpoint
CREATE INDEX "firefly_transactions_company_idx" ON "firefly_transactions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "firefly_transactions_date_idx" ON "firefly_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "firefly_transactions_debit_idx" ON "firefly_transactions" USING btree ("debit_account_id");--> statement-breakpoint
CREATE INDEX "firefly_transactions_credit_idx" ON "firefly_transactions" USING btree ("credit_account_id");--> statement-breakpoint
CREATE INDEX "bill_payments_bill_id_idx" ON "bill_payments" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_payments_user_id_idx" ON "bill_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bill_payments_paid_at_idx" ON "bill_payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "bills_user_id_idx" ON "bills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bills_next_due_date_idx" ON "bills" USING btree ("next_due_date");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bills_deleted_at_idx" ON "bills" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "psc_user_id_idx" ON "personal_study_courses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pse_subject_id_idx" ON "personal_study_events" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "pse_user_id_idx" ON "personal_study_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pse_data_idx" ON "personal_study_events" USING btree ("data");--> statement-breakpoint
CREATE INDEX "pss_course_id_idx" ON "personal_study_subjects" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "pss_user_id_idx" ON "personal_study_subjects" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clean_days_user_date_idx" ON "clean_days" USING btree ("user_id","date");