'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar, State } from '@/components/ui';
import { COMP, PROJECT_STATUS, WORK } from '@/lib/labels';
import { timeAgo } from '@/lib/format';

function Section({ title, href, linkText, empty, children }) {
  return (
    <section className="m-card" aria-label={title}>
      <header className="m-pagehead"><h2>{title}</h2>{href && <Link className="m-link" href={href}>{linkText || 'See all'}</Link>}</header>
      {empty ? <p className="m-muted">{empty}</p> : children}
    </section>
  );
}

export default function Home() {
  const sb = supabaseBrowser();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      const [prof, rec, convs, reqs, projs, myRoles] = await Promise.all([
        sb.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
        sb.rpc('discover_artists', { p_sort: 'recommended', p_limit: 4 }),
        sb.rpc('my_conversations'),
        sb.from('collaboration_requests').select('id,description,created_at,sender:profiles!sender_id(display_name,username)').eq('recipient_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
        sb.from('projects').select('id,title,status,progress').in('status', ['planning', 'in_progress', 'awaiting_feedback']).order('created_at', { ascending: false }).limit(3),
        sb.from('user_roles').select('role_id').eq('user_id', user.id),
      ]);
      let q = sb.from('collaborations').select('id,title,compensation_type,work_pref,created_at,genres(name)').eq('status', 'open').neq('creator_id', user.id).order('created_at', { ascending: false }).limit(4);
      const roleIds = (myRoles.data || []).map((r) => r.role_id);
      if (roleIds.length) {   // prefer listings that need one of my roles
        const { data: cr } = await sb.from('collaboration_roles').select('collaboration_id').in('role_id', roleIds);
        const ids = (cr || []).map((x) => x.collaboration_id);
        if (ids.length) q = q.in('id', ids);
      }
      const opp = await q;
      const failed = [prof, rec, convs, reqs, projs, opp].find((r) => r.error);
      if (failed) return setErr(failed.error.message);
      setD({ name: prof.data?.display_name, rec: rec.data?.rows || [], convs: (convs.data || []).slice(0, 3), reqs: reqs.data || [], projs: projs.data || [], opp: opp.data || [] });
    })();
  }, []);

  return (
    <main className="m-page">
      <State loading={!d && !err} error={err}>
        {d && (<>
          <h1>Welcome back, {d.name}</h1>
          <div className="m-actions">
            <Link className="m-btn m-btn--primary" href="/discover">Discover artists</Link>
            <Link className="m-btn m-btn--primary" href="/collaborations/new">Create collaboration</Link>
            <Link className="m-btn m-btn--ghost" href="/messages">View messages</Link>
            <Link className="m-btn m-btn--ghost" href="/projects">Manage projects</Link>
          </div>
          <Section title="Recommended artists" href="/discover" empty={d.rec.length === 0 ? 'Add roles, genres and what you’re looking for to your profile to get recommendations.' : ''}>
            <div className="m-grid">{d.rec.map((a) => (
              <Link key={a.id} href={`/profile/${a.username}`} className="m-collab__by" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Avatar url={a.avatar_url} name={a.display_name} size={44} />
                <span><strong>{a.display_name}</strong><br /><span className="m-muted">{(a.roles || []).slice(0, 2).join(', ')}{a.score ? ` · ${a.score}% match` : ''}</span></span>
              </Link>))}</div>
          </Section>
          <Section title="New opportunities" href="/collaborations" empty={d.opp.length === 0 ? 'No open listings right now. Be the first to post one.' : ''}>
            <ul className="m-plain m-stack">{d.opp.map((c) => <li key={c.id}><Link className="m-link" href={`/collaborations/${c.id}`}>{c.title}</Link> <span className="m-muted">· {COMP[c.compensation_type]} · {WORK[c.work_pref]} · {timeAgo(c.created_at)}</span></li>)}</ul>
          </Section>
          <Section title="Requests waiting for you" href="/collaborations?tab=requests" linkText="Review" empty={d.reqs.length === 0 ? 'No pending requests.' : ''}>
            <ul className="m-plain m-stack">{d.reqs.map((r) => <li key={r.id}><strong>{r.sender?.display_name}</strong> <span className="m-muted">· {timeAgo(r.created_at)}</span><p className="m-clamp">{r.description}</p></li>)}</ul>
          </Section>
          <Section title="Recent messages" href="/messages" empty={d.convs.length === 0 ? 'No conversations yet. Message an artist to get started.' : ''}>
            <ul className="m-plain m-stack">{d.convs.map((c) => <li key={c.id}><Link className="m-collab__by" href={`/messages?c=${c.id}`}><Avatar url={c.avatar_url} name={c.display_name} size={32} /><strong>{c.display_name}</strong>{c.unread > 0 && <span className="m-badge">{c.unread}</span>}<span className="m-muted m-clamp1">{c.last_message}</span></Link></li>)}</ul>
          </Section>
          <Section title="Active projects" href="/projects" empty={d.projs.length === 0 ? 'No active projects. Accept a request to start one.' : ''}>
            <ul className="m-plain m-stack">{d.projs.map((p) => <li key={p.id}><Link className="m-link" href={`/projects/${p.id}`}>{p.title}</Link> <span className="m-chip">{PROJECT_STATUS[p.status]}</span> <progress value={p.progress} max="100" aria-label={`${p.progress}% complete`} /></li>)}</ul>
          </Section>
        </>)}
      </State>
    </main>
  );
}
