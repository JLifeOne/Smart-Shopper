alter table if exists public.list_items
  add column if not exists category_id text,
  add column if not exists category_confidence numeric,
  add column if not exists category_band text,
  add column if not exists category_source text,
  add column if not exists category_canonical text;

comment on column public.list_items.category_id is 'Canonical category identifier from classifier/dictionary';
comment on column public.list_items.category_confidence is 'Classifier confidence for the category assignment';
comment on column public.list_items.category_band is 'Confidence band (auto, needs_review, suggestion) for UX state';
comment on column public.list_items.category_source is 'Source of the classification (dictionary, fuzzy, ml, manual)';
comment on column public.list_items.category_canonical is 'Canonical name that produced the match (e.g., dictionary entry)';
