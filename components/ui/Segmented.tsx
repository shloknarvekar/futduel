'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional short label used below 480px. */
  shortLabel?: string;
}

/**
 * A radio group that looks like a switch. Implemented with real radio inputs so
 * arrow keys, labels and screen readers all behave the way people expect.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[2px] border border-[var(--color-line)] bg-[var(--color-surface)] p-1',
        className,
      )}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const active = option.value === value;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              'meta relative flex cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-[2px]',
              'transition-colors duration-150',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-home)]',
              // The small size stays 36px to look at; its hit area reaches into
              // the track's padding so the target is still 44px.
              size === 'sm'
                ? "h-9 min-w-11 px-3 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']"
                : 'h-11 px-4 text-[13px]',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-ink)]',
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className={option.shortLabel ? 'hidden sm:inline' : undefined}>{option.label}</span>
            {option.shortLabel ? <span className="sm:hidden">{option.shortLabel}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
