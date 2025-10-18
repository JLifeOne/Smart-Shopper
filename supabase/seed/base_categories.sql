insert into public.products (id, brand, name, category, size_value, size_unit)
values (uuid_generate_v4(), null, 'Example Rice 1kg', 'pantry', 1000, 'g')
on conflict do nothing;
