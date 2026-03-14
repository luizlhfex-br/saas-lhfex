CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"value_amount" numeric(12, 2) NOT NULL,
	"value_currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"due_day" integer,
	"due_date" date,
	"recurrence" varchar(20) DEFAULT 'monthly' NOT NULL,
	"payment_method" varchar(50),
	"login_hint" text,
	"notes" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"alert_days_before" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ALTER COLUMN "provider" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "radio_stations" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "radio_stations" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "radio_stations" ADD COLUMN "contact_whatsapp" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_company_id_idx" ON "subscriptions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_due_date_idx" ON "subscriptions" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "subscriptions_deleted_at_idx" ON "subscriptions" USING btree ("deleted_at");--> statement-breakpoint
DROP TYPE "public"."ai_provider";