import Link from 'next/link';
export const metadata = { title: 'MUSE · Find your sound. Find your people.' };

const ROLES = ['Singers', 'Rappers', 'Producers', 'Beatmakers', 'Songwriters', 'DJs', 'Guitarists', 'Pianists', 'Drummers', 'Bassists', 'Mixing engineers', 'Mastering engineers'];

export default function Welcome() {
  return (
    <main className="m-hero">
      <p className="m-logo">MUSE</p>
      <div className="m-eq" aria-hidden="true">{Array.from({ length: 28 }).map((_, i) => <i key={i} style={{ animationDelay: `${((i * 0.11) % 1.3).toFixed(2)}s`, animationDuration: `${(0.8 + (i % 5) * 0.17).toFixed(2)}s` }} />)}</div>
      <h1>Find your sound.<br />Find your people.<br />Make something together.</h1>
      <p className="m-muted m-hero__sub">The global home for singers, rappers, producers, songwriters, DJs, instrumentalists and engineers to find each other and turn ideas into finished music.</p>
      <div className="m-actions m-hero__cta">
        <Link className="m-btn m-btn--primary" href="/signup">Create your free profile</Link>
        <Link className="m-btn m-btn--ghost" href="/login">Log in</Link>
      </div>
      <div className="m-marquee" aria-hidden="true"><div className="m-marquee__track">{[...ROLES, ...ROLES].map((r, i) => <span key={i}>{r}</span>)}</div></div>
      <ul className="m-hero__points">
        <li><strong>Discover</strong><span>Search artists worldwide by role, genre, location and what they’re open to.</span></li>
        <li><strong>Collaborate</strong><span>Post opportunities, send requests and agree how you’ll work together.</span></li>
        <li><strong>Create</strong><span>Message, share references and manage projects from idea to release.</span></li>
      </ul>
    </main>
  );
}
