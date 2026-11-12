-- Friends, samples and published projects ("releases") with Public / Friends-only visibility.
-- Run AFTER migrations 0001-0004 (needs projects, project_files, notify(), etc). Idempotent.

-- ===================== TABLES =====================
create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b), check (user_a < user_b));      -- one row per pair, smaller uuid first
create index if not exists idx_friendships_b on public.friendships (user_b);

create table if not exists public.samples (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (char_length(description) <= 500),
  genre_id int references public.genres(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public','friends')),
  file_path text not null unique check (char_length(file_path) <= 400),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  rights_confirmed boolean not null check (rights_confirmed),
  created_at timestamptz not null default now());
create index if not exists idx_samples_owner on public.samples (owner_id, created_at desc);
create index if not exists idx_samples_feed on public.samples (visibility, created_at desc);

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  genre_id int references public.genres(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public','friends')),
  rights_confirmed boolean not null check (rights_confirmed),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists idx_releases_owner on public.releases (owner_id);
create index if not exists idx_releases_feed on public.releases (visibility, published_at desc);
-- Snapshots taken at publish time, so people outside the project can see credits and play the featured tracks
create table if not exists public.release_tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  file_id uuid references public.project_files(id) on delete cascade,
  name text not null, path text not null, mime_type text not null, position int not null default 1);
create index if not exists idx_release_tracks_release on public.release_tracks (release_id);
create index if not exists idx_release_tracks_path on public.release_tracks (path);
create table if not exists public.release_credits (
  release_id uuid not null references public.releases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  primary key (release_id, user_id));
create index if not exists idx_release_credits_user on public.release_credits (user_id);

-- Reports can now target samples and releases
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.reports'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%target_type%' loop
    execute format('alter table public.reports drop constraint %I', c);
  end loop;
  alter table public.reports add constraint reports_target_type_check check (target_type in ('profile','collaboration','sample','release'));
end $$;

-- ===================== VISIBILITY HELPERS =====================
create or replace function public.is_friend(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as
$$ select a is not null and b is not null and a <> b and exists (select 1 from friendships where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted') $$;

-- The one rule for "may the signed-in user see content owned by p_owner with visibility p_vis?"
create or replace function public.can_see_content(p_owner uuid, p_vis text) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when p_owner = auth.uid() then true
    when is_admin() then true
    when exists (select 1 from profiles where id = p_owner and is_suspended) then false
    when is_blocked_between(p_owner, auth.uid()) then false
    when p_vis = 'public' then true
    when p_vis = 'friends' then is_friend(p_owner, auth.uid())
    else false end $$;

create or replace function public.can_see_release(rid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from releases r where r.id = rid and (can_see_content(r.owner_id, r.visibility) or in_project(r.project_id))) $$;
create or replace function public.can_view_sample_media(p_name text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from samples s where s.file_path = p_name and can_see_content(s.owner_id, s.visibility)) $$;
create or replace function public.can_view_release_media(p_name text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from release_tracks t join releases r on r.id = t.release_id where t.path = p_name and (can_see_content(r.owner_id, r.visibility) or in_project(r.project_id))) $$;

-- ===================== TRIGGERS =====================
create or replace function public.guard_media_update() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'samples' and (new.owner_id <> old.owner_id or new.file_path <> old.file_path or new.mime_type <> old.mime_type or new.size_bytes <> old.size_bytes) then
    raise exception 'Not allowed'; end if;
  if tg_table_name = 'releases' then
    if new.owner_id <> old.owner_id or new.project_id <> old.project_id then raise exception 'Not allowed'; end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_samples on public.samples;
create trigger trg_guard_samples before update on public.samples for each row execute function public.guard_media_update();
drop trigger if exists trg_guard_releases on public.releases;
create trigger trg_guard_releases before update on public.releases for each row execute function public.guard_media_update();

create or replace function public.cap_samples() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from samples where owner_id = new.owner_id) >= 50 then raise exception 'You can keep up to 50 samples. Delete one to add another.'; end if;
  return new;
end $$;
drop trigger if exists trg_cap_samples on public.samples;
create trigger trg_cap_samples before insert on public.samples for each row execute function public.cap_samples();
drop trigger if exists rl_samples on public.samples;
create trigger rl_samples before insert on public.samples for each row execute function public.rate_limit(20, '1 hour', 'owner_id');

-- A project that stops being "completed" is taken off Discover
create or replace function public.trg_unpublish_on_status() returns trigger language plpgsql security definer set search_path = public as $$
begin delete from releases where project_id = new.id; return new; end $$;
drop trigger if exists trg_unpublish_on_status on public.projects;
create trigger trg_unpublish_on_status after update of status on public.projects for each row
  when (old.status = 'completed' and new.status is distinct from 'completed') execute function public.trg_unpublish_on_status();

-- ===================== FUNCTIONS (RPC) =====================
create or replace function public.publish_project(p_project uuid, p_title text, p_description text, p_genre int, p_visibility text, p_file_ids uuid[], p_rights boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pr projects; rid uuid; was_new boolean; n int; t text := left(btrim(coalesce(p_title, '')), 120); m record;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if is_suspended() then raise exception 'This account is unavailable'; end if;
  select * into pr from projects where id = p_project and creator_id = me;
  if not found then raise exception 'Only the project owner can publish'; end if;
  if pr.status <> 'completed' then raise exception 'Mark the project as completed before publishing'; end if;
  if t = '' then raise exception 'Add a title'; end if;
  if p_visibility not in ('public', 'friends') then raise exception 'Invalid visibility'; end if;
  if not coalesce(p_rights, false) then raise exception 'Please confirm you have the right to publish this'; end if;
  if cardinality(coalesce(p_file_ids, '{}')) not between 1 and 10 then raise exception 'Choose between 1 and 10 tracks'; end if;
  if (select count(distinct x) from unnest(p_file_ids) x) <> cardinality(p_file_ids) then raise exception 'Duplicate tracks'; end if;
  select count(*) into n from project_files where project_id = p_project and id = any (p_file_ids) and (mime_type like 'audio/%' or mime_type like 'video/%');
  if n <> cardinality(p_file_ids) then raise exception 'Only audio or video files from this project can be featured'; end if;

  insert into releases (project_id, owner_id, title, description, genre_id, visibility, rights_confirmed)
    values (p_project, me, t, left(nullif(btrim(coalesce(p_description, '')), ''), 1000), p_genre, p_visibility, true)
    on conflict (project_id) do update set title = excluded.title, description = excluded.description, genre_id = excluded.genre_id, visibility = excluded.visibility, rights_confirmed = true
    returning id, (xmax = 0) into rid, was_new;
  delete from release_tracks where release_id = rid;
  delete from release_credits where release_id = rid;
  insert into release_tracks (release_id, file_id, name, path, mime_type, position)
    select rid, f.id, f.name, f.path, f.mime_type, array_position(p_file_ids, f.id) from project_files f where f.id = any (p_file_ids);
  insert into release_credits (release_id, user_id, role) select rid, user_id, role from project_members where project_id = p_project;
  if was_new then
    for m in select user_id from project_members where project_id = p_project and user_id <> me loop
      perform notify(m.user_id, 'project_published', 'Your project "' || t || '" was published on Discover', p_project, '/discover?tab=releases');
    end loop;
  end if;
  return rid;
end $$;

create or replace function public.send_friend_request(p_other uuid) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid; b uuid; f friendships; who text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  perform assert_can_interact(me, p_other);
  a := least(me, p_other); b := greatest(me, p_other);
  select display_name into who from profiles where id = me;
  select * into f from friendships where user_a = a and user_b = b;
  if found then
    if f.status = 'accepted' then return 'friends'; end if;
    if f.requested_by = me then return 'pending_out'; end if;
    update friendships set status = 'accepted' where user_a = a and user_b = b;     -- they had already asked us
    perform notify(p_other, 'friend_accepted', coalesce(who, 'Someone') || ' accepted your friend request', me, '/friends');
    return 'friends';
  end if;
  insert into friendships (user_a, user_b, requested_by) values (a, b, me);
  perform notify(p_other, 'friend_request', coalesce(who, 'Someone') || ' sent you a friend request', me, '/friends');
  return 'pending_out';
end $$;

create or replace function public.respond_friend_request(p_other uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); who text;
begin
  if p_accept then
    update friendships set status = 'accepted' where user_a = least(me, p_other) and user_b = greatest(me, p_other) and status = 'pending' and requested_by = p_other;
    if not found then raise exception 'Friend request not found'; end if;
    select display_name into who from profiles where id = me;
    perform notify(p_other, 'friend_accepted', coalesce(who, 'Someone') || ' accepted your friend request', me, '/friends');
  else
    delete from friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other) and status = 'pending' and requested_by = p_other;
    if not found then raise exception 'Friend request not found'; end if;
  end if;
end $$;

create or replace function public.remove_friend(p_other uuid) returns void language sql security definer set search_path = public as
$$ delete from friendships where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other) $$;

create or replace function public.friend_status(p_other uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select case when status = 'accepted' then 'friends' when requested_by = auth.uid() then 'pending_out' else 'pending_in' end
    from friendships where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other)), 'none') $$;

create or replace function public.my_friends() returns jsonb language sql stable security definer set search_path = public as $$
  with f as (select case when user_a = auth.uid() then user_b else user_a end as other, status, requested_by from friendships where auth.uid() in (user_a, user_b)),
  j as (select f.status, f.requested_by, jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) as person, p.display_name
        from f join profiles p on p.id = f.other where not p.is_suspended)
  select jsonb_build_object(
    'friends',  coalesce((select jsonb_agg(person order by display_name) from j where status = 'accepted'), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(person order by display_name) from j where status = 'pending' and requested_by <> auth.uid()), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(person order by display_name) from j where status = 'pending' and requested_by = auth.uid()), '[]'::jsonb)) $$;

-- ===================== ROW LEVEL SECURITY =====================
alter table public.friendships enable row level security;
alter table public.samples enable row level security;
alter table public.releases enable row level security;
alter table public.release_tracks enable row level security;
alter table public.release_credits enable row level security;
drop policy if exists fr_select on public.friendships;
drop policy if exists smp_select on public.samples;  drop policy if exists smp_insert on public.samples;
drop policy if exists smp_update on public.samples;  drop policy if exists smp_delete on public.samples;
drop policy if exists rel_select on public.releases; drop policy if exists rel_update on public.releases; drop policy if exists rel_delete on public.releases;
drop policy if exists rt_select on public.release_tracks; drop policy if exists rc_select on public.release_credits;

create policy fr_select on public.friendships for select to authenticated using (auth.uid() in (user_a, user_b));   -- changes only via the functions above
create policy smp_select on public.samples for select to authenticated using (can_see_content(owner_id, visibility));
create policy smp_insert on public.samples for insert to authenticated with check (owner_id = auth.uid() and not is_suspended() and split_part(file_path, '/', 1) = auth.uid()::text);
create policy smp_update on public.samples for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy smp_delete on public.samples for delete to authenticated using (owner_id = auth.uid() or is_admin());
create policy rel_select on public.releases for select to authenticated using (can_see_release(id));
create policy rel_update on public.releases for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy rel_delete on public.releases for delete to authenticated using (owner_id = auth.uid() or is_admin());
create policy rt_select on public.release_tracks for select to authenticated using (can_see_release(release_id));
create policy rc_select on public.release_credits for select to authenticated using (can_see_release(release_id));

-- ===================== STORAGE =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('samples', 'samples', false, 52428800, array['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/flac','audio/ogg','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists muse_smp_select on storage.objects; drop policy if exists muse_smp_insert on storage.objects; drop policy if exists muse_smp_delete on storage.objects;
create policy muse_smp_select on storage.objects for select to authenticated using (bucket_id = 'samples' and ((storage.foldername(name))[1] = auth.uid()::text or public.can_view_sample_media(name)));
create policy muse_smp_insert on storage.objects for insert to authenticated with check (bucket_id = 'samples' and (storage.foldername(name))[1] = auth.uid()::text);
create policy muse_smp_delete on storage.objects for delete to authenticated using (bucket_id = 'samples' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
-- Featured release tracks live in the project-files bucket; allow whoever may see the release to play them
drop policy if exists muse_pf_select on storage.objects;
create policy muse_pf_select on storage.objects for select to authenticated using (bucket_id = 'project-files' and (public.in_project_path(name) or public.can_view_release_media(name)));

notify pgrst, 'reload schema';
