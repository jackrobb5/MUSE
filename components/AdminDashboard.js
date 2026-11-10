'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { State } from './ui';
import { stripFilterChars, timeAgo } from '@/lib/format';

const TABS = ['Stats', 'Users', 'Reports', 'Listings', 'Categories'];
const sb = () => supabaseBrowser();

export default function AdminDashboard() {
  const [tab, setTab] = useState('Stats');
  return (
    <>
      <div className="m-tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className="m-tab" onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Stats' && <Stats />}{tab === 'Users' && <Users />}{tab === 'Reports' && <Reports />}{tab === 'Listings' && <Listings />}{tab === 'Categories' && <Categories />}
    </>
  );
}

function Stats() {
  const [s, setS] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { sb().rpc('admin_stats').then(({ data, error }) => (error ? setErr(error.message) : setS(data))); }, []);
  return (
    <State loading={!s && !err} error={err}>
      <dl className="m-stats">{s && Object.entries(s).map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{v}</dd></div>)}</dl>
    </State>
  );
}

function Users() {
  const [q, setQ] = useState(''); const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    let query = sb().from('profiles').select('id,username,display_name,is_suspended,is_admin,created_at,last_active_at,country').order('created_at', { ascending: false }).limit(50);
    const s = stripFilterChars(q);
    if (s) query = query.or(`username.ilike.%${s}%,display_name.ilike.%${s}%`);
    const { data, error } = await query;
    if (error) setErr(error.message); else setRows(data);
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);
  async function toggle(u) {
    if (!u.is_suspended && !confirm(`Suspend @${u.username}? They will be hidden and unable to post or message.`)) return;
    const { error } = await sb().from('profiles').update({ is_suspended: !u.is_suspended }).eq('id', u.id);
    if (error) setErr(error.message); else load();
  }
  return (
    <section className="m-stack">
      <label className="m-field">Search users<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Username or name" /></label>
      {err && <p role="alert" className="m-error">{err}</p>}
      <State loading={!rows && !err} empty={rows && rows.length === 0} emptyTitle="No users found" emptyText="Try a different search.">
        <div className="m-table-wrap"><table className="m-table"><thead><tr><th>User</th><th>Joined</th><th>Last active</th><th>Status</th><th /></tr></thead><tbody>
          {rows?.map((u) => <tr key={u.id}><td><Link href={`/profile/${u.username}`}>{u.display_name}</Link> <span className="m-muted">@{u.username}</span></td>
            <td>{timeAgo(u.created_at)}</td><td>{timeAgo(u.last_active_at)}</td><td>{u.is_admin ? 'Admin' : u.is_suspended ? 'Suspended' : 'Active'}</td>
            <td>{!u.is_admin && <button className="m-btn m-btn--ghost" onClick={() => toggle(u)}>{u.is_suspended ? 'Reinstate' : 'Suspend'}</button>}</td></tr>)}
        </tbody></table></div>
      </State>
    </section>
  );
}

function Reports() {
  const [rows, setRows] = useState(null); const [names, setNames] = useState({}); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await sb().from('reports').select('id,target_type,target_id,reason,details,created_at,reporter:profiles!reporter_id(username)').eq('status', 'open').order('created_at');
    if (error) return setErr(error.message);
    setRows(data);
    const ids = data.filter((r) => r.target_type === 'profile').map((r) => r.target_id);
    if (ids.length) { const { data: p } = await sb().from('profiles').select('id,username').in('id', ids); setNames(Object.fromEntries((p || []).map((x) => [x.id, x.username]))); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function resolve(r, status) {
    const { data: { user } } = await sb().auth.getUser();
    if (status === 'actioned') {
      const op = r.target_type === 'profile' ? sb().from('profiles').update({ is_suspended: true }).eq('id', r.target_id) : sb().from('collaborations').delete().eq('id', r.target_id);
      const { error } = await op; if (error) return setErr(error.message);
    }
    const { error } = await sb().from('reports').update({ status, reviewed_by: user.id }).eq('id', r.id);
    if (error) setErr(error.message); else load();
  }
  return (
    <section className="m-stack">
      {err && <p role="alert" className="m-error">{err}</p>}
      <State loading={!rows && !err} empty={rows && rows.length === 0} emptyTitle="No open reports" emptyText="Nothing needs review right now.">
        {rows?.map((r) => (
          <article key={r.id} className="m-card">
            <p><strong>{r.reason}</strong> · {r.target_type} · reported by @{r.reporter?.username} · {timeAgo(r.created_at)}</p>
            {r.details && <p className="m-prewrap">{r.details}</p>}
            <p>{r.target_type === 'profile' ? (names[r.target_id] ? <Link className="m-link" href={`/profile/${names[r.target_id]}`}>View @{names[r.target_id]}</Link> : 'Profile unavailable') : <Link className="m-link" href={`/collaborations/${r.target_id}`}>View listing</Link>}</p>
            <div className="m-actions">
              <button className="m-btn m-btn--ghost" onClick={() => resolve(r, 'dismissed')}>Dismiss</button>
              <button className="m-btn m-btn--primary" onClick={() => confirm(r.target_type === 'profile' ? 'Suspend this account?' : 'Delete this listing?') && resolve(r, 'actioned')}>{r.target_type === 'profile' ? 'Suspend account' : 'Remove listing'}</button>
            </div>
          </article>))}
      </State>
    </section>
  );
}

function Listings() {
  const [q, setQ] = useState(''); const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    let query = sb().from('collaborations').select('id,title,status,created_at,creator:profiles!creator_id(username)').order('created_at', { ascending: false }).limit(50);
    const s = stripFilterChars(q); if (s) query = query.ilike('title', `%${s}%`);
    const { data, error } = await query; if (error) setErr(error.message); else setRows(data);
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);
  async function remove(c) {
    if (!confirm(`Remove “${c.title}”?`)) return;
    const { error } = await sb().from('collaborations').delete().eq('id', c.id);
    if (error) setErr(error.message); else load();
  }
  return (
    <section className="m-stack">
      <label className="m-field">Search listings<input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {err && <p role="alert" className="m-error">{err}</p>}
      <State loading={!rows && !err} empty={rows && rows.length === 0} emptyTitle="No listings" emptyText="No listings match.">
        {rows?.map((c) => <div key={c.id} className="m-card m-collab__by"><Link href={`/collaborations/${c.id}`}>{c.title}</Link><span className="m-muted">@{c.creator?.username} · {c.status} · {timeAgo(c.created_at)}</span>
          <button className="m-btn m-btn--ghost" onClick={() => remove(c)}>Remove</button></div>)}
      </State>
    </section>
  );
}

function Categories() {
  const [roles, setRoles] = useState(null); const [genres, setGenres] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const [r, g] = await Promise.all([sb().from('musical_roles').select('id,name').order('name'), sb().from('genres').select('id,name').order('name')]);
    if (r.error || g.error) setErr((r.error || g.error).message); setRoles(r.data); setGenres(g.data);
  }, []);
  useEffect(() => { load(); }, [load]);
  const Group = ({ title, table, items }) => {
    const [name, setName] = useState('');
    return (
      <div className="m-card"><h3>{title}</h3>
        <ul className="m-plain">{items?.map((i) => <li key={i.id} className="m-collab__by">{i.name}
          <button className="m-btn m-btn--ghost" onClick={async () => { if (!confirm(`Delete “${i.name}”? It will be removed from every profile and listing using it.`)) return; const { error } = await sb().from(table).delete().eq('id', i.id); if (error) setErr(error.message); else load(); }}>Delete</button></li>)}</ul>
        <form className="m-row" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; const { error } = await sb().from(table).insert({ name: name.trim() }); if (error) setErr(error.message); else { setName(''); load(); } }}>
          <input aria-label={`New ${title}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /><button className="m-btn m-btn--primary">Add</button></form>
      </div>
    );
  };
  return (<State loading={!roles && !err} error={!roles ? err : ''}>{err && <p role="alert" className="m-error">{err}</p>}<div className="m-grid"><Group title="Roles" table="musical_roles" items={roles} /><Group title="Genres" table="genres" items={genres} /></div></State>);
}
