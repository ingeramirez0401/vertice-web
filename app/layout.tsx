import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-space' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_BRAND_NAME || 'VÉRTICE',
  description: 'Red mesh de adhesión política',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-space, "Space Grotesk", sans-serif)' }}>
        {children}
      </body>
    </html>
  );
}
