# Supabase `test db` Troubleshooting (pgTAP)

## How to update this doc (for humans + agents)
- Do **not** delete older entries. Append a new entry under **Troubleshooting Log** (newest-first).
- Include: **date**, **environment** (OS, Supabase CLI version), **command**, **symptom** (exact error), **root cause**, **fix**, **verification**, and **references** (commit SHA + file path).
- If a previous entry becomes outdated, add a short **Follow-up** under a new entry; don’t rewrite history.
- Never paste secrets (JWTs, anon/service keys). Redact tokens/headers; share only `correlationId`, error `code`, and sanitized shapes.

## Entry template (copy/paste)
```md
### YYYY-MM-DD — <short title>
**Environment**
- OS:
- Supabase CLI:
- Postgres (local):

**Command**
- `<command>`

**Symptom**
- `<exact error text>`

**Root cause**
- <what was actually wrong, and why it happened>

**Fix**
- <what changed, where, and why it is safe>
- References:
  - `<path:line>`
  - Commit: `<sha>`

**Verification**
- `<commands run>` + expected output
```

## Quick commands
- Reset local DB: `supabase db reset`
- Run DB smoke tests: `supabase test db --debug`

## Troubleshooting Log (newest-first)

### 2025-12-22 — Resolved: `supabase test db --debug` passes (Menus pgTAP)
**Environment**
- Windows PowerShell, Supabase CLI `2.65.5`, Postgres `17.6` (local Supabase)

**Command**
- `supabase db reset`
- `supabase test db --debug`

**What was fixed**
- pgTAP type mismatch (`count(*)` is `bigint`): cast expected values (commit `409dadb`).
- Postgres snapshot behavior: split write RPC calls from read assertions to avoid NULL reads (commit `409dadb`).
- PL/pgSQL name ambiguity in `increment_menu_usage()` (RETURNS TABLE vars vs column names): forward migration (commit `6b0d9af`).
- GoTrue schema drift: generated `auth.users.confirmed_at` must be omitted from INSERTs (commit `6c4f3db`).
- `throws_ok` + `\gset` variables: build SQL strings via `format(...)` (commit `ac6a2f2`).

**References**
- `supabase/tests/0022_menu_usage_limits.test.sql`
- `supabase/tests/0026_menu_idempotency_sessions_lists_reviews.test.sql`
- `supabase/tests/0029_menu_title_only_sync.test.sql`
- `supabase/tests/0000_test_helpers.sql`
- `supabase/migrations/0032_menu_usage_limits_plpgsql_fix.sql`

---

### 2025-12-22 — `throws_ok` fails with `syntax error at or near ":"`
**Environment**
- Windows PowerShell, Supabase CLI `2.65.5`, Postgres `17.6` (local Supabase)

**Symptom**
- pgTAP fails with:
  - `caught: 42601: syntax error at or near ":"`
  - Typically when the failing assertion is `throws_ok(...)`

**Root cause**
- `\gset` variables like `:'user_id'` are expanded by `psql` **before** sending SQL to Postgres.
- When you embed `:'user_id'` inside the *string* passed to `throws_ok($$...$$, ...)`, `psql` does not expand it, so Postgres receives a literal `:` token and errors.

**Fix**
- Build the query string using `format(...)` (or string concatenation) outside the `$$...$$` literal, e.g.:
  - `format($$select ... (%L::uuid, ...)$$, :'user_id')`
- Reference: `supabase/tests/0022_menu_usage_limits.test.sql`
- Fix commit: `ac6a2f2`

**Verification**
- `supabase test db --debug`

---

### 2025-12-22 — `failed to read profile: Config File "config" Not Found in "[]"` after creating `supabase/.temp/profile`
**Environment**
- Windows PowerShell, Supabase CLI `2.65.5`

**Symptom**
- `supabase test db --debug` fails immediately with:
  - `Loading profile from file: supabase\\.temp\\profile`
  - `failed to read profile: Config File "config" Not Found in "[]"`

**Root cause**
- `supabase/.temp/profile` is treated as a “profile override” input. If it exists but is empty/invalid, the CLI ends up with an empty profile name/path and fails to load profile config.

**Fix**
- Prefer: delete the override file: `Remove-Item supabase\\.temp\\profile`
- Or: set it to your configured profile name (commonly `supabase`):
  - PowerShell: `Set-Content -NoNewline supabase\\.temp\\profile supabase`

**Verification**
- `supabase test db --debug` proceeds to DB connection and runs pgTAP files.

---

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
- This warning is non-fatal; you can ignore it.
- If you want to silence it, create the file with a valid profile name (commonly `supabase`):
  - PowerShell: `Set-Content -NoNewline supabase\\.temp\\profile supabase`
- Note: `supabase/.temp` is gitignored.
