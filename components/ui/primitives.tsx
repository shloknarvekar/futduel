import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function Panel({
  className,
  children,
  as: Tag = 'div',
  ...props
}: { as?: ElementType; className?: string; children: ReactNode } & ComponentPropsWithoutRef<'div'>) {
  return (
    <Tag className={cn('panel', className)} {...props}>
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Section header                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeader({
  kicker,
  title,
  description,
  action,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {kicker ? <p className="kicker mb-2">{kicker}</p> : null}
        <h2 className="text-[clamp(1.6rem,4vw,2.4rem)]">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
  className,
  style,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'home' | 'away' | 'gold' | 'danger';
  className?: string;
  style?: React.CSSProperties;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-[var(--color-line-strong)] text-[var(--color-ink-muted)]',
    home: 'border-[var(--color-home-deep)] text-[var(--color-home)] bg-[color-mix(in_oklab,var(--color-home)_8%,transparent)]',
    away: 'border-[var(--color-away-deep)] text-[var(--color-away)] bg-[color-mix(in_oklab,var(--color-away)_8%,transparent)]',
    gold: 'border-[var(--color-gold)] text-[var(--color-gold)] bg-[rgba(255,194,75,0.08)]',
    danger: 'border-[var(--color-danger)] text-[var(--color-danger)] bg-[rgba(255,84,104,0.08)]',
  };
  return (
    <span
      className={cn(
        'meta inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-[11px]',
        tones[tone],
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-[2px]', className)} aria-hidden="true" />;
}

/**
 * Wraps a loading region so screen readers hear one clear message instead of a
 * stream of placeholder boxes.
 */
export function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty and error states                                                     */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'panel flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface-3)] text-[var(--color-ink-muted)]">
        {icon ?? <Inbox className="size-5" aria-hidden="true" />}
      </div>
      <h3 className="text-lg">{title}</h3>
      <p className="max-w-[46ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
  className,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'panel flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        'border-[rgba(255,84,104,0.35)]',
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full border border-[rgba(255,84,104,0.4)] bg-[rgba(255,84,104,0.08)] text-[var(--color-danger)]">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <h3 className="text-lg">{title}</h3>
      <p className="max-w-[46ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat display                                                               */
/* -------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'home' | 'away' | 'gold';
}) {
  const color =
    tone === 'home' ? 'var(--color-home)' : tone === 'away' ? 'var(--color-away)' : tone === 'gold' ? 'var(--color-gold)' : 'var(--color-ink)';
  return (
    <div className="panel px-4 py-3.5">
      <p className="kicker mb-1.5 text-[10px]">{label}</p>
      <p className="tnum font-display text-[clamp(1.4rem,3vw,1.9rem)] leading-none" style={{ color }}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-2xs text-[var(--color-ink-faint)]">{hint}</p> : null}
    </div>
  );
}

/**
 * A labelled comparison bar. The number is always present in text, so the bar
 * is decoration rather than the only way to read the value.
 */
export function CompareBar({
  label,
  home,
  away,
  format = (n: number) => String(n),
}: {
  label: string;
  home: number;
  away: number;
  format?: (n: number) => string;
}) {
  const total = home + away || 1;
  const homePct = Math.round((home / total) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="tnum font-semibold text-[var(--color-home)]">{format(home)}</span>
        <span className="kicker text-[10px]">{label}</span>
        <span className="tnum font-semibold text-[var(--color-away)]">{format(away)}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
        <div
          className="h-full rounded-l-full bg-[var(--color-home)] transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="h-full rounded-r-full bg-[var(--color-away)] transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${100 - homePct}%` }}
        />
      </div>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('hairline my-8', className)} role="presentation" />;
}
