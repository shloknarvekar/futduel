'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ice';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Fills are the theme's primary; the side accent only becomes ink and
  // strokes elsewhere, where it has to clear 4.5:1 on the ground.
  primary:
    'bg-primary text-primary-foreground shadow-md hover:bg-[color-mix(in_oklab,var(--primary)_88%,white)] active:bg-[color-mix(in_oklab,var(--primary)_88%,black)]',
  ice:
    'bg-[var(--color-away)] text-[var(--color-on-away)] hover:bg-[color-mix(in_oklab,var(--color-away)_88%,var(--color-on-away))] active:bg-[color-mix(in_oklab,var(--color-away)_80%,var(--color-on-away))]',
  secondary:
    'bg-[var(--color-surface-3)] text-[var(--color-ink)] border border-[var(--color-line-strong)] hover:bg-[var(--color-surface-4)] hover:border-[var(--color-ink-faint)] active:bg-[var(--color-surface-2)]',
  ghost:
    'bg-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-3)]',
  danger:
    'bg-[var(--color-danger)] text-[var(--color-on-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger)_88%,white)] active:bg-[color-mix(in_oklab,var(--color-danger)_88%,black)]',
};

// Every size clears the 44px minimum target, including the small one.
const SIZES: Record<Size, string> = {
  sm: 'h-11 px-4 text-[12px] gap-1.5',
  md: 'h-12 px-6 text-[13px] gap-2',
  lg: 'h-14 px-8 text-[15px] gap-2.5',
};

const BASE = cn(
  'meta relative inline-flex items-center justify-center rounded-md',
  'cursor-pointer select-none whitespace-nowrap',
  'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[var(--ease-out-soft)]',
  'active:scale-[0.98] motion-reduce:active:scale-100',
  'disabled:pointer-events-none disabled:opacity-45',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  '[touch-action:manipulation]',
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Announced while `loading` is true. */
  loadingLabel?: string;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, loadingLabel = 'Working', block, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
});

export interface ButtonLinkProps {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
  /** For a link whose visible text repeats down a list ("Replay"), the name that tells them apart. */
  'aria-label'?: string;
}

export function ButtonLink({
  href, variant = 'primary', size = 'md', block, icon, className, children, prefetch, 'aria-label': ariaLabel,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label={ariaLabel}
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className)}
    >
      {icon}
      {children}
    </Link>
  );
}
