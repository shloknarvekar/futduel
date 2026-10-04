'use client';

import { FastForward, Radio } from 'lucide-react';
import type { Category, Squad, SquadRating } from '@/lib/domain/types';
import { requireFormation } from '@/lib/data/formations';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

export interface SideSummary {
  name: string;
  category: Category;
  squad: Squad;
  rating: SquadRating;
}

function TeamColumn({ side, team }: { side: 'home' | 'away'; team: SideSummary }) {
  const accent = side === 'home' ? 'var(--color-home)' : 'var(--color-away)';
  const formation = requireFormation(team.squad.formationId);

  return (
    <div className={cn('min-w-0', side === 'away' && 'text-right')}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
        {side}
      </p>
      <p className="mt-1.5 truncate text-[clamp(1.05rem,3.2vw,1.5rem)] font-semibold leading-tight text-[var(--color-ink)]">
        {team.name}
      </p>
      <p className="mt-1 truncate text-[12px] text-[var(--color-ink-muted)]">{team.category.name}</p>

      <div className={cn('mt-4 flex items-baseline gap-2', side === 'away' && 'justify-end')}>
        <span
          className="tnum font-display text-[clamp(1.8rem,6vw,2.6rem)] leading-none"
          style={{ color: accent }}
        >
          {team.rating.overall.toFixed(1)}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">
          rated
        </span>
      </div>

      <dl
        className={cn(
          'mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]',
          side === 'away' && 'justify-end',
        )}
      >
        <div className="flex gap-1.5">
          <dt className="text-[var(--color-ink-faint)]">Shape</dt>
          <dd className="tnum font-semibold text-[var(--color-ink-soft)]">{formation.shape}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-[var(--color-ink-faint)]">Chem</dt>
          <dd className="tnum font-semibold text-[var(--color-ink-soft)]">{team.rating.chemistry}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The moment between locking the elevens and the first whistle.
 *
 * Without it the duel jumped from a build screen straight into a scrolling feed,
 * which is why the broadcast went unnoticed — nothing marked it as an event. The
 * ninety minutes are already simulated by the time this renders; Watch live only
 * starts playback of a result that has already been decided.
 */
export function KickoffStage({
  home,
  away,
  onWatch,
  onSkip,
  isReplay,
}: {
  home: SideSummary;
  away: SideSummary;
  onWatch: () => void;
  onSkip: () => void;
  /** True when replaying a friend's finished duel rather than playing a new one. */
  isReplay?: boolean;
}) {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="panel relative overflow-hidden">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background:
              'linear-gradient(90deg, var(--color-home), var(--color-line-strong) 50%, var(--color-away))',
          }}
        />

        <div className="px-5 pt-6 text-center sm:px-8">
          <Badge tone="neutral" className="mx-auto">
            <Radio className="size-3" aria-hidden="true" />
            {isReplay ? 'Replay' : 'Both elevens locked'}
          </Badge>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 px-5 py-7 sm:gap-6 sm:px-8">
          <TeamColumn side="home" team={home} />

          <div className="pt-8 text-center">
            <span className="font-display text-[clamp(1.1rem,4vw,1.6rem)] leading-none text-[var(--color-ink-faint)]">
              V
            </span>
          </div>

          <TeamColumn side="away" team={away} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          block
          onClick={onWatch}
          icon={<Radio className="size-4" aria-hidden="true" />}
          className="motion-safe:animate-[pulse-ring_2.6s_var(--ease-out-soft)_infinite]"
        >
          Watch live
        </Button>
        <Button
          size="lg"
          block
          variant="secondary"
          onClick={onSkip}
          icon={<FastForward className="size-4" aria-hidden="true" />}
        >
          Skip to full time
        </Button>
      </div>

      <p className="text-center text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
        Ninety minutes are simulated from this duel&rsquo;s seed. Watching plays them back minute by
        minute — skipping jumps to the same result.
      </p>
    </div>
  );
}
