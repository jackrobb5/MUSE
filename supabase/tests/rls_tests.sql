-- RLS / security tests. Everything runs in one transaction and is rolled back.
-- Local:  supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls_tests.sql
-- Expect a series of "ok:" notices and a final "ALL RLS TESTS PASSED". Any failure raises an exception.
begin;

create function _t_login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;
create function _t_logout() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
create function _t_count(q text, expected int, label text) returns void language plpgsql as $$
declare n int; begin
  execute 'select count(*) from (' || q || ') s' into n;
  if n <> expected then raise exception 'FAIL: % (expected %, got %)', label, expected, n; end if;
  raise notice 'ok: %', label; end $$;
create function _t_affected(q text, expected int, label text) returns void language plpgsql as $$
declare n int; begin
  execute q; get diagnostics n = row_count;
  if n <> expected then raise exception 'FAIL: % (expected % rows affected, got %)', label, expected, n; end if;
  raise notice 'ok: %', label; end $$;
create function _t_denied(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; raise exception 'FAIL (was allowed): %', label;
  exception when others then if sqlerrm like 'FAIL (was allowed)%' then raise; end if; end;
  raise notice 'ok: %', label; end $$;

-- Seed as superuser (bypasses RLS). A and B are friends; C is an outsider.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev') on conflict do nothing;
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'user_a', 'A'),
  ('00000000-0000-0000-0000-00000000000b', 'user_b', 'B'),
  ('00000000-0000-0000-0000-00000000000c', 'user_c', 'C') on conflict (id) do nothing;
insert into public.conversations (id) values ('00000000-0000-0000-0000-0000000000c1');
insert into public.conversation_members (conversation_id, user_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b');
insert into public.messages (conversation_id, sender_id, content) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'secret');
insert into public.collaborations (id, creator_id, title, description) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'Singer wanted', 'x');
insert into public.projects (id, title, creator_id) values ('00000000-0000-0000-0000-0000000000e1', 'Private project', '00000000-0000-0000-0000-00000000000a');

-- Outsider C
select _t_login('00000000-0000-0000-0000-00000000000c');
select _t_count('select 1 from messages', 0, 'outsider cannot read others'' messages');
select _t_count('select 1 from conversations', 0, 'outsider cannot see conversations');
select _t_count('select 1 from projects', 0, 'non-member cannot read a project');
select _t_count($$select 1 from notifications where user_id = '00000000-0000-0000-0000-00000000000b'$$, 0, 'cannot read someone else''s notifications');
select _t_denied($$insert into messages (conversation_id, sender_id, content) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'hi')$$, 'outsider cannot post into a conversation');
select _t_denied($$update profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000c'$$, 'user cannot promote themselves to admin');
select _t_denied($$update profiles set is_suspended = false where id = '00000000-0000-0000-0000-00000000000c'$$, 'user cannot change their suspension flag');
select _t_affected($$update collaborations set title = 'hacked' where id = '00000000-0000-0000-0000-0000000000d1'$$, 0, 'non-owner cannot edit a listing');
select _t_affected($$delete from collaborations where id = '00000000-0000-0000-0000-0000000000d1'$$, 0, 'non-owner cannot delete a listing');
select _t_denied($$insert into notifications (user_id, type, content) values ('00000000-0000-0000-0000-00000000000a', 'x', 'spam')$$, 'users cannot forge notifications');
select _t_denied($$insert into project_members (project_id, user_id, role) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000c', 'x')$$, 'user cannot add themselves to a project');
select _t_count('select 1 from reports', 0, 'non-admin cannot read reports');
select _t_denied($$select admin_stats()$$, 'non-admin cannot call admin_stats');
select _t_logout();

-- Member B
select _t_login('00000000-0000-0000-0000-00000000000b');
select _t_count('select 1 from messages', 1, 'conversation member can read messages');
select _t_count('select 1 from notifications', 1, 'recipient got a message notification (trigger)');
select _t_affected($$update collaboration_requests set status = 'accepted'$$, 0, 'status cannot be changed by direct UPDATE');
select _t_logout();

-- Blocking: A blocks B, then B can no longer message A.
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
select _t_login('00000000-0000-0000-0000-00000000000b');
select _t_denied($$insert into messages (conversation_id, sender_id, content) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 'still there?')$$, 'blocked user cannot message the blocker');
select _t_denied($$select start_conversation('00000000-0000-0000-0000-00000000000a')$$, 'blocked user cannot start a conversation');
select _t_logout();

select 'ALL RLS TESTS PASSED' as result;
rollback;
