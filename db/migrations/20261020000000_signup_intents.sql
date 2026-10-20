-- What a new owner asked for at sign-up. Managed Better Auth keeps no free-form user metadata,
-- and a magic-link sign-up creates its user only when the link is clicked, so the sign-up action
-- stores the shop name and language here, keyed by the (lowercased) email. The console reads it
-- once, on the account's first visit, and deletes it. Service-only.

create table public.signup_intents (
  email text primary key,
  shop_name text,
  locale text not null default 'ar',
  created_at timestamptz not null default now(),
  constraint signup_intents_email_lower check (email = lower(email)),
  constraint signup_intents_locale_valid check (locale in ('ar', 'fr', 'en')),
  constraint signup_intents_shop_name_length check (shop_name is null or char_length(shop_name) <= 80)
);

alter table public.signup_intents enable row level security;
revoke all on public.signup_intents from anon, authenticated;
