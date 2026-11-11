-- Project file uploads (video, audio, images, PDF, ZIP, ...). Run AFTER the core migration. Idempotent.

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  path text not null unique check (char_length(path) <= 400),
  mime_type text,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),   -- 50 MB
  created_at timestamptz not null default now());
create index if not exists idx_project_files_project on public.project_files (project_id, created_at desc);
create index if not exists idx_project_files_uploader on public.project_files (uploaded_by);

alter table public.project_files enable row level security;
drop policy if exists pf_select on public.project_files;
drop policy if exists pf_insert on public.project_files;
drop policy if exists pf_delete on public.project_files;
create policy pf_select on public.project_files for select to authenticated using (in_project(project_id));
create policy pf_insert on public.project_files for insert to authenticated
  with check (uploaded_by = auth.uid() and in_project(project_id) and not is_suspended() and split_part(path, '/', 1) = project_id::text);
create policy pf_delete on public.project_files for delete to authenticated using (uploaded_by = auth.uid() or owns_project(project_id));

drop trigger if exists rl_project_files on public.project_files;
create trigger rl_project_files before insert on public.project_files for each row execute function public.rate_limit(30, '1 hour', 'uploaded_by');

create or replace function public.trg_file_after() returns trigger language plpgsql security definer set search_path = public as $$
declare m record; t text;
begin
  select title into t from projects where id = new.project_id;
  for m in select user_id from project_members where project_id = new.project_id and user_id <> new.uploaded_by loop
    if not exists (select 1 from notifications where user_id = m.user_id and type = 'project_update' and related_id = new.project_id and read_at is null) then
      perform notify(m.user_id, 'project_update', 'New file in "' || t || '"', new.project_id, '/projects/' || new.project_id);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_file_after on public.project_files;
create trigger trg_file_after after insert on public.project_files for each row execute function public.trg_file_after();

-- Helpers: the first folder of a storage path is the project id (guarded so a bad path can't cause a cast error)
create or replace function public.in_project_path(p_name text) returns boolean language sql stable security definer set search_path = public as $$
  select case when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then in_project(split_part(p_name, '/', 1)::uuid) else false end $$;
create or replace function public.owns_project_path(p_name text) returns boolean language sql stable security definer set search_path = public as $$
  select case when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then owns_project(split_part(p_name, '/', 1)::uuid) else false end $$;

-- Private bucket: files are only reachable through short-lived signed links for project members
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('project-files', 'project-files', false, 52428800, array[
    'video/mp4','video/quicktime','video/webm','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/flac','audio/ogg',
    'audio/midi','audio/x-midi','image/jpeg','image/png','image/webp','application/pdf','application/zip','application/x-zip-compressed','text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists muse_pf_select on storage.objects;
drop policy if exists muse_pf_insert on storage.objects;
drop policy if exists muse_pf_delete on storage.objects;
create policy muse_pf_select on storage.objects for select to authenticated using (bucket_id = 'project-files' and public.in_project_path(name));
create policy muse_pf_insert on storage.objects for insert to authenticated with check (bucket_id = 'project-files' and public.in_project_path(name));
create policy muse_pf_delete on storage.objects for delete to authenticated using (bucket_id = 'project-files' and public.in_project_path(name) and (owner = auth.uid() or public.owns_project_path(name)));

notify pgrst, 'reload schema';
