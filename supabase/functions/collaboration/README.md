# collaboration

Helper edge function to proxy invite RPCs when a thin REST surface is needed (e.g., for QR/short-link handlers). Mobile clients can call the underlying RPCs directly, but this function keeps the HTTP contract consistent for other clients.

## Local development

```bash
cd supabase/functions/collaboration
supabase functions serve --env-file .env.local
```

Expected environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
