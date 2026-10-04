import {
  Compass,
  Home,
  Swords,
  Target,
  Trophy,
  UserRound,
  CalendarDays,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar. Kept to five items by design. */
  primary?: boolean;
  /** Offered only when a live football data provider is configured. */
  requiresLiveData?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, primary: true },
  { href: '/duel', label: 'Duel', icon: Swords, primary: true },
  { href: '/fantasy', label: 'Fantasy', icon: CalendarDays, primary: true, requiresLiveData: true },
  { href: '/discover', label: 'Discover', icon: Compass, primary: true },
  { href: '/challenges', label: 'Challenges', icon: Target },
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: UserRound, primary: true },
];

/**
 * The destinations to offer. Fantasy runs only on real, current football, so
 * without a provider it is not in the navigation at all.
 */
export function navItems(liveFootball: boolean, where: 'all' | 'primary' | 'desktop' = 'all'): NavItem[] {
  return NAV_ITEMS.filter((item) => liveFootball || !item.requiresLiveData).filter((item) =>
    where === 'primary' ? item.primary : where === 'desktop' ? item.href !== '/' && item.href !== '/profile' : true,
  );
}

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface MorphicShape {
  active: boolean;
  roundLeft: boolean;
  roundRight: boolean;
}

/**
 * The Morphic navbar's shape for one item. Inactive items join into a single
 * bar; the active item steps out of it as its own pill, and the pieces of bar
 * either side of the gap round off so they read as ends rather than cut edges.
 * With no active item (home, profile) the bar is simply whole.
 */
export function morphicShape(index: number, activeIndex: number, count: number): MorphicShape {
  if (index === activeIndex) return { active: true, roundLeft: true, roundRight: true };
  return {
    active: false,
    roundLeft: index === 0 || index - 1 === activeIndex,
    roundRight: index === count - 1 || index + 1 === activeIndex,
  };
}
