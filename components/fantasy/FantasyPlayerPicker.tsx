'use client';

import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { FantasyPosition, SquadPlayer } from '@/lib/football/types';
import { canAdd, SQUAD_RULES, type PlayerRoundScore } from '@/lib/engine/fantasy-scoring';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { cn } from '@/lib/utils/cn';
import { availabilityText } from './fantasy-format';

type PositionFilter = 'ALL' | FantasyPosition;

const FILTERS: { value: PositionFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'GK', label: 'GK' },
  { value: 'DEF', label: 'DEF' },
  { value: 'MID', label: 'MID' },
  { value: 'FWD', label: 'FWD' },
];

const PAGE = 30;

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/**
 * Choose a real squad member for the eleven.
 *
 * There are no prices: FutDuel Fantasy has no budget, so none is shown. The
 * only number beside a player is the points they actually scored in a round
 * already played (or being played), labelled with that round.
 */
export function FantasyPlayerPicker({
  open,
  onClose,
  players,
  squad,
  onAdd,
  reference,
  leagueName,
}: {
  open: boolean;
  onClose: () => void;
  players: readonly SquadPlayer[];
  squad: readonly SquadPlayer[];
  onAdd: (player: SquadPlayer) => void;
  reference: { scores: Record<number, PlayerRoundScore>; label: string } | null;
  leagueName: string;
}) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<PositionFilter>('ALL');
  const [shown, setShown] = useState(PAGE);
  const searchId = useId();
  const countId = useId();

  const matches = useMemo(() => {
    const needle = fold(query.trim());
    const chosen = new Set(squad.map((p) => p.id));
    return players
      .filter((p) => !chosen.has(p.id))
      .filter((p) => position === 'ALL' || p.position === position)
      .filter((p) => !needle || fold(p.name).includes(needle) || fold(p.team.name).includes(needle))
      .sort(
        (a, b) =>
          (reference?.scores[b.id]?.total ?? -Infinity) - (reference?.scores[a.id]?.total ?? -Infinity) ||
          a.name.localeCompare(b.name),
      );
  }, [players, squad, position, query, reference]);

  const remaining = SQUAD_RULES.size - squad.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a player"
      description={`${remaining} of ${SQUAD_RULES.size} places left · real ${leagueName} squads`}
      size="lg"
      tall
    >
      <div className="sticky -top-5 z-10 -mx-5 mb-4 grid gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-5 pb-4 pt-1 sm:-mx-6 sm:px-6">
        <label htmlFor={searchId} className="sr-only">
          Search players or teams
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            maxLength={60}
            autoComplete="off"
            placeholder="Search players or teams"
            aria-describedby={countId}
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PAGE);
            }}
            className="h-11 w-full rounded-[2px] border border-[var(--color-line-strong)] bg-[var(--color-void)] pl-9 pr-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]"
          />
        </div>
        <Segmented
          label="Filter by position"
          size="sm"
          options={FILTERS}
          value={position}
          onChange={(value) => {
            setPosition(value);
            setShown(PAGE);
          }}
          className="w-full"
        />
        <p id={countId} className="text-[12px] text-[var(--color-ink-muted)]" aria-live="polite">
          {matches.length} {matches.length === 1 ? 'player' : 'players'}
          {reference ? ` · most points first, ${reference.label.charAt(0).toLowerCase()}${reference.label.slice(1)}` : ''}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-[var(--color-ink-muted)]">No players match that search.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-px border border-[var(--color-line)] bg-[var(--color-line)]">
          {matches.slice(0, shown).map((player) => {
            const verdict = canAdd(squad, player);
            const status = availabilityText(player);
            const points = reference?.scores[player.id]?.total;
            return (
              <li key={player.id}>
                <button
                  type="button"
                  aria-disabled={!verdict.ok}
                  onClick={() => {
                    if (!verdict.ok) return;
                    onAdd(player);
                    if (squad.length + 1 >= SQUAD_RULES.size) onClose();
                  }}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 bg-[var(--color-surface)] px-3 py-2.5 text-left transition-colors sm:px-4',
                    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-home)]',
                    verdict.ok ? 'cursor-pointer hover:bg-[var(--color-surface-2)]' : 'cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'meta w-9 shrink-0 text-[11px]',
                      verdict.ok ? 'text-[var(--color-ink-soft)]' : 'text-[var(--color-ink-faint)]',
                    )}
                  >
                    {player.position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-[15px] font-semibold',
                        verdict.ok ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]',
                      )}
                    >
                      {player.name}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--color-ink-muted)]">
                      {player.team.name}
                      {player.jerseyNumber !== null ? ` · #${player.jerseyNumber}` : ''}
                      {status ? <span className="text-[var(--color-warn)]"> · {status}</span> : null}
                    </span>
                    {!verdict.ok ? (
                      <span className="block text-[12px] text-[var(--color-ink-soft)]">{verdict.reason}</span>
                    ) : null}
                  </span>
                  {reference ? (
                    <span className="w-10 shrink-0 text-right">
                      <span className="tnum block text-[15px] font-semibold text-[var(--color-ink)]">
                        {points ?? '–'}
                      </span>
                      <span className="sr-only"> points, {reference.label}</span>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {matches.length > shown ? (
        <Button variant="secondary" block className="mt-4" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({matches.length - shown} left)
        </Button>
      ) : null}
    </Modal>
  );
}
