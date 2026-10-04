import { cn } from '@/lib/utils/cn';

/**
 * The mark is a pitch split down the middle: two opposing halves, lime against
 * ice, with the centre circle as the contested ground. It reads at 20px and at
 * 200px, which is the only real test a mark has to pass.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--color-surface-3)" stroke="var(--color-line-strong)" />
      <path d="M16 4v24" stroke="var(--color-line-strong)" strokeWidth="1" />
      <path d="M7 8h9v16H7a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z" fill="var(--color-home)" opacity="0.92" />
      <path d="M25 8h-9v16h9a3 3 0 0 0 3-3V11a3 3 0 0 0-3-3Z" fill="var(--color-away)" opacity="0.5" />
      <circle cx="16" cy="16" r="4.5" fill="var(--color-void)" />
      <circle cx="16" cy="16" r="4.5" stroke="var(--color-ink)" strokeWidth="1.2" fill="none" opacity="0.9" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-[19px] leading-none tracking-[0.01em] text-[var(--color-ink)]">
        FUT<span className="text-[var(--color-home)]">DUEL</span>
      </span>
    </span>
  );
}
