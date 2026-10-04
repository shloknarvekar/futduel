'use client';

import React from 'react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
// framer-motion is the library `motion/react` re-exports; it is already the
// project's animation dependency, so the same API comes from here.
import { motion, useReducedMotion } from 'framer-motion';
import { Wordmark } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';

interface FooterLink {
  title: string;
  href: string;
}

interface FooterSection {
  label: string;
  links: FooterLink[];
}

/**
 * Every destination is a real page, or a real section of one. FutDuel has no
 * social accounts, blog or legal pages, so none are listed, and nothing points
 * at "#". Fantasy runs only on live football data, so it appears only then.
 */
function footerLinks(liveFootball: boolean): FooterSection[] {
  return [
    {
      label: 'Play',
      links: [
        { title: 'Play a duel', href: '/duel' },
        { title: 'Challenges', href: '/challenges' },
        { title: 'Ranks', href: '/leaderboard' },
        ...(liveFootball ? [{ title: 'Fantasy', href: '/fantasy' }] : []),
      ],
    },
    {
      label: 'Explore',
      links: [
        { title: 'Home', href: '/' },
        { title: 'Discover players', href: '/discover' },
      ],
    },
    {
      label: 'Your record',
      links: [
        { title: 'Profile', href: '/profile' },
        { title: 'Match history', href: '/profile#history' },
        { title: 'Settings', href: '/profile#settings' },
        { title: 'Suggest a category', href: '/profile#suggest' },
      ],
    },
  ];
}

export function Footer({ liveFootball, datasetSeason }: { liveFootball: boolean; datasetSeason: string }) {
  return (
    <footer className="relative mt-12 w-full lg:mt-16 border-t border-border bg-[radial-gradient(35%_128px_at_50%_0%,color-mix(in_oklab,var(--foreground)_7%,transparent),transparent)]">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/20 blur"
      />

      <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid w-full gap-8 lg:grid-cols-3 lg:gap-8">
          <AnimatedContainer className="space-y-4">
            <Link href="/" aria-label="FutDuel home" className="inline-flex">
              <Wordmark />
            </Link>
            <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
              Spin a category. Build your strongest XI. Prove it over ninety minutes.
            </p>
            <p className="text-sm text-muted-foreground" suppressHydrationWarning>
              © {new Date().getFullYear()} FutDuel
            </p>
          </AnimatedContainer>

          <nav aria-label="Footer" className="mt-2 grid grid-cols-2 gap-8 md:grid-cols-3 lg:col-span-2 lg:mt-0">
            {footerLinks(liveFootball).map((section, index) => (
              <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
                <div>
                  <h2 className="kicker text-[11px] leading-none">{section.label}</h2>
                  <ul className="mt-3 text-sm text-muted-foreground">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="inline-flex min-h-10 items-center transition-colors duration-300 hover:text-foreground lg:min-h-8"
                        >
                          {link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedContainer>
            ))}
          </nav>
        </div>

        <AnimatedContainer delay={0.45}>
          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-2xs leading-relaxed text-muted-foreground sm:flex-row sm:items-start sm:justify-between lg:mt-14">
            <div className="grid max-w-[80ch] gap-2">
              <p>
                Card ratings are FutDuel&rsquo;s own editorial ratings of {datasetSeason} squads and of past seasons,
                and are not affiliated with, endorsed by, or sourced from any club, league or licensed game.
              </p>
              {liveFootball ? (
                <p>Live fixtures, squads and match statistics: Sportmonks. Fantasy points are FutDuel&rsquo;s own scoring.</p>
              ) : null}
            </div>
            <p className="shrink-0">Built as a portfolio project.</p>
          </div>
        </AnimatedContainer>
      </div>
    </footer>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: ComponentProps<typeof motion.div>['className'];
  children: ReactNode;
};

/**
 * Each column settles into place as the footer scrolls into view, once.
 *
 * The starting state is the same on the server and in the browser, so the page
 * hydrates cleanly. With reduced motion the reveal takes no time, and the
 * `fd-footer-reveal` rules in globals.css show the columns at rest from the
 * first paint, as they do when script never runs: an entrance is never the
 * only way to see the footer.
 */
function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ filter: 'blur(2px)', y: -8, opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={shouldReduceMotion ? { duration: 0 } : { delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={cn('fd-footer-reveal', className)}
    >
      {children}
    </motion.div>
  );
}
