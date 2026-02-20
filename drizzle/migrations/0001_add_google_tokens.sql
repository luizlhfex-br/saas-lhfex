-- Create google_tokens table (Onda 4c)
CREATE TABLE IF NOT EXISTS "google_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"expiresAt" timestamp with time zone NOT NULL,
	"scope" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnectedAt" timestamp with time zone
);

-- Add cnae columns to clients (if not exists)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cnae_code" varchar(7);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cnae_description" varchar(500);

-- Add foreign key for google_tokens
ALTER TABLE "google_tokens" ADD CONSTRAINT "google_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
