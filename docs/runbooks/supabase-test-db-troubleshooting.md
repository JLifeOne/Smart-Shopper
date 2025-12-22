# Supabase `test db` Troubleshooting (pgTAP)

## How to update this doc (for humans + agents)
- Do **not** delete older entries. Append a new entry under **Troubleshooting Log** (newest-first).
- Include: **date**, **environment** (OS, Supabase CLI version), **command**, **symptom** (exact error), **root cause**, **fix**, **verification**, and **references** (commit SHA + file path).
- If a previous entry becomes outdated, add a short **Follow-up** under a new entry; don’t rewrite history.
- Never paste secrets (JWTs, anon/service keys). Redact tokens/headers; share only `correlationId`, error `code`, and sanitized shapes.

## Quick commands
- Reset local DB: `supabase db reset`
- Run DB smoke tests: `supabase test db --debug`

## Troubleshooting Log (newest-first)

### 2025-12-22 — `is(bigint, integer, unknown) does not exist` in pgTAP
**Environment**
- Windows PowerShell, Supabase CLI `2.65.5`, Postgres `17.6` (local Supabase)

**Symptom**
- `psql:0022_menu_usage_limits.test.sql:36: ERROR: function is(bigint, integer, unknown) does not exist`

**Root cause**
- `count(*)` returns `bigint`, but pgTAP’s `is(actual, expected, description)` expects `actual` and `expected` to be the same type.

**Fix**
- Cast expected literals to bigint (e.g. `0::bigint`) or cast the `count(*)` result to `int` when appropriate.
- Reference: `supabase/tests/0022_menu_usage_limits.test.sql`
- Fix commit: `409dadb`

**Verification**
- `supabase db reset`
- `supabase test db --debug`

---

### 2025-12-22 — Usage counters/list_items reads return NULL inside same statement
**Symptom**
- pgTAP assertions like “increments once” fail with `test result was NULL` right after calling write-heavy RPCs in a CTE.

**Root cause**
- Postgres statement snapshots mean writes performed inside functions may not be visible to other CTEs in the *same* SQL statement (command counter advances after the statement completes).

**Fix**
- Split tests into multiple statements: call the RPC (capture results via `\gset`), then run assertions in subsequent statements.
- References:
  - `supabase/tests/0026_menu_idempotency_sessions_lists_reviews.test.sql`
  - `supabase/tests/0029_menu_title_only_sync.test.sql`
- Fix commit: `409dadb`

---

### 2025-12-22 — `increment_menu_usage()` “uploads is ambiguous”
**Symptom**
- `ERROR: column reference "uploads" is ambiguous` inside `public.increment_menu_usage(...)` on newer Postgres.

**Root cause**
- In PL/pgSQL, `RETURNS TABLE (uploads int, list_creates int)` creates output variables named `uploads`/`list_creates`. Unqualified `RETURNING uploads, list_creates` becomes ambiguous with table columns.

**Fix**
- Qualify/alias returned columns and select them via explicit names.
- Reference: `supabase/migrations/0032_menu_usage_limits_plpgsql_fix.sql` (commit `6b0d9af`)

---

### 2025-12-22 — `auth.users.confirmed_at` generated column breaks test helper inserts
**Symptom**
- `cannot insert a non-DEFAULT value into column "confirmed_at"` / `Column "confirmed_at" is a generated column.`

**Root cause**
- Some GoTrue/Supabase versions define `auth.users.confirmed_at` as a generated column; generated columns must be omitted from INSERTs.

**Fix**
- Treat generated columns as non-insertable in `tests.create_supabase_user`.
- Reference: `supabase/tests/0000_test_helpers.sql` (commit `6c4f3db`)

---

### 2025-12-22 — `malformed array literal: "instance_id"` in `tests.create_supabase_user`
**Symptom**
- `ERROR: malformed array literal: "instance_id"` while building dynamic column arrays.

**Root cause**
- Using `cols := cols || 'instance_id'` (array concatenation) with a scalar text value is not portable; it can be parsed as an array literal.

**Fix**
- Use `array_append(cols, 'instance_id')` / `array_append(vals, ...)` consistently.
- Reference: `supabase/tests/0000_test_helpers.sql` (commit `87d5f5e`)

---

### 2025-12-22 — `open supabase\\.temp\\profile: The system cannot find the file specified.`
**Symptom**
- Warning printed when running `supabase test db --debug` on Windows.

**Root cause**
- Supabase CLI tries to read `supabase/.temp/profile` in debug mode; file may not exist in a fresh checkout.

**Fix**
- Create an empty file: `New-Item -ItemType File -Force supabase\\.temp\\profile`
- Note: `supabase/.temp` is gitignored.
