# Onda 4c — Database Migration Required

## Status
- ✅ Code pushed to GitHub (commit 7e75103)
- ✅ Routes created (/api/google-auth, /api/google-callback)
- ✅ Settings UI updated with Google Connect button
- ⏳ **Database migration pending** — googleTokens table + CNAE columns

## What Changed in Database Schema

### New Table: google_tokens
```sql
CREATE TABLE public.google_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone NOT NULL,
  scope varchar(1024) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  disconnected_at timestamp with time zone
);
```

### Modified: clients Table
Add two new columns:
- `cnae_code` (varchar 7) — CNAE classification code
- `cnae_description` (varchar 500) — Description of CNAE activity

## How to Apply Migration

### Option 1: Automatic (Recommended)
```bash
npm run db:push
# When prompted about cnae_description column:
# > Should cnae_description be create or rename?
# Select: + cnae_description (create column)
# Press Enter to confirm
```

### Option 2: Manual SQL (If Auto fails)
Connect to PostgreSQL and run:
```sql
-- Create googleTokens table
CREATE TABLE IF NOT EXISTS google_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone NOT NULL,
  scope varchar(1024) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  disconnected_at timestamp with time zone
);

-- Add CNAE columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnae_code varchar(7);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnae_description varchar(500);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS google_tokens_user_id_idx ON google_tokens(user_id);
CREATE INDEX IF NOT EXISTS google_tokens_disconnected_idx ON google_tokens(disconnected_at);
```

## After Migration

1. **Test locally**:
```bash
npm run dev
# Navigate to Settings
# Click "Connect Google"  
# Should redirect to Google OAuth consent
```

2. **Verify in production**:
- Deploy will auto-trigger after this migration completes
- Visit https://saas.lhfex.com.br/settings
- Check if "Conectar Google" button appears

## Files Modified

- `drizzle/schema/google.ts` — New schema definition
- `app/lib/google.server.ts` — OAuth2 implementation
- `app/routes/api.google-auth.tsx` — Consent redirect
- `app/routes/api.google-callback.tsx` — Token exchange
- `app/routes/settings.tsx` — UI integration
- `app/i18n/pt-BR.ts` + `en.ts` — New strings
- `drizzle/schema/index.ts` — Export google schema

## Next Steps After Migration

Onda 4c is now **90% complete**. Remaining:
- [ ] Database migration (THIS STEP)
- [ ] Local test of Google OAuth flow
- [ ] Production deployment + health check

Then proceed to **Onda 5 — Relatório Financeiro** which builds on top of Google Sheets integration.

---

**Created**: 2026-02-19
**Status**: Ready for DB migration
**Blocker**: Interactive prompt in drizzle-kit (requires manual stdin)
