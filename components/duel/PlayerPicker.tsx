'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Check, ChevronDown, Search, X } from 'lucide-react';
import type { Player, SlotRole } from '@/lib/domain/types';
import { fitFor } from '@/lib/engine/filters';
import { MANUAL_MIN_SEARCH, pickerResults, type BuildAssistance, type PickProblem } from '@/lib/engine/picker';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/primitives';
import { PlayerCard } from '@/components/players/PlayerCard';
import { cn } from '@/lib/utils/cn';

const POSITIONS = [
  { value: 'ALL' as const, label: 'All' },
  { value: 'GK' as const, label: 'GK' },
  { value: 'DEF' as const, label: 'DEF' },
  { value: 'MID' as const, label: 'MID' },
  { value: 'FWD' as const, label: 'FWD' },
];

const PAGE = 40;

/** Another position the player in this slot could move to: drag and drop's keyboard and tap equivalent. */
export interface MoveTarget {
  slotId: string;
  /** "LB", or "Left CB" where the formation has more than one of a role. */
  label: string;
  /** Who is there now, and so would swap, or null when the slot is empty. */
  occupant: string | null;
  /** Why the move is refused, or null when it is allowed. */
  problem: string | null;
}

export function PlayerPicker({
  open,
  onClose,
  pool,
  slotRole,
  slotLabel,
  takenIds,
  problemFor,
  currentId,
  onPick,
  onClear,
  categoryName,
  assistance = 'guided',
  side = 'home',
  moveTargets = [],
  onMoveTo,
}: {
  open: boolean;
  onClose: () => void;
  pool: Player[];
  slotRole: SlotRole;
  slotLabel: string;
  takenIds: Set<string>;
  /** Why a player cannot go in this slot, or null. The builder's one rule, shared by both modes. */
  problemFor: (player: Player) => PickProblem | null;
  currentId: string | null;
  onPick: (player: Player) => void;
  onClear: () => void;
  categoryName: string;
  /** Guided lists recommendations; Manual lists nothing until the manager searches. */
  assistance?: BuildAssistance;
  /** The manager picking, so the selected card wears their colour. */
  side?: 'home' | 'away';
  /** Where the player already in this slot may move, when there is one. */
  moveTargets?: MoveTarget[];
  onMoveTo?: (slotId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<(typeof POSITIONS)[number]['value']>('ALL');
  const [limit, setLimit] = useState(PAGE);
  const deferredSearch = useDeferredValue(search);
  const manual = assistance === 'manual';

  const isUnavailable = useCallback((player: Player) => problemFor(player) !== null, [problemFor]);

  const { players: results, awaitingSearch } = useMemo(
    () => pickerResults(pool, { assistance, search: deferredSearch, position, role: slotRole, isUnavailable }),
    [pool, assistance, deferredSearch, position, slotRole, isUnavailable],
  );

  const visible = results.slice(0, limit);
  const available = useMemo(() => results.filter((p) => !isUnavailable(p)).length, [results, isUnavailable]);
  // Manual does not list anyone up front, so its headline counts the category
  // rather than a list the manager has not asked for yet.
  const eligible = useMemo(() => pool.filter((p) => !isUnavailable(p)).length, [pool, isUnavailable]);
  const alreadyIn = pool.length - eligible;
  const typed = deferredSearch.trim().length;
  const lettersLeft = Math.max(0, MANUAL_MIN_SEARCH - typed);
  const lettersLeftLabel = `${lettersLeft} more letter${lettersLeft === 1 ? '' : 's'}`;
  const sideColor = side === 'away' ? 'var(--color-away)' : 'var(--color-home)';

  const handlePick = (player: Player) => {
    if (problemFor(player)) return;
    onPick(player);
    onClose();
  };

  // Moving the player already here: the same moves drag and drop offers,
  // as buttons, so a keyboard, a switch or a tap can do everything a drag can.
  const current = currentId ? pool.find((p) => p.id === currentId) : undefined;
  const allowedMoves = moveTargets.filter((target) => !target.problem);
  const refusedMoves = [...new Set(moveTargets.flatMap((target) => (target.problem ? [target.problem] : [])))];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Fill ${slotLabel}`}
      description={
        manual
          ? `${categoryName}: ${eligible} ${eligible === 1 ? 'player' : 'players'} available${
              alreadyIn > 0 ? `, ${alreadyIn} already in your eleven` : ''
            }. Manual build, no suggestions.`
          :`${categoryName}: ${available} ${available === 1 ? 'player' : 'players'} available${
              results.length > available ? `, ${results.length - available} already in your eleven` : ''
            }`
      }
      tall
      footer={
        currentId ? (
          <Button
            variant="secondary"
            block
            icon={<X className="size-4" aria-hidden="true" />}
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            Clear this position
          </Button>
        ) : null
      }
    >
      {current && onMoveTo && moveTargets.length > 0 ? (
        <details
          className="group mb-4 rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface-2)]"
          style={{ '--side-accent': sideColor } as React.CSSProperties}
        >
          <summary
            className={cn(
              'flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-[4px] px-3.5 text-[13px] font-semibold text-[var(--color-ink)]',
              '[&::-webkit-details-marker]:hidden',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--side-accent)]',
            )}
          >
            <ArrowLeftRight className="size-4 shrink-0" style={{ color: sideColor }} aria-hidden="true" />
            <span className="min-w-0 truncate">Move {current.short} to another position</span>
            <ChevronDown
              className="ml-auto size-4 shrink-0 text-[var(--color-ink-muted)] transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-[var(--color-line)] px-3.5 py-3">
            {allowedMoves.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {allowedMoves.map((target) => (
                  <li key={target.slotId}>
                    <button
                      type="button"
                      onClick={() => {
                        onMoveTo(target.slotId);
                        onClose();
                      }}
                      aria-label={
                        target.occupant
                          ? `Swap ${current.short} with ${target.occupant} at ${target.label}`
                          : `Move ${current.short} to ${target.label}, which is empty`
                      }
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3',
                        'transition-colors duration-150 hover:border-[var(--side-accent)]',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--side-accent)]',
                      )}
                    >
                      <span className="font-mono text-[12px] font-semibold text-[var(--color-ink)]">{target.label}</span>
                      <span className="text-[12px] text-[var(--color-ink-soft)]">
                        {target.occupant ? `swap with ${target.occupant}` : 'empty'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {refusedMoves.length > 0 ? (
              <p className={cn('text-[12px] leading-snug text-[var(--color-ink-muted)]', allowedMoves.length > 0 && 'mt-2.5')}>
                {refusedMoves.join(' ')}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="sticky -top-5 z-10 -mx-5 mb-4 space-y-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-5 pb-4 pt-1 sm:-mx-6 sm:px-6">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-faint)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(PAGE);
            }}
            placeholder={manual ? 'Name the player you want' : 'Player, club or country'}
            aria-label="Search eligible players"
            // In Manual the search is how anyone gets listed at all, so the
            // sheet opens on it rather than on its close button.
            data-autofocus={manual ? '' : undefined}
            style={{ '--side-accent': sideColor } as React.CSSProperties}
            className="h-12 w-full rounded-[4px] border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] pl-10 pr-3 text-base text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--side-accent)]"
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {awaitingSearch
            ? typed > 0
              ? `Type ${lettersLeftLabel} to search`
              : ''
            : `${results.length} ${results.length === 1 ? 'player matches' : 'players match'}`}
        </p>

        <Segmented
          label="Filter by position"
          size="sm"
          options={POSITIONS}
          value={position}
          onChange={(value) => {
            setPosition(value);
            setLimit(PAGE);
          }}
          className="w-full sm:w-auto"
        />
      </div>

      {awaitingSearch ? (
        <div className="grid justify-items-center gap-2 border border-dashed border-[var(--color-line-strong)] px-5 py-10 text-center">
          <Search className="size-5 text-[var(--color-ink-muted)]" aria-hidden="true" />
          <p className="font-display text-xl uppercase leading-none text-[var(--color-ink)]">
            {typed > 0 ? lettersLeftLabel : 'Start typing'}
          </p>
          <p className="max-w-[40ch] text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
            Type a name. Manual searches footballers, not squads, and answers with the closest few — anyone the
            category allows can be picked.
          </p>
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="Nobody matches"
          description={
            manual
              ? 'No footballer in this category matches that name closely enough. Try more of the name, or check the spelling.'
              : 'No eligible player fits that search under this category. Try clearing the filter or searching a different club.'
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('');
                setPosition('ALL');
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          {/* minmax(0, 1fr): an auto grid column would grow to the rows' content
              and push their stats past the edge of a phone-width sheet. */}
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {visible.map((player) => {
              const fit = fitFor(player, slotRole);
              const taken = isUnavailable(player);
              return (
                <li key={player.id}>
                  <PlayerCard
                    player={player}
                    onSelect={handlePick}
                    disabled={taken}
                    selected={player.id === currentId}
                    side={side}
                    meta={
                      taken ? (
                        <span className="text-[var(--color-ink-soft)]">
                          {takenIds.has(player.id)
                            ? 'Already in your eleven'
                            : 'Another version of this player is in your eleven'}
                        </span>
                      ) : fit === 'out-of-position' ? (
                        <span className="flex items-center gap-1.5 text-[var(--color-danger)]">
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          Out of position: −12 rating, chemistry penalty
                        </span>
                      ) : fit === 'adjacent' ? (
                        <span className="flex items-center gap-1.5 text-[var(--color-warn)]">
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          Unfamiliar role: −4 rating
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5" style={{ color: sideColor }}>
                          <Check className="size-3.5" aria-hidden="true" />
                          Natural {slotRole}
                        </span>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>

          {results.length > visible.length ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                Show {Math.min(PAGE, results.length - visible.length)} more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}
