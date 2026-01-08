# Menus — Observability & Alerts (Production Tier)

This runbook defines how to **detect**, **diagnose**, and **respond** to failures in the Menus pipeline using correlation IDs, structured logs, and environment guardrails.

## Goals
- Detect regressions quickly (error rate, latency, limit spikes).
- Make every user-facing failure diagnosable using a `correlationId`.
- Provide a clear response playbook (what to check, what to roll back, and what to communicate).

## Trace IDs (correlationId)
- Mobile sends `x-correlation-id` on every Menus request (`apps/mobile/src/features/menus/api.ts`).
- Edge functions propagate that value and include it in JSON logs, response headers (`x-correlation-id`), and error responses.
- When debugging, **do not share tokens/PII**. Share only:
  - `correlationId`, function name, timestamp, error `code`, and sanitized request shape.

## Standard log schema (menus edge functions)
All menus edge functions use `supabase/functions/_shared/observability.ts` to ensure consistent, structured JSON logs.
Required fields:
- `event`
- `correlationId`
Optional fields (use when available):
- `ownerId`, `sessionId`, `entityId`
- `durationMs`
- `status`, `errorCode`
- `provider` (e.g., `custom`, `openai`)
- `metadata` (small, non-PII payloads like counts/flags)
- `timestamp`

## Where to look (Supabase)
- **Edge function logs**: filter by `correlationId` to trace an end-to-end flow.
- **Postgres logs / errors**: look for RPC failures (`menu_create_session`, `menu_create_list`, `menu_create_title_dish`).

If you use an external log sink (recommended at scale), ensure:
- Logs are structured JSON.
- `correlationId` is indexed/searchable.
- Alerts can be created from log queries (error-rate and latency).

## Key user flows and events
Expected structured events (examples):
- Session create/update:
  - `menu_session_created` (`supabase/functions/menu-sessions/index.ts`)
  - `menu_session_updated` (`supabase/functions/menu-sessions/index.ts`)
  - `menu_session_items_insert` / `menu_session_items_update` (`supabase/functions/menu-session-items/index.ts`)
- Prompt / AI preview:
  - `menu_llm_call` / `menu_llm_response` (`supabase/functions/menus-llm/index.ts`)
  - `menu_llm_fallback` (`supabase/functions/menus-llm/index.ts`)
  - `menu_packaging_applied` (`supabase/functions/menus-llm/index.ts`)
- List conversion:
  - `menu_list_converted` (`supabase/functions/menus-lists/index.ts`)
- Reviews:
  - `menu_review_flag` (`supabase/functions/menus-reviews/index.ts`)
- Title-only saves:
  - `menu_title_dish_created` (`supabase/functions/menus-titles/index.ts`)
- Regeneration:
  - `menu_regenerate` / `menu_regenerate_llm_call` (`supabase/functions/menu-regenerate/index.ts`)
- Recipes:
  - `menu_recipe_created` / `menu_recipe_updated` / `menu_recipe_deleted` (`supabase/functions/menu-recipes/index.ts`)
- Policy:
  - `menu_policy_loaded` / `menu_policy_updated` (`supabase/functions/menus-policy/index.ts`)
- Pairings:
  - `menu_pairing_created` / `menu_pairing_deleted` (`supabase/functions/menus-pairings/index.ts`)
- Limits:
  - `menu_session_limit_exceeded` (`supabase/functions/menu-sessions/index.ts`)
  - `menu_list_limit_exceeded` (`supabase/functions/menus-lists/index.ts`)
  - `menu_title_dish_limit_exceeded` (`supabase/functions/menus-titles/index.ts`)
  - `menu_llm_limit_exceeded` (`supabase/functions/menus-llm/index.ts`)

All of the above should include:
- `correlationId`
- `ownerId` (user id)
- relevant entity ids (`sessionId`, `recipeId`, `dishId`, `listId`)
- `durationMs`
- `status` and/or error `code` when applicable

## Dashboards (minimum set)
Create dashboards (Supabase or external) per-function and per-flow:

1) **Error rate (5xx)**
- By function: `menu-sessions`, `menus-llm`, `menus-lists`, `menu-recipes`, `menu-regenerate`, `menus-reviews`, `menus-titles`, `menus-policy`
- Breakdown by error `code` (`limit_exceeded`, `policy_blocked`, `premium_required`, `internal_error`, etc.)

2) **Latency**
- p50/p95/p99 per function (especially `menus-llm`, `menus-lists`, `menu-sessions`)
- Track tail latency spikes (p95/p99), not only averages

3) **Limits & gating**
- Counts over time of:
  - `menu_session_limit_exceeded`, `menu_list_limit_exceeded`, `menu_title_dish_limit_exceeded`, `menu_llm_limit_exceeded`
  - breakdown by `metadata.scope`

4) **AI fallback / quality signals**
- `menus-llm` fallback usage (`usedFallback: true`)
  - Break down by `provider` (`custom` vs `openai`) to spot provider-specific issues
- clarification counts (`clarifications`)

## Alerts (recommended starting thresholds)
Tune thresholds per environment; start conservative:

- **5xx error rate**: > 1% for 5 minutes (per function) → page on-call
- **p95 latency**:
  - `menus-llm` p95 > 3s for 10 minutes
  - `menus-lists` p95 > 2s for 10 minutes
- **Limit spike**: `limit_exceeded` count > baseline × 3 for 15 minutes (could indicate loops/retries or policy bug)
- **Fallback spike**: `menus-llm usedFallback` > baseline × 2 for 15 minutes (could indicate LLM outage/contract drift)

## Supabase Log Explorer queries (copy/paste)
Use text search on the structured JSON logs (single-line JSON emitted by `logEvent`). If Log Explorer parses JSON fields, switch to field filters instead of text search.

Error rates (per function):
- `menu_llm_error`: search for `"event":"menu_llm_error"`
- `menu_session_created` + errors: search for `"event":"menu_session_created"` and compare with `"event":"menu_session_limit_exceeded"`
- `menu_list_converted` + errors: search for `"event":"menu_list_converted"` and compare with `"event":"menu_list_limit_exceeded"`

Limit spikes:
- Session limits: `"event":"menu_session_limit_exceeded"`
- List limits: `"event":"menu_list_limit_exceeded"`
- Title-only limits: `"event":"menu_title_dish_limit_exceeded"`
- LLM preview limits: `"event":"menu_llm_limit_exceeded"`

Latency (p95/p99):
- Filter by `"event":"menu_llm_response"` then aggregate `durationMs`.
- Filter by `"event":"menu_list_converted"` then aggregate `durationMs`.

If your plan supports Log Explorer alerts:
- Save each query and configure alert thresholds that match the **Alerts** section above.

## Incident response checklist
1) Identify the affected function(s) and gather:
   - `correlationId` samples
   - error `code`, timestamp range, environment
2) Check recent deploys/migrations touching:
   - `supabase/functions/menu-*`, `supabase/functions/menus-*`
   - `supabase/migrations/*menu*`
3) Determine category:
   - **policy/limits** (429/403 spikes): validate `menus-policy` output and runtime flags (`menu_dev_bypass`, `app_environment`)
   - **LLM** (502/5xx): validate `MENU_LLM_URL` reachability and contract/schema parsing
   - **DB/RPC** errors: validate RPCs (`menu_create_session`, `menu_create_title_dish`, `menu_create_list`) and RLS policies
4) Mitigate:
   - Roll back the recent change OR
   - Temporarily disable risky functionality via runtime flags (never bypass auth)
5) Confirm recovery:
   - error rate back to baseline
   - p95 latency stabilized
6) Post-incident:
   - write a short report (root cause, customer impact, prevention)
   - add/adjust alerts and tests for regression coverage
