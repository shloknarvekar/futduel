'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { Eraser, Lightbulb, Search, Wand2 } from 'lucide-react';
import type { Category, Player, Squad } from '@/lib/domain/types';
import { FORMATIONS, requireFormation } from '@/lib/data/formations';
import { poolFor } from '@/lib/engine/filters';
import { emptySquad, isSquadComplete, rateSquad } from '@/lib/engine/rating';
import { draftSquad } from '@/lib/engine/ai-manager';
import { MOVE_PROBLEM_TEXT, applyMove, moveProblem, pickProblem, type BuildAssistance } from '@/lib/engine/picker';
import { getPlayer } from '@/lib/data/players';
import { useProfileStore } from '@/lib/store/profile';
import { PitchBoard } from '@/components/duel/PitchBoard';
import { PlayerPicker, type MoveTarget } from '@/components/duel/PlayerPicker';
import { SquadStrength } from '@/components/duel/SquadStrength';
import { CategoryCard } from '@/components/duel/CategoryCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/Segmented';
import { cn } from '@/lib/utils/cn';

const ASSISTANCE: { id: BuildAssistance; name: string; blurb: string; icon: typeof Lightbulb }[] = [
  { id: 'guided', name: 'Guided', blurb: 'Get recommendations for each position.', icon: Lightbulb },
  { id: 'manual', name: 'Manual', blurb: 'Find the players yourself. No suggestions.', icon: Search },
];

export function BuildStage({
  side,
  managerName,
  category,
  squad,
  onChange,
  onConfirm,
  confirmLabel,
  seed,
  assistance = 'guided',
  onAssistanceChange,
}: {
  side: 'home' | 'away';
  managerName: string;
  category: Category;
  squad: Squad;
  onChange: (squad: Squad) => void;
  onConfirm: () => void;
  confirmLabel: string;
  seed: string;
  /** How much help the builder gives. Never changes who may be picked. */
  assistance?: BuildAssistance;
  onAssistanceChange?: (assistance: BuildAssistance) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  // What the last move did, tied to the squad it produced so it disappears
  // as soon as the eleven changes some other way.
  const [moveNotice, setMoveNotice] = useState<{ squad: Squad; text: string; refused: boolean } | null>(null);
  const quickBuildOn = useProfileStore((state) => state.profile.settings.quickBuild);
  const assistanceName = useId();
  const accent = side === 'home' ? 'var(--color-home)' : 'var(--color-away)';

  const formation = requireFormation(squad.formationId);
  const pool = useMemo(() => poolFor(category), [category]);
  const eligibleIds = useMemo(() => new Set(pool.map((p) => p.id)), [pool]);
  const rating = useMemo(() => rateSquad(squad), [squad]);

  const filled = formation.slots.filter((slot) => squad.picks[slot.id]).length;
  const complete = isSquadComplete(squad);
  const takenIds = useMemo(
    () => new Set(Object.values(squad.picks).filter((id): id is string => Boolean(id))),
    [squad.picks],
  );

  const slot = activeSlot ? formation.slots.find((s) => s.id === activeSlot) ?? null : null;

  // The one rule on what a slot accepts, in either assistance mode: eligible
  // under the category, and not a footballer who already plays elsewhere in
  // the eleven in any version.
  const problemFor = useCallback(
    (player: Player) => (slot ? pickProblem(player, { squad, slotId: slot.id, eligibleIds }) : 'unknown-slot'),
    [slot, squad, eligibleIds],
  );

  /** Changing shape keeps whoever still fits the new slot in the same order. */
  const changeFormation = (formationId: string) => {
    const next = emptySquad(formationId);
    const nextFormation = requireFormation(formationId);
    const carried = formation.slots
      .map((s) => squad.picks[s.id])
      .filter((id): id is string => Boolean(id));

    const used = new Set<string>();
    for (const target of nextFormation.slots) {
      const match = carried.find((id) => {
        if (used.has(id)) return false;
        const player = pool.find((p) => p.id === id);
        if (!player) return false;
        if (target.role === 'GK') return player.position === 'GK';
        return player.position !== 'GK' && player.roles.includes(target.role);
      });
      if (match) {
        next.picks[target.id] = match;
        used.add(match);
      }
    }
    onChange(next);
  };

  const quickBuild = () => {
    onChange(draftSquad(category, 'pro', `${seed}:quick:${side}:${Date.now()}`));
  };

  // Moving players around the eleven. Drag and drop and the picker's "move
  // to" buttons both come through `moveProblem`, so a move can never do what
  // a pick could not. Manual or Guided makes no difference here: a move only
  // rearranges players already chosen, so it recommends no one.
  const moveProblemFor = useCallback(
    (from: string, to: string) => {
      const problem = moveProblem(squad, from, to, eligibleIds);
      return problem ? MOVE_PROBLEM_TEXT[problem] : null;
    },
    [squad, eligibleIds],
  );

  const roleLabel = useCallback(
    (slotId: string) => {
      const target = formation.slots.find((s) => s.id === slotId);
      if (!target) return slotId;
      // Two CBs read the same; say which one.
      if (formation.slots.filter((s) => s.role === target.role).length < 2) return target.role;
      return `${target.x < 45 ? 'Left' : target.x > 55 ? 'Right' : 'Centre'} ${target.role}`;
    },
    [formation.slots],
  );

  const movePlayer = (from: string, to: string) => {
    const problem = moveProblem(squad, from, to, eligibleIds);
    if (problem) {
      setMoveNotice({ squad, text: `${MOVE_PROBLEM_TEXT[problem]} Nothing moved.`, refused: true });
      return;
    }
    const mover = getPlayer(squad.picks[from] ?? '');
    const displacedId = squad.picks[to];
    const displaced = displacedId ? getPlayer(displacedId) : undefined;
    const next = applyMove(squad, from, to, eligibleIds);
    setMoveNotice({
      squad: next,
      text: displaced
        ? `Swapped ${mover?.short} to ${roleLabel(to)} and ${displaced.short} to ${roleLabel(from)}.`
        : `Moved ${mover?.short} to ${roleLabel(to)}.`,
      refused: false,
    });
    onChange(next);
  };

  const notice = moveNotice && moveNotice.squad === squad ? moveNotice : null;

  const moveTargets = useMemo<MoveTarget[]>(() => {
    if (!slot || !squad.picks[slot.id]) return [];
    return formation.slots
      .filter((s) => s.id !== slot.id)
      .map((s) => {
        const occupantId = squad.picks[s.id];
        return {
          slotId: s.id,
          label: roleLabel(s.id),
          occupant: occupantId ? (getPlayer(occupantId)?.short ?? null) : null,
          problem: moveProblemFor(slot.id, s.id),
        };
      });
  }, [slot, squad.picks, formation.slots, roleLabel, moveProblemFor]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-8">
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="kicker mb-1.5"
              style={{ color: side === 'home' ? 'var(--color-home)' : 'var(--color-away)' }}
            >
              {managerName} · {category.name}
            </p>
            <h2 className="text-[clamp(1.6rem,4.5vw,2.3rem)]">Name your eleven</h2>
          </div>

          <div className="flex gap-2">
            {/* Quick build picks the whole eleven for you, so Manual withholds it,
                and the Quick Build setting on the profile page can hide it too. */}
            {assistance === 'guided' && quickBuildOn ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={quickBuild}
                icon={<Wand2 className="size-4" aria-hidden="true" />}
              >
                Quick build
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(emptySquad(squad.formationId))}
              disabled={filled === 0}
              icon={<Eraser className="size-4" aria-hidden="true" />}
            >
              Clear
            </Button>
          </div>
        </div>

        {onAssistanceChange ? (
          <fieldset className="mb-5" style={{ '--side-accent': accent } as React.CSSProperties}>
            <legend className="kicker mb-2.5">Build assistance</legend>
            <div className="grid grid-cols-2 gap-2">
              {ASSISTANCE.map((option) => {
                const active = assistance === option.id;
                const Icon = option.icon;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'relative flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[4px] border p-3 transition-colors duration-150 sm:gap-3 sm:p-3.5',
                      // The focus ring wears the manager's colour, like the selection.
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--side-accent)]',
                      active
                        ? 'bg-[var(--color-surface-2)]'
                        : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-2)]',
                    )}
                    style={active ? { borderColor: accent } : undefined}
                  >
                    <input
                      type="radio"
                      name={assistanceName}
                      value={option.id}
                      checked={active}
                      onChange={() => onAssistanceChange(option.id)}
                      className="sr-only"
                    />
                    <Icon
                      className="mt-px size-4 shrink-0"
                      style={{ color: active ? accent : 'var(--color-ink-muted)' }}
                      aria-hidden="true"
                    />
                    <span className="grid min-w-0 gap-1">
                      <span className="font-display text-[17px] uppercase leading-none text-[var(--color-ink)]">
                        {option.name}
                      </span>
                      <span className="text-[12px] leading-snug text-[var(--color-ink-soft)]">{option.blurb}</span>
                    </span>
                    {/* A filled ring, not just a colour, marks the rule in force. */}
                    <span
                      aria-hidden="true"
                      className="ml-auto mt-px grid size-4 shrink-0 place-items-center rounded-full border"
                      style={{ borderColor: active ? accent : 'var(--color-line-strong)' }}
                    >
                      {active ? <span className="size-2 rounded-full" style={{ background: accent }} /> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="mb-4">
          <Segmented
            label="Formation"
            size="sm"
            options={FORMATIONS.map((f) => ({ value: f.id, label: f.shape, shortLabel: f.shape }))}
            value={squad.formationId}
            onChange={changeFormation}
            // Eleven shapes do not fit one row on a phone; wrapping keeps
            // every one in sight instead of scrolled off the edge.
            className="w-full flex-wrap"
          />
          <p className="mt-2 text-[12px] text-[var(--color-ink-muted)]">
            {formation.name} — {formation.bias.attack >= 1.02 ? 'attack-leaning' : formation.bias.defence >= 1.04 ? 'defence-leaning' : 'balanced'} shape.
          </p>
        </div>

        <PitchBoard
          squad={squad}
          side={side}
          activeSlotId={activeSlot}
          onSlotSelect={setActiveSlot}
          onMove={movePlayer}
          moveProblemFor={moveProblemFor}
        />

        <div role="status" aria-live="polite">
          {notice ? (
            <p
              className={cn(
                'mt-3 text-[13px] font-semibold',
                notice.refused ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-soft)]',
              )}
            >
              {notice.text}
            </p>
          ) : null}
        </div>

        <p className="mt-3 text-[12px] text-[var(--color-ink-muted)]">
          {assistance === 'manual'
            ? 'Tap a position, then search for the player you want. '
            : 'Tap a position to fill it. '}
          Drag a player onto another position to move them, or onto a team-mate to swap. Players outside their
          natural role still play, but they cost you rating and chemistry.
        </p>
      </div>

      <div className="grid content-start gap-4 lg:sticky lg:top-24">
        <SquadStrength rating={rating} side={side} filled={filled} total={formation.slots.length} />
        <CategoryCard
          category={category}
          side={side}
          compact
          animate={false}
          tags={
            assistance === 'manual' ? (
              <Badge tone={side === 'home' ? 'home' : 'away'}>
                <Search className="size-3" aria-hidden="true" />
                Manual build
              </Badge>
            ) : null
          }
        />

        <div className="grid gap-2">
          <Button
            size="lg"
            variant={side === 'home' ? 'primary' : 'ice'}
            block
            disabled={!complete}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          {complete ? (
            <p className="text-center text-[12px] text-[var(--color-home)]" role="status">
              Eleven named. Nothing left to pick.
            </p>
          ) : (
            <div role="status">
              <p className="mb-2 text-center text-[12px] text-[var(--color-ink-muted)]">
                {formation.slots.length - filled} still to fill
              </p>
              {/* Naming the empty roles beats a bare count: it says what to go
                  and do, and doubles as a shortcut straight to that slot. */}
              <ul className="flex flex-wrap justify-center gap-1.5">
                {formation.slots
                  .filter((s) => !squad.picks[s.id])
                  .map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSlot(s.id)}
                        aria-label={`Fill the ${s.role} position`}
                        className={cn(
                          'h-8 cursor-pointer rounded-full border border-dashed border-[var(--color-line-strong)] px-2.5',
                          'font-mono text-[11px] font-semibold text-[var(--color-ink-muted)] transition-colors',
                          'hover:border-[var(--color-home)] hover:text-[var(--color-home)]',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]',
                        )}
                      >
                        {s.role}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {slot ? (
        <PlayerPicker
          open={Boolean(slot)}
          onClose={() => setActiveSlot(null)}
          pool={pool}
          slotRole={slot.role}
          slotLabel={slot.role}
          takenIds={takenIds}
          problemFor={problemFor}
          currentId={squad.picks[slot.id] ?? null}
          categoryName={category.name}
          assistance={assistance}
          side={side}
          onPick={(player) => {
            // Enforced here as well as in the picker: nothing reaches the
            // squad that the rule would refuse.
            if (problemFor(player)) return;
            onChange({ ...squad, picks: { ...squad.picks, [slot.id]: player.id } });
          }}
          onClear={() => onChange({ ...squad, picks: { ...squad.picks, [slot.id]: null } })}
          moveTargets={moveTargets}
          onMoveTo={(to) => movePlayer(slot.id, to)}
        />
      ) : null}
    </div>
  );
}
