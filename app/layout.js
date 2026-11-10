import { Inter } from 'next/font/google';
import './tokens.css';
import './globals.css';
import './muse-features.css';
import './muse-polish.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

export const metadata = {
  title: { default: 'MUSE · Find your sound. Find your people.', template: '%s' },
  description: 'The global platform for musicians, vocalists, producers and songwriters to find each other and make music together.',
};
export const viewport = { themeColor: '#101014', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (<html lang="en" className={inter.variable}><body>{children}</body></html>);
}
