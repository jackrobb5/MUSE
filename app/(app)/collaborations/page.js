'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import { useDebounced } from '@/lib/useDebounced';
import { stripFilterChars } from '@/lib/format';
import ChipSelect from '@/components/ChipSelect';
import CollabCard from '@/components/CollabCard';
import RequestsPanel from '@/components/RequestsPanel';
import { State } from '@/components/ui';
import { COMP, WORK, EXPERIENCE_REQ } from '@/lib/labels';

const PAGE = 20;
const NIL = '00000000-0000-0000-0000-000000000000';
const SELECT = 'id,title,description,location,work_pref,compensation_type,experience_level,status,created_at,genres(name),creator:profiles!creator_id(username,display_name,avatar_url),collaboration_roles(musical_roles(name))';
const TABS = [['browse', 'Browse'], ['saved', 'Saved'], ['mine', 'My listings'], ['requests', 'Requests']];

export default function CollaborationsPage() {
  const sb = supabaseBrowser();
  const { roles, genres } = useTaxonomy();
  const [tab, setTab] = useState('browse');
  const [f, setF] = useState({ q: '', genre: '', roleIds: [], comp: '', work: '', exp: '', closed: false });
  const d = useDebounced(f, 350);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');
  const seq = useRef(0);

  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (TABS.some(([k]) => k === t)) setTab(t); }, []);

  const load = useCallback(async (offset, replace) => {
    if (tab === 'requests') return;
    const mine = ++seq.current;
    setStatus('loading');
    const { data: { user } } = await sb.auth.getUser();
    let q = sb.from('collaborations').select(SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    if (tab === 'mine') q = q.eq('creator_id', user.id);
    else if (!d.closed) q = q.eq('status', 'open');
    if (tab === 'saved') {
      const { data: s } = await sb.from('saved_collaborations').select('collaboration_id').eq('user_id', user.id);
      q = q.in('id', (s || []).map((x) => x.collaboration_id).concat([NIL]));
    }
    if (d.roleIds.length) {
      const { data: cr } = await sb.from('collaboration_roles').select('collaboration_id').in('role_id', d.roleIds);
      q = q.in('id', (cr || []).map((x) => x.collaboration_id).concat([NIL]));
    }
    const s = stripFilterChars(d.q);
    if (s) q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    if (d.genre) q = q.eq('genre_id', Number(d.genre));
    if (d.comp) q = q.eq('compensation_type', d.comp);
    if (d.work) q = q.in('work_pref', [d.work, 'both']);
    if (d.exp) q = q.eq('experience_level', d.exp);
    const { data, count, error } = await q;
    if (mine !== seq.current) return;
    if (error) { setErr(error.message); return setStatus('error'); }
    setRows((r) => (replace ? data : [...r, ...data]));
    setTotal(count || 0);
    setStatus('ready');
  }, [d, tab]);
  useEffect(() => { load(0, true); }, [load]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <main className="m-page">
      <header className="m-pagehead">
        <h1>Collaborations</h1>
        <Link className="m-btn m-btn--primary" href="/collaborations/new">Create listing</Link>
      </header>
      <div className="m-tabs" role="tablist">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className="m-tab" onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === 'requests' ? <RequestsPanel /> : (<>
        <div className="m-card m-filters">
          <label className="m-field">Search<input type="search" value={f.q} onChange={set('q')} placeholder="Title or description" /></label>
          <details>
            <summary className="m-btn m-btn--ghost">Filters</summary>
            <div className="m-row">
              <label className="m-field">Genre<select value={f.genre} onChange={set('genre')}><option value="">Any</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
              <label className="m-field">Compensation<select value={f.comp} onChange={set('comp')}><option value="">Any</option>{Object.entries(COMP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="m-field">Working<select value={f.work} onChange={set('work')}><option value="">Any</option>{Object.entries(WORK).filter(([k]) => k !== 'both').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="m-field">Experience<select value={f.exp} onChange={set('exp')}><option value="">Any</option>{Object.entries(EXPERIENCE_REQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <ChipSelect label="Roles needed" options={roles} value={f.roleIds} onChange={(v) => setF({ ...f, roleIds: v })} />
            <label className="m-check"><input type="checkbox" checked={f.closed} onChange={set('closed')} /> Include closed listings</label>
          </details>
        </div>
        <State loading={status === 'loading' && rows.length === 0} error={status === 'error' ? err : ''}
          empty={status === 'ready' && rows.length === 0}
          emptyTitle={tab === 'saved' ? 'Nothing saved yet' : tab === 'mine' ? 'You haven’t posted a listing' : 'No listings match'}
          emptyText={tab === 'mine' ? 'Describe what you’re making and who you need.' : 'Try different filters, or post your own listing.'}
          action={<Link className="m-btn m-btn--primary" href="/collaborations/new">Create listing</Link>}>
          <p className="m-muted" role="status">{total} listing{total === 1 ? '' : 's'}</p>
          <div className="m-list">{rows.map((c) => <CollabCard key={c.id} c={c} />)}</div>
          {rows.length < total && <div className="m-actions"><button className="m-btn m-btn--ghost" onClick={() => load(rows.length, false)}>Load more</button></div>}
        </State>
      </>)}
    </main>
  );
}
