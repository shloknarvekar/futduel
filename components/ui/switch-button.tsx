'use client';

import { useState } from 'react';
import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { schemeAnnouncement, switchLabel, useColorScheme } from './color-scheme';

/**
 * The light/dark switch. Adapted from KokonutUI's Switch Button
 * (@dorianbaffier, MIT, kokonutui.com) for FutDuel:
 *
 * - Theme: FutDuel's own `.dark` class through `useColorScheme`, not
 *   next-themes, so there is still exactly one theme system.
 * - Colour: the semantic theme (card, muted, secondary, accent, border,
 *   foreground) instead of zinc, and the sun in FutDuel's gold instead of
 *   amber. The hover shimmer carries a trace of the primary blue-violet.
 * - Hydration: everything that depends on the mode — the sun's turn and
 *   colour, which label shows — is drawn from the `dark:` class, which the
 *   layout's inline script sets before the first paint. The server and the
 *   first client render therefore agree, and nothing flashes. Only the
 *   accessible name waits for mount.
 * - Size: every size is at least 44px tall, and icon-only is a 44px square.
 * - Motion: the spin on hover and the shimmer are `motion-safe` only; with
 *   reduced motion the switch still works and still shows its state.
 */
interface SwitchButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'minimal';
  size?: 'sm' | 'default' | 'lg';
  /**
   * Write the current mode ("Light" or "Dark") beside the sun. `'sm'` writes
   * it from the sm breakpoint up and keeps a compact square below it.
   */
  showLabel?: boolean | 'sm';
}

const VARIANTS = {
  minimal: [
    'rounded-xl overflow-hidden',
    'bg-linear-to-b from-card to-muted dark:from-secondary dark:to-card',
    'hover:from-muted hover:to-secondary dark:hover:from-accent dark:hover:to-secondary',
    'border border-border hover:border-[var(--color-line-strong)]',
    'shadow-[0_1px_2px_-1px_rgb(0_0_0/0.1),0_1px_3px_-2px_rgb(0_0_0/0.1)] dark:shadow-[0_1px_2px_-1px_rgb(0_0_0/0.3),0_1px_3px_-2px_rgb(0_0_0/0.3)]',
    'hover:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.15),0_2px_6px_-3px_rgb(0_0_0/0.15)] dark:hover:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.4),0_2px_6px_-3px_rgb(0_0_0/0.4)]',
    'active:shadow-[0_0_1px_0_rgb(0_0_0/0.1)] dark:active:shadow-[0_0_1px_0_rgb(0_0_0/0.2)]',
    'after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:bg-linear-to-t after:from-white/10 after:to-transparent after:opacity-0 after:transition-opacity hover:after:opacity-100',
    'before:pointer-events-none before:absolute before:inset-px before:rounded-[11px] before:bg-linear-to-b before:from-white/20 before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100 dark:before:from-white/5',
  ],
};

// Kokonut's sm and default were 32px and 40px tall; here nothing drops below 44.
const SIZES = {
  sm: { box: 'h-11 px-3', square: 'w-11 px-0', squareUntilSm: 'w-11 px-0 sm:w-auto sm:px-3', icon: 'size-3.5' },
  default: { box: 'h-11 px-4', square: 'w-11 px-0', squareUntilSm: 'w-11 px-0 sm:w-auto sm:px-4', icon: 'size-4' },
  lg: { box: 'h-12 px-5', square: 'w-12 px-0', squareUntilSm: 'w-12 px-0 sm:w-auto sm:px-5', icon: 'size-5' },
};

const UNDERLINE =
  'absolute -bottom-px left-0 h-px w-full bg-linear-to-r from-transparent via-muted-foreground/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100';

export function SwitchButton({
  className,
  variant = 'minimal',
  size = 'default',
  showLabel = true,
  onClick,
  ...props
}: SwitchButtonProps) {
  const { scheme, toggle } = useColorScheme();
  const [announcement, setAnnouncement] = useState('');
  const dims = SIZES[size];

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnnouncement(schemeAnnouncement(toggle()));
    onClick?.(event);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label={switchLabel(scheme, showLabel !== false)}
        className={cn(
          'group relative shrink-0',
          // Kokonut's transition-all also faded the focus ring in from a grey
          // outline; everything that should ease is named, and the ring snaps.
          'transition-[color,border-color,box-shadow,transform,--tw-gradient-from,--tw-gradient-to] duration-300 ease-out',
          'text-muted-foreground hover:text-foreground',
          VARIANTS[variant],
          dims.box,
          showLabel === false && dims.square,
          showLabel === 'sm' && dims.squareUntilSm,
          className,
        )}
        onClick={handleClick}
        {...props}
      >
        <span className="flex items-center gap-2 transition-all duration-300 ease-out">
          <Sun
            aria-hidden="true"
            className={cn(
              dims.icon,
              'shrink-0 transform-gpu transition-all duration-700 ease-in-out',
              // The sun sits a half-turn round in dark mode, and spins a full
              // turn under the pointer only when motion is welcome.
              'rotate-0 dark:rotate-180',
              'motion-safe:group-hover:rotate-[360deg] motion-safe:group-hover:scale-110',
              'group-active:scale-95 motion-reduce:group-active:scale-100',
              'text-[var(--color-gold)] group-hover:text-[color-mix(in_oklab,var(--color-gold)_82%,var(--foreground))]',
              'dark:text-muted-foreground dark:group-hover:text-foreground',
              'drop-shadow-[0_0_12px_color-mix(in_oklab,var(--color-icon)_30%,transparent)] dark:drop-shadow-[0_0_12px_color-mix(in_oklab,var(--color-icon)_20%,transparent)]',
            )}
          />
          {showLabel !== false ? (
            <span
              aria-hidden="true"
              className={cn(
                // The Button's condensed caps are for actions; this reads as a
                // state, in the theme's own face.
                'relative font-sans text-sm font-medium normal-case tracking-normal',
                showLabel === 'sm' ? 'hidden sm:inline-block' : 'inline-block',
              )}
            >
              <span className="absolute inset-0 opacity-100 transition-opacity duration-300 ease-out dark:opacity-0">
                Light
                <span className={UNDERLINE} />
              </span>
              <span className="absolute inset-0 opacity-0 transition-opacity duration-300 ease-out dark:opacity-100">
                Dark
                <span className={UNDERLINE} />
              </span>
              {/* Holds the width, so switching never nudges the header. */}
              <span className="invisible">Light</span>
            </span>
          ) : null}
        </span>
        {/* Shimmer sweep, left to right across the face on hover. */}
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 z-[1] -translate-x-full',
            'bg-linear-to-r from-transparent via-primary/[0.1] to-transparent dark:via-white/[0.06]',
            'transition-transform duration-500 ease-in-out',
            'motion-safe:group-hover:translate-x-full motion-reduce:hidden',
          )}
        />
        {/* Soft light from the centre on hover. */}
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 z-[2] opacity-0 transition-opacity duration-500 group-hover:opacity-100',
            'bg-[radial-gradient(circle_at_50%_50%,rgb(255_255_255/0.12),transparent_70%)]',
            'dark:bg-[radial-gradient(circle_at_50%_50%,rgb(255_255_255/0.07),transparent_70%)]',
          )}
        />
      </Button>
      {/* The new mode is announced after a change, outside the button so it is not part of its name. */}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
