-- MUSE steps 5-10: profiles, discovery, collaborations, messaging, projects, notifications, admin, security.
-- Idempotent: safe to re-run. Run AFTER your step 1-4 migrations.
-- ASSUMPTION: musical_roles.id and genres.id are integers (serial). Change the int[] columns if yours differ.
-- NOTE: the policy reset in section 6 DROPS every existing RLS policy on the listed tables and recreates them.

-- ===================== 1. TABLES =====================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists cover_image_url text,
  add column if not exists biography text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists show_city boolean not null default true,
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists last_active_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
do $$ begin alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$') not valid;
exception when duplicate_object then null; end $$;
do $$ begin alter table public.profiles add constraint profiles_bio_len check (char_length(biography) <= 500) not valid;
exception when duplicate_object then null; end $$;

create table if not exists public.musical_roles (id serial primary key, name text not null);
create table if not exists public.genres (id serial primary key, name text not null);
create unique index if not exists musical_roles_name_uq on public.musical_roles (name);
create unique index if not exists genres_name_uq on public.genres (name);
insert into public.musical_roles (name) values ('Singer'),('Vocalist'),('Rapper'),('Music Producer'),('Beatmaker'),('Songwriter'),('Composer'),('DJ'),('Guitarist'),('Pianist'),('Drummer'),('Bassist'),('Mixing Engineer'),('Mastering Engineer'),('Sound Designer'),('Other') on conflict (name) do nothing;
insert into public.genres (name) values ('Pop'),('Hip-hop'),('Rap'),('R&B'),('Soul'),('Electronic'),('House'),('Techno'),('Dance'),('Rock'),('Indie'),('Jazz'),('Classical'),('Country'),('Afrobeats'),('Drill'),('Garage'),('Other') on conflict (name) do nothing;

create table if not exists public.artist_profiles (user_id uuid primary key references public.profiles(id) on delete cascade);
alter table public.artist_profiles
  add column if not exists experience_level text check (experience_level in ('beginner','intermediate','advanced','professional')),
  add column if not exists availability text not null default 'available' check (availability in ('available','limited','unavailable')),
  add column if not exists seeking_collaborators boolean not null default true,
  add column if not exists work_pref text not null default 'both' check (work_pref in ('remote','local','both')),
  add column if not exists open_paid boolean not null default false,
  add column if not exists open_royalty boolean not null default true,
  add column if not exists open_unpaid boolean not null default true,
  add column if not exists looking_for_role_ids int[] not null default '{}',
  add column if not exists influences text[] not null default '{}',
  add column if not exists portfolio_links jsonb not null default '[]'::jsonb,
  add column if not exists social_links jsonb not null default '{}'::jsonb;

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id int not null references public.musical_roles(id) on delete cascade,
  primary key (user_id, role_id));
alter table public.user_roles add column if not exists is_primary boolean not null default false;
create table if not exists public.user_genres (
  user_id uuid not null references public.profiles(id) on delete cascade,
  genre_id int not null references public.genres(id) on delete cascade,
  primary key (user_id, genre_id));

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 4000),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'planning' check (status in ('planning','in_progress','awaiting_feedback','completed','archived')),
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now());
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'Collaborator' check (char_length(role) <= 60),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id));
create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now());
create table if not exists public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete cascade,
  url text not null check (url ~* '^https?://' and char_length(url) <= 500),
  label text check (char_length(label) <= 120),
  created_at timestamptz not null default now());
-- kind 'agreed_terms' = a record of what collaborators agreed. It is NOT a contract and the platform does not enforce it.
create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','agreed_terms')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now());

create table if not exists public.collaborations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 1 and 4000),
  genre_id int references public.genres(id) on delete set null,
  location text check (char_length(location) <= 120),
  work_pref text not null default 'both' check (work_pref in ('remote','local','both')),
  compensation_type text not null default 'open' check (compensation_type in ('paid','royalty_split','credit_only','unpaid','open')),
  experience_level text not null default 'all' check (experience_level in ('all','beginner','intermediate','advanced','professional')),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create table if not exists public.collaboration_roles (
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  role_id int not null references public.musical_roles(id) on delete cascade,
  primary key (collaboration_id, role_id));
create table if not exists public.saved_collaborations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, collaboration_id));

create table if not exists public.collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid references public.collaborations(id) on delete set null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  role_id int references public.musical_roles(id) on delete set null,
  genre_id int references public.genres(id) on delete set null,
  work_pref text not null default 'remote' check (work_pref in ('remote','local','both')),
  music_link text check (music_link ~* '^https?://' and char_length(music_link) <= 500),
  description text not null check (char_length(description) between 1 and 2000),
  message text check (char_length(message) <= 2000),
  response_message text check (char_length(response_message) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id));
create unique index if not exists collab_req_one_pending on public.collaboration_requests
  (sender_id, recipient_id, coalesce(collaboration_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status = 'pending';

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now());
alter table public.conversations add column if not exists last_message_at timestamptz;
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),   -- replaces messages.read_at: unread = messages newer than this
  primary key (conversation_id, user_id));
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  request_id uuid references public.collaboration_requests(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now());

create table if not exists public.favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id), check (user_id <> artist_id));
create table if not exists public.dismissed_recommendations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id));
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  content text not null,
  related_id uuid,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now());
create table if not exists public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  requests boolean not null default true,
  messages boolean not null default true,
  projects boolean not null default true);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','collaboration')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','inappropriate','impersonation','copyright','other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','dismissed','actioned')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now());
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id), check (blocker_id <> blocked_id));

-- ===================== 2. INDEXES =====================
create index if not exists idx_profiles_country on public.profiles (country);
create index if not exists idx_user_roles_role on public.user_roles (role_id);
create index if not exists idx_user_genres_genre on public.user_genres (genre_id);
create index if not exists idx_collab_status_created on public.collaborations (status, created_at desc);
create index if not exists idx_collab_creator on public.collaborations (creator_id);
create index if not exists idx_collab_roles_role on public.collaboration_roles (role_id);
create index if not exists idx_requests_recipient on public.collaboration_requests (recipient_id, status);
create index if not exists idx_requests_sender on public.collaboration_requests (sender_id, created_at desc);
create index if not exists idx_conv_members_user on public.conversation_members (user_id);
create index if not exists idx_messages_conv_created on public.messages (conversation_id, created_at desc);
create index if not exists idx_messages_sender_created on public.messages (sender_id, created_at desc);
create index if not exists idx_project_members_user on public.project_members (user_id);
create index if not exists idx_project_updates_project on public.project_updates (project_id, created_at desc);
create index if not exists idx_favourites_artist on public.favourites (artist_id);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_reports_status on public.reports (status, created_at desc);

-- ===================== 3. HELPER FUNCTIONS =====================
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;
create or replace function public.is_suspended() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select is_suspended from profiles where id = auth.uid()), false) $$;
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)) $$;
create or replace function public.in_conversation(c uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from conversation_members where conversation_id = c and user_id = auth.uid()) $$;
create or replace function public.in_project(p uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from project_members where project_id = p and user_id = auth.uid()) $$;
create or replace function public.owns_project(p uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from projects where id = p and creator_id = auth.uid()) $$;
create or replace function public.owns_collab(c uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from collaborations where id = c and creator_id = auth.uid()) $$;

create or replace function public.assert_can_interact(a uuid, b uuid) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if a is null or b is null or a = b then raise exception 'Invalid recipient'; end if;
  if (select count(*) from profiles where id in (a, b)) < 2 or exists (select 1 from profiles where id in (a, b) and is_suspended) then
    raise exception 'This account is unavailable'; end if;
  if is_blocked_between(a, b) then raise exception 'You can''t contact this user'; end if;
end $$;

create or replace function public.notify(p_user uuid, p_type text, p_content text, p_related uuid, p_link text) returns void
language plpgsql security definer set search_path = public as $$
declare kind text := split_part(p_type, '_', 1); ok boolean;
begin
  select case kind when 'request' then requests when 'message' then messages when 'project' then projects else true end into ok
    from notification_prefs where user_id = p_user;
  if coalesce(ok, true) then
    insert into notifications (user_id, type, content, related_id, link) values (p_user, p_type, left(p_content, 300), p_related, p_link);
  end if;
end $$;
revoke execute on function public.notify(uuid, text, text, uuid, text) from public, anon, authenticated;

-- ===================== 4. TRIGGERS =====================
create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'INSERT' then new.is_admin := false; new.is_suspended := false;
    elsif new.is_admin is distinct from old.is_admin or new.is_suspended is distinct from old.is_suspended then
      raise exception 'Not allowed'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile before insert or update on public.profiles for each row execute function public.guard_profile();

-- Generic rate limiter: rate_limit(max_rows, window, owner_column)
create or replace function public.rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim int := tg_argv[0]::int; win interval := tg_argv[1]::interval; col text := tg_argv[2]; n int;
begin
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2', tg_table_schema, tg_table_name, col)
    into n using (to_jsonb(new) ->> col)::uuid, win;
  if n >= lim then raise exception 'Rate limit reached. Please slow down and try again later.'; end if;
  return new;
end $$;
revoke execute on function public.rate_limit() from public, anon, authenticated;
drop trigger if exists rl_messages on public.messages;
create trigger rl_messages before insert on public.messages for each row execute function public.rate_limit(60, '1 minute', 'sender_id');
drop trigger if exists rl_requests on public.collaboration_requests;
create trigger rl_requests before insert on public.collaboration_requests for each row execute function public.rate_limit(20, '1 day', 'sender_id');
drop trigger if exists rl_collabs on public.collaborations;
create trigger rl_collabs before insert on public.collaborations for each row execute function public.rate_limit(10, '1 day', 'creator_id');
drop trigger if exists rl_reports on public.reports;
create trigger rl_reports before insert on public.reports for each row execute function public.rate_limit(10, '1 day', 'reporter_id');

create or replace function public.trg_request_before() returns trigger language plpgsql security definer set search_path = public as $$
begin perform assert_can_interact(new.sender_id, new.recipient_id); return new; end $$;
drop trigger if exists trg_request_before on public.collaboration_requests;
create trigger trg_request_before before insert on public.collaboration_requests for each row execute function public.trg_request_before();

create or replace function public.trg_request_after() returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select display_name into who from profiles where id = new.sender_id;
  perform notify(new.recipient_id, 'request_received', coalesce(who, 'Someone') || ' sent you a collaboration request', new.id, '/collaborations?tab=requests');
  return new;
end $$;
drop trigger if exists trg_request_after on public.collaboration_requests;
create trigger trg_request_after after insert on public.collaboration_requests for each row execute function public.trg_request_after();

create or replace function public.trg_message_before() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select user_id from conversation_members where conversation_id = new.conversation_id and user_id <> new.sender_id loop
    perform assert_can_interact(new.sender_id, m.user_id);
  end loop;
  return new;
end $$;
drop trigger if exists trg_message_before on public.messages;
create trigger trg_message_before before insert on public.messages for each row execute function public.trg_message_before();

create or replace function public.trg_message_after() returns trigger language plpgsql security definer set search_path = public as $$
declare m record; who text;
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  update conversation_members set last_read_at = new.created_at where conversation_id = new.conversation_id and user_id = new.sender_id;
  select display_name into who from profiles where id = new.sender_id;
  for m in select user_id from conversation_members where conversation_id = new.conversation_id and user_id <> new.sender_id loop
    if not exists (select 1 from notifications where user_id = m.user_id and type = 'message_new' and related_id = new.conversation_id and read_at is null) then
      perform notify(m.user_id, 'message_new', 'New message from ' || coalesce(who, 'someone'), new.conversation_id, '/messages?c=' || new.conversation_id);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_message_after on public.messages;
create trigger trg_message_after after insert on public.messages for each row execute function public.trg_message_after();

create or replace function public.trg_project_after() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into project_members (project_id, user_id, role) values (new.id, new.creator_id, 'Owner') on conflict do nothing; return new; end $$;
drop trigger if exists trg_project_after on public.projects;
create trigger trg_project_after after insert on public.projects for each row execute function public.trg_project_after();

create or replace function public.trg_member_before() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select creator_id into owner from projects where id = new.project_id;
  if new.user_id <> owner then perform assert_can_interact(owner, new.user_id); end if;
  return new;
end $$;
drop trigger if exists trg_member_before on public.project_members;
create trigger trg_member_before before insert on public.project_members for each row execute function public.trg_member_before();

create or replace function public.trg_member_after() returns trigger language plpgsql security definer set search_path = public as $$
declare t text; owner uuid;
begin
  select title, creator_id into t, owner from projects where id = new.project_id;
  if new.user_id <> owner then
    perform notify(new.user_id, 'project_invite', 'You were added to the project "' || t || '"', new.project_id, '/projects/' || new.project_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_member_after on public.project_members;
create trigger trg_member_after after insert on public.project_members for each row execute function public.trg_member_after();

create or replace function public.trg_update_after() returns trigger language plpgsql security definer set search_path = public as $$
declare m record; t text;
begin
  select title into t from projects where id = new.project_id;
  for m in select user_id from project_members where project_id = new.project_id and user_id <> new.author_id loop
    perform notify(m.user_id, 'project_update', 'New update in "' || t || '"', new.project_id, '/projects/' || new.project_id);
  end loop;
  return new;
end $$;
drop trigger if exists trg_update_after on public.project_updates;
create trigger trg_update_after after insert on public.project_updates for each row execute function public.trg_update_after();

create or replace function public.touch_collab() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_touch_collab on public.collaborations;
create trigger trg_touch_collab before update on public.collaborations for each row execute function public.touch_collab();

-- ===================== 5. RPCs =====================
create or replace function public.set_user_taxonomy(p_roles int[], p_primary int, p_genres int[]) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  if cardinality(coalesce(p_roles, '{}')) > 20 or cardinality(coalesce(p_genres, '{}')) > 20 then raise exception 'Too many selections'; end if;
  delete from user_roles where user_id = me and not (role_id = any (coalesce(p_roles, '{}')));
  insert into user_roles (user_id, role_id, is_primary) select me, r, coalesce(r = p_primary, false) from unnest(coalesce(p_roles, '{}')) r
    on conflict (user_id, role_id) do update set is_primary = excluded.is_primary;
  delete from user_genres where user_id = me and not (genre_id = any (coalesce(p_genres, '{}')));
  insert into user_genres (user_id, genre_id) select me, g from unnest(coalesce(p_genres, '{}')) g on conflict do nothing;
end $$;

create or replace function public.discover_artists(
  p_q text default null, p_country text default null, p_city text default null,
  p_role_ids int[] default null, p_genre_ids int[] default null,
  p_work_pref text default null, p_paid boolean default null, p_seeking boolean default null,
  p_experience text default null, p_sort text default 'recommended',
  p_limit int default 24, p_offset int default 0
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mine artist_profiles;
  my_country text;
  q text := nullif(btrim(p_q), '');
  pat text;
  result jsonb;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into mine from artist_profiles where user_id = me;
  select country into my_country from profiles where id = me;
  pat := '%' || replace(replace(replace(coalesce(q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  p_limit := least(greatest(coalesce(p_limit, 24), 1), 50);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  with mg as (select genre_id from user_genres where user_id = me),
  c as (
    select p.id, p.username, p.display_name, p.avatar_url, p.biography, p.country,
      case when p.show_city then p.city end as city, p.last_active_at, p.created_at,
      a.experience_level, a.availability, a.seeking_collaborators, a.work_pref,
      a.open_paid, a.open_royalty, a.open_unpaid, a.portfolio_links,
      array(select r.name from user_roles ur join musical_roles r on r.id = ur.role_id where ur.user_id = p.id order by ur.is_primary desc, r.name) as roles,
      array(select ur.role_id from user_roles ur where ur.user_id = p.id) as role_ids,
      array(select g.name from user_genres ug join genres g on g.id = ug.genre_id where ug.user_id = p.id order by g.name) as genres,
      array(select ug.genre_id from user_genres ug where ug.user_id = p.id) as genre_ids,
      exists (select 1 from favourites f where f.user_id = me and f.artist_id = p.id) as is_favourite
    from profiles p left join artist_profiles a on a.user_id = p.id
    where p.id <> me and not p.is_suspended
      and not exists (select 1 from blocks b where (b.blocker_id = me and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me))
      and (q is null or p.display_name ilike pat or p.username ilike pat or p.country ilike pat or p.city ilike pat
           or exists (select 1 from user_roles ur join musical_roles r on r.id = ur.role_id where ur.user_id = p.id and r.name ilike pat)
           or exists (select 1 from user_genres ug join genres g on g.id = ug.genre_id where ug.user_id = p.id and g.name ilike pat))
      and (p_country is null or p.country ilike p_country)
      and (p_city is null or p.city ilike p_city)
      and (p_role_ids is null or exists (select 1 from user_roles ur where ur.user_id = p.id and ur.role_id = any (p_role_ids)))
      and (p_genre_ids is null or exists (select 1 from user_genres ug where ug.user_id = p.id and ug.genre_id = any (p_genre_ids)))
      and (p_work_pref is null or a.work_pref in (p_work_pref, 'both'))
      and (p_paid is null or (p_paid and a.open_paid) or (not p_paid and a.open_unpaid))
      and (p_seeking is null or a.seeking_collaborators = p_seeking)
      and (p_experience is null or a.experience_level = p_experience)
      and (p_sort <> 'recommended' or not exists (select 1 from dismissed_recommendations d where d.user_id = me and d.artist_id = p.id))
  ),
  f as (
    select c.*,
      cardinality(array(select unnest(c.genre_ids) intersect select genre_id from mg)) as shared,
      coalesce(mine.looking_for_role_ids && c.role_ids, false) as role_hit,
      ((coalesce(mine.work_pref in ('remote','both'), false) and coalesce(c.work_pref in ('remote','both'), false))
        or (my_country is not null and lower(c.country) = lower(my_country))) as work_ok,
      (coalesce(mine.open_paid and c.open_paid, false) or coalesce(mine.open_royalty and c.open_royalty, false)
        or coalesce(mine.open_unpaid and c.open_unpaid, false)) as comp_ok
    from c
  ),
  s as (
    -- Transparent score, max 100: genres 40 (20 each shared) + wanted role 30 + working arrangement 10 + compensation 10 + seeking 10
    select f.*,
      least(40, f.shared * 20) + (case when f.role_hit then 30 else 0 end) + (case when f.work_ok then 10 else 0 end)
        + (case when f.comp_ok then 10 else 0 end) + (case when coalesce(f.seeking_collaborators, false) then 10 else 0 end) as score,
      array_remove(array[
        case when f.shared > 0 then 'Shares ' || f.shared || (case when f.shared = 1 then ' genre' else ' genres' end) end,
        case when f.role_hit then 'Has a role you''re looking for' end,
        case when f.work_ok then 'Compatible working arrangement' end,
        case when f.comp_ok then 'Compatible compensation' end,
        case when coalesce(f.seeking_collaborators, false) then 'Seeking collaborators' end
      ], null) as reasons
    from f
  ),
  o as (
    select s.*, count(*) over () as total,
      row_number() over (order by
        case p_sort when 'newest' then extract(epoch from s.created_at)
                    when 'active' then extract(epoch from s.last_active_at)
                    else s.score end desc nulls last, s.last_active_at desc, s.id) as ord
    from s
  )
  select jsonb_build_object('total', coalesce(max(x.total), 0),
    'rows', coalesce(jsonb_agg(to_jsonb(x) - 'total' - 'ord' - 'shared' - 'role_hit' - 'work_ok' - 'comp_ok' - 'role_ids' - 'genre_ids' order by x.ord), '[]'::jsonb))
  into result
  from (select * from o order by ord limit p_limit offset p_offset) x;
  return result;
end $$;

create or replace function public.start_conversation(p_other uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  perform assert_can_interact(me, p_other);
  select c.id into cid from conversations c
   where exists (select 1 from conversation_members where conversation_id = c.id and user_id = me)
     and exists (select 1 from conversation_members where conversation_id = c.id and user_id = p_other)
     and (select count(*) from conversation_members where conversation_id = c.id) = 2 limit 1;
  if cid is null then
    insert into conversations default values returning id into cid;
    insert into conversation_members (conversation_id, user_id) values (cid, me), (cid, p_other);
  end if;
  return cid;
end $$;

create or replace function public.my_conversations() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_at desc), '[]'::jsonb) from (
    select c.id, o.user_id as other_id, p.username, p.display_name, p.avatar_url,
      coalesce(c.last_message_at, c.created_at) as last_at,
      (select m.content from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message,
      (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > me.last_read_at) as unread
    from conversation_members me
    join conversations c on c.id = me.conversation_id
    join conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
    join profiles p on p.id = o.user_id
    where me.user_id = auth.uid()) x
$$;

create or replace function public.mark_conversation_read(p_conversation uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update conversation_members set last_read_at = now() where conversation_id = p_conversation and user_id = auth.uid();
  update notifications set read_at = now() where user_id = auth.uid() and type = 'message_new' and related_id = p_conversation and read_at is null;
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;

create or replace function public.respond_to_request(p_id uuid, p_status text, p_response text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r collaboration_requests; who text;
begin
  if p_status not in ('accepted', 'declined') then raise exception 'Invalid status'; end if;
  update collaboration_requests set status = p_status, response_message = left(nullif(btrim(p_response), ''), 1000), responded_at = now()
   where id = p_id and recipient_id = me and status = 'pending' returning * into r;
  if not found then raise exception 'Request not found or already answered'; end if;
  select display_name into who from profiles where id = me;
  perform notify(r.sender_id, 'request_' || p_status, coalesce(who, 'Someone') || ' ' || p_status || ' your collaboration request', r.id, '/collaborations?tab=requests');
  return r.id;
end $$;

create or replace function public.withdraw_request(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update collaboration_requests set status = 'withdrawn', responded_at = now() where id = p_id and sender_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Request not found or already answered'; end if;
end $$;

create or replace function public.create_project_from_request(p_request uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r collaboration_requests; t text; other uuid; pid uuid;
begin
  select * into r from collaboration_requests where id = p_request and status = 'accepted' and (sender_id = me or recipient_id = me);
  if not found then raise exception 'Only accepted requests can become projects'; end if;
  if r.project_id is not null then return r.project_id; end if;
  select title into t from collaborations where id = r.collaboration_id;
  other := case when r.sender_id = me then r.recipient_id else r.sender_id end;
  insert into projects (title, description, creator_id)
    values (coalesce(t, nullif(left(r.description, 80), ''), 'New collaboration'), r.description, me) returning id into pid;
  insert into project_members (project_id, user_id, role)
    values (pid, other, coalesce((select name from musical_roles where id = r.role_id), 'Collaborator'));
  update collaboration_requests set project_id = pid where id = r.id;
  return pid;
end $$;

create or replace function public.profile_summary(p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'listings', (select count(*) from collaborations where creator_id = p_user),
    'completed_projects', (select count(*) from project_members pm join projects pr on pr.id = pm.project_id where pm.user_id = p_user and pr.status = 'completed'),
    'accepted_requests', (select count(*) from collaboration_requests where status = 'accepted' and (sender_id = p_user or recipient_id = p_user)),
    -- Completed project titles are public on profiles (collaboration history). Remove this if you want them private.
    'history', coalesce((select jsonb_agg(h) from (select pr.title, pm.role, pr.created_at from project_members pm join projects pr on pr.id = pm.project_id
                 where pm.user_id = p_user and pr.status = 'completed' order by pr.created_at desc limit 10) h), '[]'::jsonb))
$$;

create or replace function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'new_users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'active_users_7d', (select count(*) from profiles where last_active_at > now() - interval '7 days'),
    'suspended_users', (select count(*) from profiles where is_suspended),
    'open_listings', (select count(*) from collaborations where status = 'open'),
    'requests_7d', (select count(*) from collaboration_requests where created_at > now() - interval '7 days'),
    'accepted_requests', (select count(*) from collaboration_requests where status = 'accepted'),
    'messages_7d', (select count(*) from messages where created_at > now() - interval '7 days'),
    'active_projects', (select count(*) from projects where status in ('planning','in_progress','awaiting_feedback')),
    'open_reports', (select count(*) from reports where status = 'open'));
end $$;

-- ===================== 6. ROW LEVEL SECURITY =====================
do $$ declare t text; r record; begin
  foreach t in array array['profiles','artist_profiles','musical_roles','genres','user_roles','user_genres','collaborations','collaboration_roles',
    'saved_collaborations','collaboration_requests','conversations','conversation_members','messages','projects','project_members','project_updates',
    'project_links','project_notes','favourites','dismissed_recommendations','notifications','notification_prefs','reports','blocks'] loop
    execute format('alter table public.%I enable row level security', t);
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;
  end loop;
end $$;

create policy profiles_select on public.profiles for select to authenticated using (not is_suspended or id = auth.uid() or is_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

create policy ap_select on public.artist_profiles for select to authenticated using (true);
create policy ap_write on public.artist_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy roles_select on public.musical_roles for select to authenticated using (true);
create policy roles_admin on public.musical_roles for all to authenticated using (is_admin()) with check (is_admin());
create policy genres_select on public.genres for select to authenticated using (true);
create policy genres_admin on public.genres for all to authenticated using (is_admin()) with check (is_admin());

create policy ur_select on public.user_roles for select to authenticated using (true);
create policy ur_write on public.user_roles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ug_select on public.user_genres for select to authenticated using (true);
create policy ug_write on public.user_genres for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy collab_select on public.collaborations for select to authenticated using (true);
create policy collab_insert on public.collaborations for insert to authenticated with check (creator_id = auth.uid() and not is_suspended());
create policy collab_update on public.collaborations for update to authenticated using (creator_id = auth.uid() or is_admin()) with check (creator_id = auth.uid() or is_admin());
create policy collab_delete on public.collaborations for delete to authenticated using (creator_id = auth.uid() or is_admin());
create policy cr_select on public.collaboration_roles for select to authenticated using (true);
create policy cr_write on public.collaboration_roles for all to authenticated using (owns_collab(collaboration_id) or is_admin()) with check (owns_collab(collaboration_id) or is_admin());
create policy saved_all on public.saved_collaborations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy req_select on public.collaboration_requests for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid() or is_admin());
create policy req_insert on public.collaboration_requests for insert to authenticated with check (sender_id = auth.uid() and status = 'pending' and not is_suspended());
-- no UPDATE policy on purpose: status changes go through respond_to_request / withdraw_request

create policy conv_select on public.conversations for select to authenticated using (in_conversation(id));
create policy cm_select on public.conversation_members for select to authenticated using (in_conversation(conversation_id));
create policy msg_select on public.messages for select to authenticated using (in_conversation(conversation_id));
create policy msg_insert on public.messages for insert to authenticated with check (sender_id = auth.uid() and in_conversation(conversation_id) and not is_suspended());

create policy proj_select on public.projects for select to authenticated using (in_project(id) or is_admin());
create policy proj_insert on public.projects for insert to authenticated with check (creator_id = auth.uid() and not is_suspended());
create policy proj_update on public.projects for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy proj_delete on public.projects for delete to authenticated using (creator_id = auth.uid());
create policy pm_select on public.project_members for select to authenticated using (in_project(project_id));
create policy pm_insert on public.project_members for insert to authenticated with check (owns_project(project_id));
create policy pm_delete on public.project_members for delete to authenticated using (
  (owns_project(project_id) and user_id <> auth.uid()) or (user_id = auth.uid() and not owns_project(project_id)));
create policy pu_select on public.project_updates for select to authenticated using (in_project(project_id));
create policy pu_insert on public.project_updates for insert to authenticated with check (author_id = auth.uid() and in_project(project_id));
create policy pu_delete on public.project_updates for delete to authenticated using (author_id = auth.uid() or owns_project(project_id));
create policy pl_select on public.project_links for select to authenticated using (in_project(project_id));
create policy pl_insert on public.project_links for insert to authenticated with check (added_by = auth.uid() and in_project(project_id));
create policy pl_delete on public.project_links for delete to authenticated using (added_by = auth.uid() or owns_project(project_id));
create policy pn_select on public.project_notes for select to authenticated using (in_project(project_id));
create policy pn_insert on public.project_notes for insert to authenticated with check (author_id = auth.uid() and in_project(project_id));
create policy pn_delete on public.project_notes for delete to authenticated using (author_id = auth.uid() or owns_project(project_id));

create policy fav_all on public.favourites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dis_all on public.dismissed_recommendations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
-- no INSERT/UPDATE policy: notifications are created by triggers and marked read via mark_notifications_read
create policy np_all on public.notification_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rep_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy rep_select on public.reports for select to authenticated using (reporter_id = auth.uid() or is_admin());
create policy rep_update on public.reports for update to authenticated using (is_admin()) with check (is_admin());
create policy blocks_all on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- ===================== 7. STORAGE (avatars, covers) =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('covers', 'covers', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists muse_media_insert on storage.objects;
drop policy if exists muse_media_update on storage.objects;
drop policy if exists muse_media_delete on storage.objects;
create policy muse_media_insert on storage.objects for insert to authenticated with check (bucket_id in ('avatars','covers') and (storage.foldername(name))[1] = auth.uid()::text);
create policy muse_media_update on storage.objects for update to authenticated using (bucket_id in ('avatars','covers') and (storage.foldername(name))[1] = auth.uid()::text);
create policy muse_media_delete on storage.objects for delete to authenticated using (bucket_id in ('avatars','covers') and (storage.foldername(name))[1] = auth.uid()::text);

-- ===================== 8. REALTIME =====================
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;

-- ===================== 9. FIRST ADMIN =====================
-- Run manually in the SQL editor (as postgres), replacing the username:
--   update public.profiles set is_admin = true where username = 'your_username';
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
