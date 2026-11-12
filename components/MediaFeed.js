'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import { useDebounced } from '@/lib/useDebounced';
import { stripFilterChars } from '@/lib/format';
import { REL_SELECT, SMP_SELECT } from '@/lib/media';
import { State } from './ui';
import ReleaseCard from './ReleaseCard';
import SampleCard from './SampleCard';

const PAGE = 12;
const CFG = {
  releases: { table: 'releases', select: REL_SELECT, order: 'published_at', Card: ReleaseCard, prop: 'r',
    title: 'No published projects yet', text: 'Finished projects that people publish appear here, so you can hear what artists have made together.' },
  samples: { table: 'samples', select: SMP_SELECT, order: 'created_at', Card: SampleCard, prop: 's',
    title: 'No samples yet', text: 'Be the first to share a sample.' },
};

// Feed of published projects or samples. Visibility (public / friends only) is enforced by the database, so you only ever see what you're allowed to.
export default function MediaFeed({ kind }) {
  const sb = supabaseBrowser();
  const cfg = CFG[kind];
  const { genres } = useTaxonomy();
  const [f, setF] = useState({ q: '', genre: '', sort: 'newest' });
  const d = useDebounced(f, 350);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (offset, replace) => {
    const mine = ++seq.current;
    setStatus('loading');
    let q = sb.from(cfg.table).select(cfg.select, { count: 'exact' }).order(cfg.order, { ascending: d.sort === 'oldest' }).range(offset, offset + PAGE - 1);
    const s = stripFilterChars(d.q);
    if (s) q = q.ilike('title', `%${s}%`);
    if (d.genre) q = q.eq('genre_id', Number(d.genre));
    const { data, count, error } = await q;
    if (mine !== seq.current) return;
    if (error) { setErr(error.message); return setStatus('error'); }
    setRows((r) => (replace ? data : [...r, ...data]));
    setTotal(count || 0);
    setStatus('ready');
  }, [d, kind]);
  useEffect(() => { load(0, true); }, [load]);

  const Card = cfg.Card;
  return (
    <section className="m-stack">
      <div className="m-card m-filters">
        <div className="m-row">
          <label className="m-field">Search<input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Title" /></label>
          <label className="m-field">Genre<select value={f.genre} onChange={(e) => setF({ ...f, genre: e.target.value })}><option value="">Any</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className="m-field">Sort<select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>
        </div>
      </div>
      <State loading={status === 'loading' && rows.length === 0} error={status === 'error' ? err : ''} empty={status === 'ready' && rows.length === 0}
        emptyTitle={cfg.title} emptyText={cfg.text}
        action={kind === 'samples' ? <Link className="m-btn m-btn--primary" href="/samples">Post a sample</Link> : <Link className="m-btn m-btn--primary" href="/projects">Go to my projects</Link>}>
        <p className="m-muted" role="status">{total} {kind === 'releases' ? 'published project' : 'sample'}{total === 1 ? '' : 's'}</p>
        <div className="m-grid">{rows.map((row) => <Card key={row.id} {...{ [cfg.prop]: row }} />)}</div>
        {rows.length < total && <div className="m-actions"><button className="m-btn m-btn--ghost" onClick={() => load(rows.length, false)}>Load more</button></div>}
      </State>
    </section>
  );
}
