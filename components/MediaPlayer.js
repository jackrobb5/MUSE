'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { kindOf } from '@/lib/files';

// Plays audio/video from a private bucket through a short-lived signed link. Storage rules decide who may play it.
export default function MediaPlayer({ bucket, path, mime, label }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const kind = kindOf(mime);

  async function toggle() {
    if (url) return setUrl(null);
    setBusy(true); setErr('');
    const { data, error } = await supabaseBrowser().storage.from(bucket).createSignedUrl(path, 3600);
    setBusy(false);
    if (error) return setErr('This file isn’t available.');
    setUrl(data.signedUrl);
  }
  return (
    <div className="m-player">
      <button type="button" className="m-btn m-btn--ghost" onClick={toggle} disabled={busy} aria-expanded={!!url}>{url ? 'Hide' : '▶ Play'}{label ? `: ${label}` : ''}</button>
      {err && <p role="alert" className="m-error">{err}</p>}
      {url && kind === 'video' && <video className="m-media" src={url} controls autoPlay playsInline preload="metadata" />}
      {url && kind === 'audio' && <audio className="m-media" src={url} controls autoPlay preload="metadata" />}
    </div>
  );
}
