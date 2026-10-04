'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const STEPS = ['Spin', 'Build', 'Duel'] as const;

export function DuelStepper({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Duel progress">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex items-center gap-2 sm:gap-3">
            <span
              className={cn(
                'flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors',
                active
                  ? 'border-[var(--color-home)] bg-[color-mix(in_oklab,var(--color-home)_8%,transparent)] text-[var(--color-home)]'
                  : done
                    ? 'border-[var(--color-line-strong)] text-[var(--color-ink-soft)]'
                    : 'border-[var(--color-line)] text-[var(--color-ink-faint)]',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <span className="tnum font-mono">{index + 1}</span>
              )}
              {step}
            </span>
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn('h-px w-4 sm:w-8', done ? 'bg-[var(--color-line-strong)]' : 'bg-[var(--color-line)]')}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
