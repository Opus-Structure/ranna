-- RLS helper functions. Must run before the schema migration, whose policies call them.
-- plpgsql bodies are not validated at creation, so referencing tables created later is fine.
-- security definer: the helpers read merchant_members/profiles without recursing into their RLS.

create or replace function public.member_merchant_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
    select mm.merchant_id
    from public.merchant_members mm
    where mm.user_id = (select auth.uid());
end;
$$;

create or replace function public.owner_merchant_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
    select mm.merchant_id
    from public.merchant_members mm
    where mm.user_id = (select auth.uid())
      and mm.role = 'owner';
end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
end;
$$;

revoke all on function public.member_merchant_ids() from public, anon;
revoke all on function public.owner_merchant_ids() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.member_merchant_ids() to authenticated;
grant execute on function public.owner_merchant_ids() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
