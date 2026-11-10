'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import { useDebounced } from '@/lib/useDebounced';
import ChipSelect from '@/components/ChipSelect';
import ArtistCard from '@/components/ArtistCard';
import { State } from '@/components/ui';
import { EXPERIENCE, WORK } from '@/lib/labels';

const PAGE = 24;
const INITIAL = { q: '', country: '', city: '', roleIds: [], genreIds: [], workPref: '', comp: '', seeking: false, experience: '', sort: 'recommended' };

export default function DiscoverPage() {
  const sb = supabaseBrowser();
  const { roles, genres } = useTaxonomy();
  const [f, setF] = useState(INITIAL);
  const d = useDebounced(f, 350);
  const [layout, setLayout] = useState('grid');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (offset, replace) => {
    const mine = ++seq.current;
    setStatus('loading');
    const { data, error } = await sb.rpc('discover_artists', {
      p_q: d.q.trim() || null, p_country: d.country.trim() || null, p_city: d.city.trim() || null,
      p_role_ids: d.roleIds.length ? d.roleIds : null, p_genre_ids: d.genreIds.length ? d.genreIds : null,
      p_work_pref: d.workPref || null, p_paid: d.comp === 'paid' ? true : d.comp === 'unpaid' ? false : null,
      p_seeking: d.seeking ? true : null, p_experience: d.experience || null, p_sort: d.sort, p_limit: PAGE, p_offset: offset,
    });
    if (mine !== seq.current) return; // a newer search started; ignore this response
    if (error) { setErr(error.message); return setStatus('error'); }
    setRows((r) => (replace ? data.rows : [...r, ...data.rows]));
    setTotal(data.total);
    setStatus('ready');
  }, [d]);

  useEffect(() => { load(0, true); }, [load]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <main className="m-page">
      <header className="m-pagehead">
        <h1>Discover</h1>
        <div className="m-actions">
          <label className="m-field m-inline">Sort<select value={f.sort} onChange={set('sort')}><option value="recommended">Recommended</option><option value="active">Recently active</option><option value="newest">Newest</option></select></label>
          <div role="group" aria-label="Layout">
            <button className="m-btn m-btn--ghost" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>Grid</button>
            <button className="m-btn m-btn--ghost" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>List</button>
          </div>
        </div>
      </header>

      <div className="m-card m-filters">
        <label className="m-field">Search<input type="search" value={f.q} onChange={set('q')} placeholder="Name, username, role, genre or place" /></label>
        <details>
          <summary className="m-btn m-btn--ghost">Filters</summary>
          <div className="m-row">
            <label className="m-field">Country<input value={f.country} onChange={set('country')} /></label>
            <label className="m-field">City<input value={f.city} onChange={set('city')} /></label>
            <label className="m-field">Working<select value={f.workPref} onChange={set('workPref')}><option value="">Any</option>{Object.entries(WORK).filter(([k]) => k !== 'both').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="m-field">Compensation<select value={f.comp} onChange={set('comp')}><option value="">Any</option><option value="paid">Open to paid</option><option value="unpaid">Open to unpaid</option></select></label>
            <label className="m-field">Experience<select value={f.experience} onChange={set('experience')}><option value="">Any</option>{Object.entries(EXPERIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <ChipSelect label="Roles" options={roles} value={f.roleIds} onChange={(v) => setF({ ...f, roleIds: v })} />
          <ChipSelect label="Genres" options={genres} value={f.genreIds} onChange={(v) => setF({ ...f, genreIds: v })} />
          <label className="m-check"><input type="checkbox" checked={f.seeking} onChange={set('seeking')} /> Actively seeking collaborators</label>
          <button className="m-btn m-btn--ghost" onClick={() => setF(INITIAL)}>Clear filters</button>
        </details>
      </div>

      <State loading={status === 'loading' && rows.length === 0} error={status === 'error' ? err : ''}
        empty={status === 'ready' && rows.length === 0} emptyTitle="No artists match yet"
        emptyText="Try removing a filter, or widen your search. New artists join every day.">
        <p className="m-muted" role="status">{total} artist{total === 1 ? '' : 's'}</p>
        <div className={layout === 'grid' ? 'm-grid' : 'm-list'}>
          {rows.map((a) => <ArtistCard key={a.id} a={a} layout={layout} onDismiss={f.sort === 'recommended' ? (id) => setRows((r) => r.filter((x) => x.id !== id)) : undefined} />)}
        </div>
        {rows.length < total && <div className="m-actions"><button className="m-btn m-btn--ghost" onClick={() => load(rows.length, false)} disabled={status === 'loading'}>{status === 'loading' ? 'Loading…' : 'Load more'}</button></div>}
      </State>
    </main>
  );
}
