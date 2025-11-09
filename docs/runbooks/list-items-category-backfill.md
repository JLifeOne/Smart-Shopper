# Runbook — Backfill `list_items` Category Metadata

## Context
Migration `0014_list_items_category_fields.sql` introduced five optional columns on `public.list_items` to store the classifier output:

| Column | Purpose |
| --- | --- |
| `category_id` | Canonical category identifier (e.g., `pantry`) |
| `category_confidence` | Classifier confidence (0–1) |
| `category_band` | UX band (`auto`, `needs_review`, `suggestion`) |
| `category_source` | Source of the classification (`dictionary`, `fuzzy`, `ml`, `manual`, etc.) |
| `category_canonical` | Canonical label used for the match |

New list items written by the mobile app already set these fields. Existing rows, however, have `NULL` values. This backfill fills them using the best available signals so analytics and insights can rely on complete data.

## Prerequisites
- Latest migrations applied (`supabase db reset` locally / `supabase db push` remotely).
- Access to the Supabase project with `service_role` privileges (backfill runs server-side).

## Strategy
1. Prefer explicit product categories when a list item references a `products` row.
2. Fall back to the classifier directly in batches for list items lacking product linkage.
3. Log progress and re-runnable chunks (id ranges) to avoid long locks.

## SQL Backfill (product-linked rows)
```sql
-- 1. Product-linked items inherit their product category.
update public.list_items li
set
  category_id = coalesce(li.category_id, p.category),
  category_source = coalesce(li.category_source, 'product'),
  category_confidence = coalesce(li.category_confidence, 0.95),
  category_band = coalesce(li.category_band, 'auto')
from public.products p
where li.product_remote_id = p.id
  and (li.category_id is null or li.category_confidence is null);
```

## Function Backfill (classifier)
Create a temporary function to call the classifier edge function in manageable chunks:
```sql
create table if not exists public.list_item_category_backfill (
  list_item_id uuid primary key,
  attempted_at timestamptz default now(),
  status text,
  payload jsonb
);
```

Then run a script (Node/Python) that:
1. Selects `N` list items missing `category_id`.
2. Hits the `receipt-normalize` edge function with their labels.
3. Updates each row with the returned category fields.
4. Records success/failure in `list_item_category_backfill`.

Example pseudo-code (Node):
```ts
const batch = await supabase
  .from('list_items')
  .select('id,label,store_id')
  .is('category_id', null)
  .limit(200);

const { data } = await fetch(`${SUPABASE_URL}/functions/v1/receipt-normalize`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, authorization: `Bearer ${SERVICE_ROLE}` },
  body: JSON.stringify({ items: batch.map(({ label, store_id }) => ({ rawName: label, storeId: store_id })) })
}).then((res) => res.json());

for (const item of data.items) {
  await supabase
    .from('list_items')
    .update({
      category_id: item.category ?? null,
      category_confidence: item.categoryConfidence,
      category_band: item.categoryBand,
      category_source: item.categorySource,
      category_canonical: item.categoryCanonical
    })
    .eq('id', item.id);
}
```

## Verification
- `supabase test db` (already updated) ensures columns exist.
- Spot check a few rows:
```sql
select id, label, category_id, category_confidence, category_band, category_source
from public.list_items
order by updated_at desc
limit 20;
```

## Rollout
1. Run the product-linked SQL backfill (fast, low risk).
2. Execute the batch classifier script during low traffic.
3. Monitor for rows still lacking `category_id`:
```sql
select count(*) from public.list_items where category_id is null;
```
4. Remove or archive the helper table/function once complete.

Document completion (date, operator) in this runbook or the ops log so future migrations know the data is backfilled.
