-- Step 4 database side: auto-create a profile for every new auth user + onboarding flag.
-- Run AFTER 0001_muse_core.sql. Idempotent.
alter table public.profiles add column if not exists onboarded boolean not null default false;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),          -- temporary; chosen properly in onboarding
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'New artist'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill: accounts that existed before this trigger
insert into public.profiles (id, username, display_name)
select u.id, 'user_' || substr(replace(u.id::text, '-', ''), 1, 12),
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'New artist')
from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);
