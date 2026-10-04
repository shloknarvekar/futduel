import { rankFor } from '@/lib/data/ladder';
import { tierFor } from '@/lib/engine/progression';
import { NAV_ITEMS, type NavItem } from './nav-items';

/**
 * What the profile menu offers, as data, so it can be checked without a
 * browser. Entries come from the site navigation rather than a second list, so
 * a label, icon or route cannot drift between the two.
 *
 * Only destinations that exist are listed. FutDuel has no accounts — the
 * profile lives in this browser — so there is no sign-out, no email and no
 * subscription to show, and nothing here pretends otherwise. A saved "My XI"
 * and a settings page do not exist yet, so they are not offered.
 */
export interface ProfileMenuItem extends Pick<NavItem, 'href' | 'label' | 'icon'> {
  /** A real value from the local profile, shown as a badge. */
  value?: string;
}

function destination(href: string): ProfileMenuItem {
  const item = NAV_ITEMS.find((candidate) => candidate.href === href);
  if (!item) throw new Error(`Profile menu points at ${href}, which is not in the site navigation`);
  return { href: item.href, label: item.label, icon: item.icon };
}

export function profileMenu(rating: number): ProfileMenuItem[] {
  return [
    { ...destination('/profile'), value: tierFor(rating).name },
    { ...destination('/leaderboard'), value: `#${rankFor(rating)}` },
    destination('/challenges'),
  ];
}
