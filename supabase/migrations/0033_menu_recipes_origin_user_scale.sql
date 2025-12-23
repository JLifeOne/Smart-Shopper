-- Allow a dedicated origin value for user-driven serving scale changes.
-- The mobile UI uses `origin = 'user_scale'` when persisting per-card servings so we can
-- distinguish scaling (no training) from content edits (may need training).

do $$
begin
  -- public.menu_recipes.origin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.menu_recipes'::regclass
      and conname = 'menu_recipes_origin_check'
  ) then
    if position('user_scale' in pg_get_constraintdef((
      select oid
      from pg_constraint
      where conrelid = 'public.menu_recipes'::regclass
        and conname = 'menu_recipes_origin_check'
      limit 1
    ))) = 0 then
      alter table public.menu_recipes
        drop constraint menu_recipes_origin_check;
      alter table public.menu_recipes
        add constraint menu_recipes_origin_check
          check (origin in ('llm_initial', 'llm_regen', 'user_edit', 'user_scale'));
    end if;
  else
    alter table public.menu_recipes
      add constraint menu_recipes_origin_check
        check (origin in ('llm_initial', 'llm_regen', 'user_edit', 'user_scale'));
  end if;

  -- public.menu_recipe_training_queue.origin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.menu_recipe_training_queue'::regclass
      and conname = 'menu_recipe_training_origin_check'
  ) then
    if position('user_scale' in pg_get_constraintdef((
      select oid
      from pg_constraint
      where conrelid = 'public.menu_recipe_training_queue'::regclass
        and conname = 'menu_recipe_training_origin_check'
      limit 1
    ))) = 0 then
      alter table public.menu_recipe_training_queue
        drop constraint menu_recipe_training_origin_check;
      alter table public.menu_recipe_training_queue
        add constraint menu_recipe_training_origin_check
          check (origin in ('llm_initial', 'llm_regen', 'user_edit', 'user_scale'));
    end if;
  else
    alter table public.menu_recipe_training_queue
      add constraint menu_recipe_training_origin_check
        check (origin in ('llm_initial', 'llm_regen', 'user_edit', 'user_scale'));
  end if;
end $$;

