'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Wordmark } from './Logo';
import { MorphicNav } from './MorphicNav';
import { ProfileDropdown } from './ProfileDropdown';
import { SwitchButton } from '@/components/ui/switch-button';
import { cn } from '@/lib/utils/cn';

export function SiteHeader({ liveFootball }: { liveFootball: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled
          ? 'border-[var(--color-line)] bg-[color-mix(in_oklab,var(--background)_88%,transparent)] backdrop-blur-xl'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex h-11 shrink-0 items-center rounded-md" aria-label="FutDuel home">
          <Wordmark />
        </Link>

        <MorphicNav liveFootball={liveFootball} />

        <div className="ml-auto flex items-center gap-2">
          <SwitchButton showLabel="sm" />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}
