'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import RequestDialog from './RequestDialog';
import SafetyMenu from './SafetyMenu';
import FriendButton from './FriendButton';

export default function ProfileActions({ artistId, displayName, saved: initialSaved }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function message() {
    setBusy(true);
    const { data, error } = await sb.rpc('start_conversation', { p_other: artistId });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.push(`/messages?c=${data}`);
  }
  async function toggleSave() {
    const { data: { user } } = await sb.auth.getUser();
    const { error } = saved
      ? await sb.from('favourites').delete().match({ user_id: user.id, artist_id: artistId })
      : await sb.from('favourites').insert({ user_id: user.id, artist_id: artistId });
    if (error) setMsg(error.message); else setSaved(!saved);
  }
  return (
    <div>
      <div className="m-actions">
        <button className="m-btn m-btn--primary" onClick={message} disabled={busy}>Send message</button>
        <button className="m-btn m-btn--primary" onClick={() => setOpen(true)}>Request collaboration</button>
        <a className="m-btn m-btn--ghost" href="#music">View music</a>
        <button className="m-btn m-btn--ghost" aria-pressed={saved} onClick={toggleSave}>{saved ? 'Saved' : 'Save artist'}</button>
        <FriendButton otherId={artistId} />
        <SafetyMenu targetType="profile" targetId={artistId} blockUserId={artistId} />
      </div>
      {msg && <p role="status" className="m-muted">{msg}</p>}
      {open && <RequestDialog recipientId={artistId} recipientName={displayName} onClose={() => setOpen(false)} onSent={() => setMsg('Request sent.')} />}
    </div>
  );
}
