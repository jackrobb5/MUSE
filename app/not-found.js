import Link from 'next/link';
export const metadata = { title: 'Page not found · MUSE' };
export default function NotFound() {
  return (<main className="m-page"><div className="m-state"><h1>Page not found</h1><p>The page you’re looking for doesn’t exist or isn’t available to you.</p><Link className="m-btn m-btn--primary" href="/">Back home</Link></div></main>);
}
