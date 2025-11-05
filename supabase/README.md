# Supabase Infrastructure

This directory tracks database schema, storage policies, and edge function definitions for Smart Shopper.

## Prerequisites
- Supabase CLI (see [installation guide](https://github.com/supabase/cli#install-the-cli)) or Docker
- PostgreSQL 15

## Environment Setup
1. Create a new Supabase project via the dashboard.
2. Copy the project API keys and project URL into the mobile app `.env` files when ready.
3. Run migrations locally:
   ```bash
   supabase start
   supabase db reset
   supabase db push
   ```

## Structure
- `migrations/` — SQL migration files in chronological order.
- `functions/` — Edge function source.
- `seed/` — Seed scripts for baseline data such as catalog categories.
- `tests/` — SQL smoke tests executed by `supabase test db`.

## Quick Start
```bash
supabase db reset            # apply schema locally
supabase test db             # run migration smoke tests
supabase functions serve     # run edge functions locally
```

Refer to `docs/next-steps.md` for the authoritative onboarding checklist.
