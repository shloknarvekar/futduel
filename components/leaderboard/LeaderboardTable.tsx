'use client';

import { useMemo, useState } from 'react';
import { Flame, Minus } from 'lucide-react';
import { LADDER, rankFor, type LadderEntry } from '@/lib/data/ladder';
import { TIERS, tierFor } from '@/lib/engine/progression';
import { useProfileStore } from '@/lib/store/profile';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, Panel, Skeleton } from '@/components/ui/primitives';
import { ordinal } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

type Row = LadderEntry & { isYou?: boolean };

export function LeaderboardTable() {
  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);
  const [tierFilter, setTierFilter] = useState<string>('all');

  const rows: Row[] = useMemo(() => {
    const you: Row = {
      id: 'you',
      name: hydrated ? profile.managerName : 'You',
      rating: profile.rating,
      played: profile.stats.played,
      won: profile.stats.won,
      signature: profile.stats.categoriesSeen.length > 0 ? 'Your own path' : 'Yet to spin',
      streak: profile.stats.streak,
      isYou: true,
    };
    return [...LADDER, you].sort((a, b) => b.rating - a.rating);
  }, [profile, hydrated]);

  const filtered = useMemo(() => {
    if (tierFilter === 'all') return rows;
    return rows.filter((row) => tierFor(row.rating).id === tierFilter);
  }, [rows, tierFilter]);

  const yourRank = rankFor(profile.rating);
  const tier = tierFor(profile.rating);

  const options = [
    { value: 'all', label: 'Everyone' },
    ...[...TIERS].reverse().map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="grid gap-5">
      <Panel className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div>
          <p className="kicker mb-1">Your standing</p>
          {hydrated ? (
            <p className="font-display text-[clamp(1.6rem,5vw,2.2rem)] leading-none">
              <span className="tnum" style={{ color: tier.token }}>
                {ordinal(yourRank)}
              </span>{' '}
              <span className="text-[var(--color-ink-faint)]">of {LADDER.length + 1}</span>
            </p>
          ) : (
            <Skeleton className="h-8 w-40" />
          )}
        </div>
        <div className="text-right">
          <p className="kicker mb-1">Rating</p>
          {hydrated ? (
            <p className="tnum font-display text-[clamp(1.6rem,5vw,2.2rem)] leading-none text-[var(--color-ink)]">
              {profile.rating}
            </p>
          ) : (
            <Skeleton className="h-8 w-20" />
          )}
        </div>
      </Panel>

      <Segmented
        label="Filter by tier"
        size="sm"
        options={options}
        value={tierFilter}
        onChange={setTierFilter}
        className="max-w-full"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Nobody in this tier"
          description="No manager in the field currently sits in that band. Try another tier or view everyone."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">
                Manager leaderboard, ordered by rating. Your own row is marked.
              </caption>
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  {['#', 'Manager', 'Tier', 'Rating', 'Played', 'Won', 'Streak'].map((heading, index) => (
                    <th
                      key={heading}
                      scope="col"
                      className={cn(
                        'px-3 py-3 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]',
                        index >= 3 && 'text-right',
                      )}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const rowTier = tierFor(row.rating);
                  const rank = rows.indexOf(row) + 1;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-[var(--color-line)] last:border-b-0 transition-colors',
                        row.isYou
                          ? 'bg-[color-mix(in_oklab,var(--color-home)_6%,transparent)]'
                          : 'hover:bg-[var(--color-surface-2)]',
                      )}
                    >
                      <td className="tnum px-3 py-3 font-mono text-[12px] text-[var(--color-ink-faint)]">
                        {rank}
                      </td>
                      <td className="px-3 py-3">
                        <p
                          className={cn(
                            'truncate text-[13px] font-semibold',
                            row.isYou ? 'text-[var(--color-home)]' : 'text-[var(--color-ink)]',
                          )}
                        >
                          {row.name}
                          {row.isYou ? <span className="ml-2 text-2xs font-normal text-[var(--color-home)]">you</span> : null}
                        </p>
                        <p className="truncate text-2xs text-[var(--color-ink-faint)]">{row.signature}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-2xs font-semibold uppercase tracking-[0.1em]" style={{ color: rowTier.token }}>
                          {rowTier.name}
                        </span>
                      </td>
                      <td className="tnum px-3 py-3 text-right text-[13px] font-bold text-[var(--color-ink)]">
                        {row.rating}
                      </td>
                      <td className="tnum px-3 py-3 text-right text-[13px] text-[var(--color-ink-muted)]">
                        {row.played}
                      </td>
                      <td className="tnum px-3 py-3 text-right text-[13px] text-[var(--color-ink-muted)]">
                        {row.won}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.streak > 0 ? (
                          <span className="tnum inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-gold)]">
                            <Flame className="size-3.5" aria-hidden="true" />
                            {row.streak}
                          </span>
                        ) : (
                          <Minus className="ml-auto size-3.5 text-[var(--color-ink-faint)]" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {row.streak > 0 ? `${row.streak} win streak` : 'no active streak'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--color-ink-faint)]">
        FutDuel keeps no accounts and no server-side records. The field is a fixed, seeded cast of
        managers so your climb means the same thing on every device you play on.
      </p>
    </div>
  );
}
