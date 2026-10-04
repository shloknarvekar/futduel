'use client';

import { useId } from 'react';
import { Wand2 } from 'lucide-react';
import { useProfileStore } from '@/lib/store/profile';
import { Panel, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

/**
 * Settings that change how FutDuel plays in this browser. They live on the
 * local profile beside everything else, so "Reset everything" resets them too.
 */
export function ProfileSettings() {
  const quickBuild = useProfileStore((s) => s.profile.settings.quickBuild);
  const hydrated = useProfileStore((s) => s.hydrated);
  const setQuickBuild = useProfileStore((s) => s.setQuickBuild);
  const labelId = useId();
  const descriptionId = useId();

  if (!hydrated) return <Skeleton className="h-28 w-full" />;

  return (
    <Panel className="flex items-start gap-4 p-5">
      <Wand2 className="mt-0.5 size-5 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-[15px] font-semibold text-[var(--color-ink)]">
          Quick Build
        </p>
        <p id={descriptionId} className="mt-1 max-w-[58ch] text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
          Offers a Quick build button in Guided builds, which names a whole eleven in one tap. Turn it
          off to pick every player yourself. Manual builds never offer it.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span aria-hidden="true" className="meta w-7 text-right text-[11px] text-[var(--color-ink-soft)]">
          {quickBuild ? 'On' : 'Off'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={quickBuild}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          onClick={() => setQuickBuild(!quickBuild)}
          className={cn(
            'grid h-11 cursor-pointer place-items-center rounded-full px-1',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]',
          )}
        >
          <span
            className={cn(
              'relative block h-7 w-12 rounded-full border transition-colors duration-150 motion-reduce:transition-none',
              quickBuild
                ? 'border-transparent bg-primary'
                : 'border-[var(--color-line-strong)] bg-[var(--color-surface-3)]',
            )}
          >
            <span
              className={cn(
                'absolute top-1/2 size-5 -translate-y-1/2 rounded-full transition-[left] duration-150 motion-reduce:transition-none',
                quickBuild ? 'left-[calc(100%-1.375rem)] bg-primary-foreground' : 'left-[3px] bg-[var(--color-ink-muted)]',
              )}
            />
          </span>
        </button>
      </div>
    </Panel>
  );
}
