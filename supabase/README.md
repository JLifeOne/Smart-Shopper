# Supabase Infrastructure

This directory tracks database schema, storage policies, and edge function definitions for Smart Shopper.

## Prerequisites
- Supabase CLI (
pm install -g supabase) or Docker
- PostgreSQL 15

## Environment Setup
1. Create a new Supabase project via the dashboard.
2. Copy the project pi keys and project url into the mobile app .env files when ready.
3. Run migrations locally:
   `ash
   supabase start
   supabase db reset
   supabase db push
   `

## Structure
- migrations/ — SQL migration files in chronological order.
- unctions/ — Edge function source (add folder when functions are implemented).
- seed/ — Seed scripts for baseline data such as catalog categories.

## Quick Start
`ash
supabase db reset            # apply schema locally
supabase functions serve     # run edge functions locally
`

Refer to docs/next-steps.md for the authoritative onboarding checklist.
