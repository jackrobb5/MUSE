'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { REL_SELECT, SMP_SELECT } from '@/lib/media';
import ReleaseCard from './ReleaseCard';
import SampleCard from './SampleCard';

// Published projects (including ones this artist is credited on) and samples, filtered by what the viewer is allowed to see.
export default function ProfileMedia({ userId, isMe }) {
  const sb = supabaseBrowser();
  const [d, setD] = useState(null);
  useEffect(() => {
    (async () => {
      const [s, cr] = await Promise.all([
        sb.from('samples').select(SMP_SELECT).eq('owner_id', userId).order('created_at', { ascending: false }).limit(6),
        sb.from('release_credits').select('release_id').eq('user_id', userId),
      ]);
      let releases = [];
      const ids = (cr.data || []).map((x) => x.release_id);
      if (ids.length) { const r = await sb.from('releases').select(REL_SELECT).in('id', ids).order('published_at', { ascending: false }).limit(6); releases = r.data || []; }
      setD({ samples: s.data || [], releases });
    })();
  }, [userId]);
  if (!d || (!isMe && d.samples.length === 0 && d.releases.length === 0)) return null;
  return (
    <>
      <section className="m-stack">
        <h2>Published projects</h2>
        {d.releases.length > 0 ? <div className="m-grid">{d.releases.map((r) => <ReleaseCard key={r.id} r={r} />)}</div>
          : <p className="m-muted">{isMe ? 'Mark a project as completed, then publish it from the project page.' : 'Nothing to show yet.'}</p>}
      </section>
      <section className="m-stack">
        <header className="m-pagehead"><h2>Samples</h2>{isMe && <Link className="m-btn m-btn--ghost" href="/samples">Manage samples</Link>}</header>
        {d.samples.length > 0 ? <div className="m-grid">{d.samples.map((s) => <SampleCard key={s.id} s={s} />)}</div>
          : <p className="m-muted">{isMe ? 'Share a clip of something you’ve made.' : 'Nothing to show yet.'}</p>}
      </section>
    </>
  );
}
