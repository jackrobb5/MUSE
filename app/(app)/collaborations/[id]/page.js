'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Avatar, CopyrightNotice, State } from '@/components/ui';
import RequestDialog from '@/components/RequestDialog';
import SafetyMenu from '@/components/SafetyMenu';
import { COMP, WORK, EXPERIENCE_REQ } from '@/lib/labels';
import { timeAgo } from '@/lib/format';

export default function CollaborationDetail() {
  const { id } = useParams();
  const sb = supabaseBrowser();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [c, setC] = useState(null);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    setMe(user.id);
    const { data, error } = await sb.from('collaborations')
      .select('*, genres(name), creator:profiles!creator_id(id,username,display_name,avatar_url), collaboration_roles(musical_roles(name))').eq('id', id).maybeSingle();
    if (error || !data) return setErr(error?.message || 'This listing doesn’t exist or was removed.');
    setC(data);
    const [s, r] = await Promise.all([
      sb.from('saved_collaborations').select('collaboration_id').eq('collaboration_id', id).maybeSingle(),
      sb.from('collaboration_requests').select('id').eq('collaboration_id', id).eq('sender_id', user.id).eq('status', 'pending').maybeSingle(),
    ]);
    setSaved(!!s.data); setApplied(!!r.data);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function toggleSave() {
    const { error } = saved
      ? await sb.from('saved_collaborations').delete().match({ user_id: me, collaboration_id: id })
      : await sb.from('saved_collaborations').insert({ user_id: me, collaboration_id: id });
    if (error) setErr(error.message); else setSaved(!saved);
  }
  async function message() {
    const { data, error } = await sb.rpc('start_conversation', { p_other: c.creator.id });
    if (error) return setErr(error.message);
    router.push(`/messages?c=${data}`);
  }
  async function setStatus(status) {
    const { error } = await sb.from('collaborations').update({ status }).eq('id', id);
    if (error) setErr(error.message); else load();
  }
  async function remove() {
    if (!confirm('Delete this listing permanently?')) return;
    const { error } = await sb.from('collaborations').delete().eq('id', id);
    if (error) setErr(error.message); else router.push('/collaborations?tab=mine');
  }

  const mine = c && c.creator_id === me;
  return (
    <main className="m-page">
      <State loading={!c && !err} error={!c ? err : ''}>
        {c && (
          <>
            <Link href="/collaborations" className="m-link">← All listings</Link>
            <article className="m-card">
              <header className="m-pagehead"><h1>{c.title}</h1>{c.status === 'closed' && <span className="m-chip">Closed</span>}</header>
              <p className="m-collab__by"><Avatar url={c.creator.avatar_url} name={c.creator.display_name} size={32} /><Link href={`/profile/${c.creator.username}`}>{c.creator.display_name}</Link><span className="m-muted">· posted {timeAgo(c.created_at)}</span></p>
              <p className="m-prewrap">{c.description}</p>
              <dl className="m-facts">
                <dt>Looking for</dt><dd>{c.collaboration_roles.map((r) => r.musical_roles?.name).join(', ')}</dd>
                {c.genres?.name && <><dt>Genre</dt><dd>{c.genres.name}</dd></>}
                <dt>Location</dt><dd>{c.location || 'Worldwide'}</dd>
                <dt>Working</dt><dd>{WORK[c.work_pref]}</dd>
                <dt>Compensation</dt><dd>{COMP[c.compensation_type]}</dd>
                <dt>Experience</dt><dd>{EXPERIENCE_REQ[c.experience_level]}</dd>
              </dl>
              <div className="m-actions">
                {!mine && <button className="m-btn m-btn--primary" disabled={c.status === 'closed' || applied} onClick={() => setOpen(true)}>{applied ? 'Applied' : 'Apply'}</button>}
                {!mine && <button className="m-btn m-btn--ghost" onClick={message}>Contact creator</button>}
                <button className="m-btn m-btn--ghost" aria-pressed={saved} onClick={toggleSave}>{saved ? 'Saved' : 'Save'}</button>
                {mine && <>
                  <Link className="m-btn m-btn--ghost" href={`/collaborations/${id}/edit`}>Edit</Link>
                  <button className="m-btn m-btn--ghost" onClick={() => setStatus(c.status === 'open' ? 'closed' : 'open')}>{c.status === 'open' ? 'Close listing' : 'Reopen'}</button>
                  <button className="m-btn m-btn--ghost" onClick={remove}>Delete</button>
                </>}
                {!mine && <SafetyMenu targetType="collaboration" targetId={id} />}
              </div>
              {err && <p role="alert" className="m-error">{err}</p>}
              {msg && <p role="status" className="m-muted">{msg}</p>}
            </article>
            <CopyrightNotice />
            {open && <RequestDialog recipientId={c.creator.id} recipientName={c.creator.display_name} collaboration={{ id: c.id, title: c.title }}
              onClose={() => setOpen(false)} onSent={() => { setApplied(true); setMsg('Application sent. You’ll be notified when they respond.'); }} />}
          </>
        )}
      </State>
    </main>
  );
}
