-- Security layer: privileges, column limits, triggers, storage, realtime, data constraints.
-- RLS policies themselves live in the Drizzle schema (src/lib/db/schema).

------------------------------------------------------------------------------
-- 1. Privileges. Nothing is reachable through the Data API unless granted here.
--    `anon` gets no table access at all: public pages read through the server.
------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- profiles: read self; edit only display fields (never is_platform_admin)
grant select on public.profiles to authenticated;
grant update (full_name, locale, updated_at) on public.profiles to authenticated;

grant select on public.plans to authenticated;

-- merchants: owners edit shop fields; status/plan/period/slug change only through services
grant select on public.merchants to authenticated;
grant update (
  name, phone, address, branding, settings, is_open, accepting_orders,
  default_locale, locales, timezone, currency, updated_at
) on public.merchants to authenticated;

grant select on public.merchant_members to authenticated;
grant select, delete on public.staff_invitations to authenticated;
grant select on public.slug_redirects to authenticated;

grant select on public.subscriptions, public.invoices, public.payments, public.audit_logs
  to authenticated;

grant select, insert, update, delete on
  public.categories, public.items, public.option_groups, public.options, public.qr_codes
  to authenticated;

-- orders: members move status; everything else is written by the order service
grant select on public.orders, public.order_items, public.notification_events to authenticated;
grant update (
  status, accepted_at, preparing_at, ready_at, completed_at, canceled_at, cancel_reason, updated_at
) on public.orders to authenticated;

-- push subscriptions: members may see whether alerts are on, never endpoints or keys
grant select (
  id, order_id, merchant_id, status, failure_count, last_success_at, last_failure_at,
  created_at, updated_at
) on public.push_subscriptions to authenticated;

-- service-only tables: order_counters, webhook_events, rate_limit_buckets (no grants)

------------------------------------------------------------------------------
-- 2. updated_at maintenance
------------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'plans', 'merchants', 'subscriptions', 'invoices', 'payments',
    'categories', 'items', 'orders', 'push_subscriptions'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

------------------------------------------------------------------------------
-- 3. Profile row for every auth user
------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_locale text := new.raw_user_meta_data ->> 'locale';
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 80), ''),
    case when meta_locale in ('ar', 'fr', 'en') then meta_locale else 'ar' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------
-- 4. Data constraints (defense in depth behind Zod validation)
------------------------------------------------------------------------------

alter table public.merchants
  add constraint merchants_slug_format
    check (slug is null or slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  add constraint merchants_name_length check (char_length(name) between 1 and 80),
  add constraint merchants_locales_valid
    check (locales <@ array['ar', 'fr', 'en']::text[] and cardinality(locales) >= 1),
  add constraint merchants_default_locale_valid check (default_locale = any (locales));

alter table public.slug_redirects
  add constraint slug_redirects_format check (old_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$');

alter table public.plans
  add constraint plans_price_nonneg check (price_minor >= 0),
  add constraint plans_trial_nonneg check (trial_days >= 0),
  add constraint plans_interval_count_pos check (interval_count >= 1);

alter table public.invoices add constraint invoices_amount_nonneg check (amount_minor >= 0);
alter table public.payments add constraint payments_amount_nonneg check (amount_minor >= 0);

alter table public.categories add constraint categories_name_length
  check (char_length(name) between 1 and 60);

alter table public.items
  add constraint items_name_length check (char_length(name) between 1 and 80),
  add constraint items_description_length check (description is null or char_length(description) <= 300),
  add constraint items_price_range check (price_minor between 0 and 100000000);

alter table public.option_groups
  add constraint option_groups_select_range
    check (min_select >= 0 and max_select >= 1 and min_select <= max_select and max_select <= 20);

alter table public.options
  add constraint options_delta_range check (price_delta_minor between -100000000 and 100000000);

alter table public.qr_codes add constraint qr_codes_table_code_format
  check (table_code is null or table_code ~ '^[A-Za-z0-9_-]{1,12}$');

alter table public.orders
  add constraint orders_number_pos check (number > 0),
  add constraint orders_totals_nonneg check (subtotal_minor >= 0 and total_minor >= 0),
  add constraint orders_customer_name_length check (char_length(customer_name) between 1 and 40),
  add constraint orders_note_length check (note is null or char_length(note) <= 300),
  add constraint orders_cancel_reason_length
    check (cancel_reason is null or char_length(cancel_reason) <= 200),
  add constraint orders_locale_valid check (locale in ('ar', 'fr', 'en'));

alter table public.order_items
  add constraint order_items_quantity_range check (quantity between 1 and 50),
  add constraint order_items_totals_nonneg check (unit_price_minor >= 0 and line_total_minor >= 0);

------------------------------------------------------------------------------
-- 5. Storage buckets. No storage.objects policies: only the service role writes.
--    merchant-assets is public-read (logos, covers, item photos); receipts is private.
------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('merchant-assets', 'merchant-assets', true, 3145728,
    array['image/webp', 'image/jpeg', 'image/png']),
  ('receipts', 'receipts', false, 5242880,
    array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

------------------------------------------------------------------------------
-- 6. Realtime: merchants subscribe to their orders (authorized by RLS).
--    Customers use Broadcast topics instead, so no anon table access is needed.
------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
