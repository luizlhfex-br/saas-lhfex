# Onda 4c — Database Migration Manual

## Status
- ✅ Code: 100% complete (Onda 4c — Google OAuth)
- ✅ Build: Passing (2569 modules)
- ✅ Migration generated: `drizzle/migrations/0000_lovely_spectrum.sql`
- ⏳ **NEEDED**: Manual `npm run db:push` confirmation

## Why Manual?
The Drizzle kit `db:push` command is now asking for confirmation because:
- The old schema (Onda 5.1) had column `ramo_atividade`, `phone`, `email`, etc in `clients` table
- The new schema replaces these with `cnae_code` and `cnae_description`
- Drizzle is warning about potential data loss before making the deletion

## How to Complete

### Option 1: Interactive Confirmation (RECOMMENDED)
Run this command and respond when prompted:
```bash
npm run db:push
```

When you see this prompt:
```
Warning  Found data-loss statements:
· You're about to delete ramo_atividade column in clients table
· You're about to delete phone column in clients table
...
Do you still want to push changes?
❯ No, abort
  Yes, I want to remove 6 columns,
```

**Select**: `Yes, I want to remove 6 columns,` (use arrow keys + Enter)

### Option 2: Direct SQL (if Option 1 fails)
If the interactive prompt doesn't work, execute directly via PostgreSQL client:

```sql
-- Execute migrations from drizzle/migrations/0000_lovely_spectrum.sql
-- The file contains all 20 tables + constraints + indexes

-- Critical for Onda 4c:
CREATE TABLE "google_tokens" (
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

ALTER TABLE "google_tokens" 
  ADD CONSTRAINT "google_tokens_userId_users_id_fk" 
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") 
  ON DELETE cascade ON UPDATE no action;
```

## Verification
After migration completes, verify:
```sql
-- Check google_tokens table exists
SELECT tablename FROM pg_tables WHERE tablename = 'google_tokens';

-- Should return: google_tokens

-- Check columns
\d google_tokens

-- Should show: id, userId, accessToken, refreshToken, expiresAt, scope, createdAt, updatedAt, disconnectedAt
```

## Next Steps After Migration
1. **Onda 4c** will be fully functional
2. **Onda 5** (financial export) will work:
   - `getValidGoogleToken()` requires googleTokens table
   - App can now export financial reports to Google Sheets
3. **Onda 6** (Backend Automations) can begin

## Timeline
- **Estimated time**: 2-5 minutes
- **Impact**: No downtime needed (POST db:push, can deploy immediately)
- **Rollback**: If needed, run `npm run db:pull` to revert schema (but data would remain)

## Questions?
If the migration fails or you need help, check:
1. Database connection (ensure DATABASE_URL is correct in .env)
2. PostgreSQL version (15+ required)
3. User has DDL permissions on public schema
4. Run `npm run db:generate` again if migration file corrupted
