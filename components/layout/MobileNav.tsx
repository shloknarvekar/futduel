'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActive, navItems } from './nav-items';
import { cn } from '@/lib/utils/cn';

/**
 * Phone navigation. Up to five destinations, icon plus label, and the whole bar
 * sits above the gesture area via the safe-area inset.
 */
export function MobileNav({ liveFootball }: { liveFootball: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 lg:hidden',
        'border-t border-[var(--color-line)] bg-[color-mix(in_oklab,var(--background)_94%,transparent)] backdrop-blur-xl',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {navItems(liveFootball, 'primary').map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-[60px] flex-col items-center justify-center gap-1 transition-colors',
                  active ? 'text-[var(--color-home)]' : 'text-[var(--color-ink-muted)] active:bg-[var(--color-surface-2)]',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-0 h-[3px] w-10 transition-opacity duration-200',
                    active ? 'bg-[var(--color-home)] opacity-100' : 'opacity-0',
                  )}
                />
                <Icon className="size-[19px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                <span className="meta text-[10px]">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
