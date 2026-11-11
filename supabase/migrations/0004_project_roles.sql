-- Project roles: only allow the dropdown values, and let a project owner change a member's role. Idempotent.
create or replace function public.trg_member_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role not in ('Owner','Collaborator','Co-writer','Featured artist','Manager','Videographer','Visual artist')
     and not exists (select 1 from musical_roles where name = new.role) then
    raise exception 'Invalid project role';
  end if;
  return new;
end $$;
drop trigger if exists trg_member_role on public.project_members;
create trigger trg_member_role before insert or update of role on public.project_members for each row execute function public.trg_member_role();

drop policy if exists pm_update on public.project_members;
create policy pm_update on public.project_members for update to authenticated
  using (owns_project(project_id) and user_id <> auth.uid()) with check (owns_project(project_id) and user_id <> auth.uid());

notify pgrst, 'reload schema';
