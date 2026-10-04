'use client';

import Link from 'next/link';
import { ArrowRight, CircleCheck, Flame } from 'lucide-react';
import type { Challenge } from '@/lib/domain/types';
import { CATEGORY_BY_ID, RARITY_META } from '@/lib/data/categories';
import { DIFFICULTY_LABEL } from '@/lib/data/challenges';
import { coverageFor } from '@/lib/engine/filters';
import { useProfileStore } from '@/lib/store/profile';
import { Badge, Panel } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

const DIFFICULTY_TONE = {
  amateur: 'neutral',
  pro: 'away',
  elite: 'gold',
} as const;

export function ChallengeBoard({ challenges }: { challenges: Challenge[] }) {
  const completed = useProfileStore((s) => s.profile.completedChallenges);
  const hydrated = useProfileStore((s) => s.hydrated);

  const done = challenges.filter((c) => completed.includes(c.id)).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-ink-muted)]" role="status" aria-live="polite">
          {hydrated ? (
            <>
              <span className="tnum font-semibold text-[var(--color-ink)]">{done}</span> of{' '}
              <span className="tnum">{challenges.length}</span> cleared this week
            </>
          ) : (
            'Loading your progress'
          )}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {challenges.map((challenge) => {
          const category = CATEGORY_BY_ID.get(challenge.categoryId);
          if (!category) return null;
          const isDone = hydrated && completed.includes(challenge.id);
          const coverage = coverageFor(category);

          return (
            <li key={challenge.id}>
              <Panel
                className={cn(
                  'relative h-full overflow-hidden transition-colors',
                  isDone && 'border-[color-mix(in_oklab,var(--color-home)_35%,var(--color-line))]',
                )}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{
                    background: isDone
                      ? 'var(--color-home)'
                      : `linear-gradient(90deg, ${RARITY_META[category.rarity].token}, transparent 75%)`,
                  }}
                />

                <div className="flex h-full flex-col p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone={DIFFICULTY_TONE[challenge.difficulty]}>
                      <Flame className="size-3" aria-hidden="true" />
                      {DIFFICULTY_LABEL[challenge.difficulty]}
                    </Badge>
                    <span className="tnum text-2xs text-[var(--color-ink-faint)]">
                      +{challenge.reward} rating
                    </span>
                    {isDone ? (
                      <span className="ml-auto inline-flex items-center gap-1.5 text-2xs font-semibold text-[var(--color-home)]">
                        <CircleCheck className="size-3.5" aria-hidden="true" />
                        Cleared
                      </span>
                    ) : null}
                  </div>

                  <h3 className="text-xl leading-tight">{challenge.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {challenge.brief}
                  </p>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <dt className="kicker text-[9px]">Your category</dt>
                      <dd className="mt-1 truncate font-semibold text-[var(--color-ink)]">{category.name}</dd>
                    </div>
                    <div>
                      <dt className="kicker text-[9px]">Eligible players</dt>
                      <dd className="tnum mt-1 font-semibold text-[var(--color-ink)]">{coverage.total}</dd>
                    </div>
                  </dl>

                  <Link
                    href={`/duel?challenge=${encodeURIComponent(challenge.id)}`}
                    className={cn(
                      'mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]',
                      isDone
                        ? 'border border-[var(--color-line-strong)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-3)]'
                        : 'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,white)]',
                    )}
                  >
                    {isDone ? 'Play it again' : 'Take it on'}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
