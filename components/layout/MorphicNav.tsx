'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { isActive, morphicShape, navItems } from './nav-items';

/**
 * The desktop navigation, in KokonutUI's Morphic style: the destinations sit
 * in one joined bar and the current one steps out of it as a pill.
 *
 * The current item is read from the URL on every render, never kept in local
 * state, so it is right after a direct visit, a reload, a deep link such as
 * /duel?challenge=…, and the browser's back and forward buttons. The items are
 * the site's own navigation data; the phone tab bar reads the same list.
 */
export function MorphicNav({ liveFootball }: { liveFootball: boolean }) {
  const pathname = usePathname();
  const items = navItems(liveFootball, 'desktop');
  const activeIndex = items.findIndex((item) => isActive(pathname, item.href));

  return (
    <nav aria-label="Main" className="ml-4 hidden lg:block">
      <ul className="flex items-center">
        {items.map((item, index) => {
          const shape = morphicShape(index, activeIndex, items.length);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={shape.active ? 'page' : undefined}
                className={cn(
                  'flex h-11 items-center px-4 text-sm transition-[margin,border-radius,background-color,color] duration-300 ease-[var(--ease-out-soft)]',
                  shape.active
                    ? 'mx-2 rounded-xl bg-primary font-semibold text-primary-foreground'
                    : cn(
                        'bg-secondary font-medium text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
                        shape.roundLeft && 'rounded-l-xl',
                        shape.roundRight && 'rounded-r-xl',
                      ),
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
