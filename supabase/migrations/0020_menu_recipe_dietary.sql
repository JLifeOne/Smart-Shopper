-- Dietary and allergen metadata on menu recipes

alter table public.menu_recipes
  add column if not exists dietary_tags text[] default '{}'::text[],
  add column if not exists allergen_tags text[] default '{}'::text[];

create index if not exists menu_recipes_dietary_idx on public.menu_recipes using gin (dietary_tags);
create index if not exists menu_recipes_allergen_idx on public.menu_recipes using gin (allergen_tags);
