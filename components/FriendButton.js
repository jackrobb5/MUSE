'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function FriendButton({ otherId }) {
  const sb = supabaseBrowser();
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('friend_status', { p_other: otherId });
    if (error) setErr(error.message); else setSt(data);
  }, [otherId]);
  useEffect(() => { load(); }, [load]);
  async function call(fn, args) { setErr(''); const { error } = await sb.rpc(fn, args); if (error) setErr(error.message); load(); }
  if (st === null) return null;
  return (
    <>
      {st === 'none' && <button className="m-btn m-btn--ghost" onClick={() => call('send_friend_request', { p_other: otherId })}>Add friend</button>}
      {st === 'pending_out' && <button className="m-btn m-btn--ghost" onClick={() => call('remove_friend', { p_other: otherId })}>Request sent · Cancel</button>}
      {st === 'pending_in' && (<>
        <button className="m-btn m-btn--primary" onClick={() => call('respond_friend_request', { p_other: otherId, p_accept: true })}>Accept friend request</button>
        <button className="m-btn m-btn--ghost" onClick={() => call('respond_friend_request', { p_other: otherId, p_accept: false })}>Decline</button>
      </>)}
      {st === 'friends' && <button className="m-btn m-btn--ghost" aria-pressed="true" onClick={() => { if (confirm('Remove this friend?')) call('remove_friend', { p_other: otherId }); }}>Friends ✓</button>}
      {err && <span role="alert" className="m-error">{err}</span>}
    </>
  );
}
