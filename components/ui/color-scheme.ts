'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * FutDuel's one theme system: a `dark` class on <html>.
 *
 * The inline script in `app/layout.tsx` sets that class before the first paint,
 * from the stored choice or, until someone chooses, from the system. This
 * module only reads and changes it, and stores a choice under the same key the
 * script reads, so a refresh or a new tab opens in the mode that was picked.
 * There is deliberately no provider or context: the class is the state.
 */
export const THEME_STORAGE_KEY = 'futduel-theme';

export type ColorScheme = 'light' | 'dark';

const NAME: Record<ColorScheme, string> = { light: 'Light', dark: 'Dark' };

export function oppositeScheme(scheme: ColorScheme): ColorScheme {
  return scheme === 'dark' ? 'light' : 'dark';
}

/**
 * The switch's accessible name. It says what pressing it does; when the
 * current mode is also written on the button, the name starts with that word
 * too, so someone using voice control can say what they see. Before mount the
 * mode is unknown to React, so the name commits to neither.
 */
export function switchLabel(scheme: ColorScheme | null, showsMode: boolean): string {
  if (!scheme) return 'Switch theme';
  const action = `Switch to ${NAME[oppositeScheme(scheme)].toLowerCase()} mode`;
  return showsMode ? `${NAME[scheme]} mode. ${action}` : action;
}

/** Read out after a change, so the new state is announced, not just the next action. */
export function schemeAnnouncement(scheme: ColorScheme): string {
  return `${NAME[scheme]} mode on`;
}

function schemeOnPage(): ColorScheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * The current mode (null until mounted) and a toggle. Anything that can be
 * drawn from the class, draw with `dark:` styles instead of this value: those
 * are right on the first paint, where this is still null.
 */
export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorScheme | null>(null);

  useEffect(() => {
    setScheme(schemeOnPage());
  }, []);

  // A visitor who has not chosen keeps following the system while the page is
  // open, so a laptop switching to night mode takes the site with it.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        // Unreadable storage means nothing was ever stored.
      }
      document.documentElement.classList.toggle('dark', event.matches);
      setScheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback((): ColorScheme => {
    const next = oppositeScheme(schemeOnPage());
    document.documentElement.classList.toggle('dark', next === 'dark');
    setScheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The mode still applies for this visit.
    }
    return next;
  }, []);

  return { scheme, toggle };
}
