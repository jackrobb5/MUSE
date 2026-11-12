'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DiscoverArtists from '@/components/DiscoverArtists';
import MediaFeed from '@/components/MediaFeed';

const TABS = [['artists', 'Artists'], ['releases', 'Published projects'], ['samples', 'Samples']];

export default function DiscoverPage() {
  const [tab, setTab] = useState('artists');
  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (TABS.some(([k]) => k === t)) setTab(t); }, []);
  return (
    <main className="m-page">
      <header className="m-pagehead">
        <h1>Discover</h1>
        <div className="m-actions"><Link className="m-btn m-btn--ghost" href="/samples">Post a sample</Link></div>
      </header>
      <div className="m-tabs" role="tablist">{TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className="m-tab" onClick={() => setTab(k)}>{label}</button>)}</div>
      {tab === 'artists' ? <DiscoverArtists /> : <MediaFeed key={tab} kind={tab} />}
    </main>
  );
}
