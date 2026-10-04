import type { Metadata, Viewport } from 'next';
import { Anton, Barlow_Condensed, Geist, Geist_Mono, Noto_Serif_Georgian } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/ui/footer-section';
import { DATASET_SEASON } from '@/lib/data/players';
import { AppBootstrap } from '@/components/layout/AppBootstrap';
import { isLiveFootballConfigured } from '@/lib/football/provider';

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});

/* The theme's three families. Anton and Barlow Condensed stay for the
   broadcast display and label roles, which the theme does not name. */
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

const notoSerifGeorgian = Noto_Serif_Georgian({
  subsets: ['latin'],
  variable: '--font-noto-serif-georgian',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});


export const metadata: Metadata = {
  title: {
    default: 'FutDuel — Spin. Build. Duel.',
    template: '%s · FutDuel',
  },
  description:
    'Spin for a football category, build the best starting eleven you can under it, and settle it with a simulated match. Player discovery, challenges and friend duels.',
  applicationName: 'FutDuel',
  openGraph: {
    title: 'FutDuel — Spin. Build. Duel.',
    description: 'Two managers. Two categories. One eleven each. Ninety minutes to settle it.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is never disabled.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  colorScheme: 'light dark',
};

/**
 * Sets the mode before the first paint, so a dark-mode visitor never sees a
 * white flash. It reads the same key the toggle writes and otherwise follows
 * the system; an unreadable storage (private mode, blocked site data) simply
 * falls through to the system preference.
 */
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('futduel-theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Only whether a provider is configured reaches the client, never its token.
  const liveFootball = isLiveFootballConfigured();

  return (
    <html
      lang="en"
      // The script above sets .dark before React sees the document.
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${notoSerifGeorgian.variable} ${anton.variable} ${barlowCondensed.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh pb-[calc(58px+env(safe-area-inset-bottom))] lg:pb-0">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to main content
        </a>

        <SiteHeader liveFootball={liveFootball} />

        <main id="main" tabIndex={-1}>
          {children}
        </main>

        <Footer liveFootball={liveFootball} datasetSeason={DATASET_SEASON} />
        <MobileNav liveFootball={liveFootball} />
        <AppBootstrap />
      </body>
    </html>
  );
}
