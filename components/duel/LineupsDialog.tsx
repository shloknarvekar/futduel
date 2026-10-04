'use client';

import { useId, useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import type { Category, Squad } from '@/lib/domain/types';
import { requireFormation } from '@/lib/data/formations';
import { getPlayer } from '@/lib/data/players';
import { clubName } from '@/lib/data/clubs';
import { fitFor } from '@/lib/engine/filters';
import { rateSquad } from '@/lib/engine/rating';
import { CARD_TYPE_LABEL, CARD_TYPE_TOKEN, TIER_TOKEN } from '@/components/players/player-visuals';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { cn } from '@/lib/utils/cn';

export interface LineupSide {
  name: string;
  /** Who is managing this side: "You", "AI manager, Pro", "Your friend". */
  role?: string;
  category: Category;
  /** A locked eleven. Drafts in progress never reach this dialog. */
  squad: Squad;
}

function Lineup({ side, team }: { side: 'home' | 'away'; team: LineupSide }) {
  const headingId = useId();
  const formation = requireFormation(team.squad.formationId);
  const rating = rateSquad(team.squad);
  const accent = side === 'home' ? 'var(--color-home)' : 'var(--color-away)';

  return (
    <section aria-labelledby={headingId}>
      <header className="mb-3 border-b border-[var(--color-line)] pb-3">
        <p className="kicker" style={{ color: accent }}>
          {side === 'home' ? 'Home' : 'Away'}
          {team.role ? ` · ${team.role}` : ''}
        </p>
        <h3 id={headingId} className="mt-1 truncate text-[1.25rem] font-semibold leading-tight text-[var(--color-ink)]">
          {team.name}
        </h3>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          <div className="flex gap-1.5">
            <dt className="text-[var(--color-ink-muted)]">Category</dt>
            <dd className="font-semibold text-[var(--color-ink-soft)]">{team.category.name}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[var(--color-ink-muted)]">Shape</dt>
            <dd className="font-semibold text-[var(--color-ink-soft)]">
              {formation.shape} · {formation.name}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[var(--color-ink-muted)]">Rated</dt>
            <dd className="tnum font-semibold text-[var(--color-ink-soft)]">{rating.overall.toFixed(1)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[var(--color-ink-muted)]">Chem</dt>
            <dd className="tnum font-semibold text-[var(--color-ink-soft)]">{rating.chemistry}</dd>
          </div>
        </dl>
      </header>

      <ol className="grid gap-1.5">
        {formation.slots.map((slot) => {
          const id = team.squad.picks[slot.id];
          const player = id ? getPlayer(id) : undefined;
          if (!player) {
            return (
              <li
                key={slot.id}
                className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 rounded-[4px] border border-dashed border-[var(--color-line)] px-2.5 py-2 text-[12px] text-[var(--color-ink-muted)]"
              >
                <span className="font-mono font-semibold">{slot.role}</span>
                Empty
              </li>
            );
          }
          const fit = fitFor(player, slot.role);
          // Which version of the footballer: the current card, or the season a
          // historical card depicts, with the club he was at then.
          const version =
            player.era === 'current'
              ? `Current · ${clubName(player.clubId)}`
              : `${player.season} · ${clubName(player.clubId)}`;
          return (
            <li
              key={slot.id}
              className="grid grid-cols-[3rem_2.5rem_minmax(0,1fr)] items-center gap-3 rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-2"
            >
              <span className="font-mono text-[12px] font-semibold text-[var(--color-ink-soft)]">{slot.role}</span>
              <span
                className="stat-figure grid size-10 place-items-center border-2 bg-[var(--color-surface-2)] text-[17px] text-[var(--color-ink)]"
                style={{
                  borderColor: player.cardType !== 'standard' ? CARD_TYPE_TOKEN[player.cardType] : TIER_TOKEN[player.tier],
                }}
                aria-label={`Rated ${player.rating}`}
              >
                {player.rating}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-[var(--color-ink)]">{player.name}</span>
                <span className="block truncate text-[11px] text-[var(--color-ink-muted)]">
                  {version}
                  {player.cardType !== 'standard' ? ` · ${CARD_TYPE_LABEL[player.cardType]}` : ''}
                </span>
                {fit !== 'natural' ? (
                  <span
                    className={cn(
                      'mt-0.5 flex items-center gap-1 text-[11px]',
                      fit === 'out-of-position' ? 'text-[var(--color-danger)]' : 'text-[var(--color-warn)]',
                    )}
                  >
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    {fit === 'out-of-position' ? 'Out of position' : 'Unfamiliar role'}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Both elevens, side by side. Offered only once both are locked, from kickoff
 * through the result, so nobody ever sees a squad that is still being built.
 */
export function LineupsButton({
  home,
  away,
  className,
}: {
  home: LineupSide;
  away: LineupSide;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'home' | 'away'>('home');

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        icon={<Users className="size-4" aria-hidden="true" />}
        className={className}
      >
        View lineups
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="xl"
        title="Lineups"
        description={`${home.name} v ${away.name}. Both elevens are locked.`}
      >
        {/* One side at a time on a phone; both at once where there is room. */}
        <div className="mb-4 lg:hidden">
          <Segmented
            label="Show lineup"
            size="sm"
            options={[
              { value: 'home', label: 'Home' },
              { value: 'away', label: 'Away' },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className={cn(view !== 'home' && 'hidden lg:block')}>
            <Lineup side="home" team={home} />
          </div>
          <div className={cn(view !== 'away' && 'hidden lg:block')}>
            <Lineup side="away" team={away} />
          </div>
        </div>
      </Modal>
    </>
  );
}
