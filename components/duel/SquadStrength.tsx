'use client';

import { Link2 } from 'lucide-react';
import type { SquadRating } from '@/lib/domain/types';
import { formatMoney } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

function Meter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  // Ratings live roughly between 55 and 95; the bar maps that range so
  // differences are visible instead of being crushed into the top fifth.
  const pct = Math.max(2, Math.min(100, ((value - 52) / 44) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="kicker text-[11px]">{label}</span>
        <span className="tnum text-[13px] font-bold" style={{ color: accent }}>
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  );
}

export function SquadStrength({
  rating,
  side = 'home',
  filled,
  total,
  className,
}: {
  rating: SquadRating;
  side?: 'home' | 'away';
  filled: number;
  total: number;
  className?: string;
}) {
  const accent = side === 'home' ? 'var(--color-home)' : 'var(--color-away)';
  const complete = filled === total;

  return (
    <div className={cn('panel p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="kicker mb-1">Squad rating</p>
          <p className="tnum font-display text-[clamp(2.2rem,7vw,3rem)] leading-none" style={{ color: accent }}>
            {rating.overall.toFixed(1)}
          </p>
        </div>
        <div className="text-right">
          <p className="tnum text-[13px] font-semibold text-[var(--color-ink)]">
            {filled}/{total}
          </p>
          <p className="text-2xs text-[var(--color-ink-faint)]">
            {complete ? 'Eleven named' : 'positions filled'}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <Meter label="Attack" value={rating.attack} accent={accent} />
        <Meter label="Midfield" value={rating.midfield} accent={accent} />
        <Meter label="Defence" value={rating.defence} accent={accent} />
      </div>

      <div className="mt-4 border-t border-[var(--color-line)] pt-3.5">
        <div className="flex items-baseline justify-between">
          <span className="kicker text-[11px]">Chemistry</span>
          <span className="tnum text-[13px] font-bold text-[var(--color-ink)]">{rating.chemistry}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]"
            style={{
              width: `${rating.chemistry}%`,
              background:
                rating.chemistry >= 75
                  ? 'var(--color-home)'
                  : rating.chemistry >= 50
                    ? 'var(--color-gold)'
                    : 'var(--color-danger)',
            }}
          />
        </div>

        {rating.links.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {rating.links.map((link) => (
              <li
                key={link.label}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 text-[10px] text-[var(--color-ink-muted)]"
              >
                <Link2 className="size-3" aria-hidden="true" />
                {link.label}
                <span className="tnum font-semibold text-[var(--color-ink-soft)]">×{link.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2.5 text-[11px] leading-snug text-[var(--color-ink-faint)]">
            No links yet. Players from the same club or country lift chemistry.
          </p>
        )}

        <p className="mt-3 text-[11px] text-[var(--color-ink-faint)]">
          Squad value{' '}
          {filled > 0 && rating.spend === 0 ? (
            // Every pick is a historical version, and those carry no valuation.
            <span className="text-[var(--color-ink-muted)]">not valued (historical cards)</span>
          ) : (
            <span className="tnum text-[var(--color-ink-muted)]">{formatMoney(rating.spend)}</span>
          )}
        </p>
      </div>
    </div>
  );
}
