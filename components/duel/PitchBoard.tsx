'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Plus } from 'lucide-react';
import type { Player, Squad } from '@/lib/domain/types';
import { requireFormation } from '@/lib/data/formations';
import { getPlayer } from '@/lib/data/players';
import { fitFor } from '@/lib/engine/filters';
import { CARD_TYPE_TOKEN, TIER_TOKEN } from '@/components/players/player-visuals';
import { cn } from '@/lib/utils/cn';

const SIDE_ACCENT = {
  home: 'var(--color-home)',
  away: 'var(--color-away)',
} as const;

/** How far a press on a player travels before it becomes a drag rather than a tap. */
const DRAG_THRESHOLD = 6;

/** Room the carried player needs above the pointer, in pixels, before it flips below. */
const GHOST_CLEARANCE = 150;

interface PlacedPlayer {
  slotId: string;
  role: string;
  player: Player;
  x: number;
  y: number;
}

/** A drawn connection between two team-mates who share a club or a country. */
interface ChemLink {
  key: string;
  from: PlacedPlayer;
  to: PlacedPlayer;
  kind: 'club' | 'nation';
}

/**
 * Chemistry links, shown rather than described.
 *
 * The rating panel already reports a chemistry score, but a number cannot tell
 * you *where* a side is connected. Drawing the links onto the pitch turns squad
 * building into a spatial problem: you can see the spine that holds together
 * and the winger stranded on his own.
 *
 * Only links between players who are close enough to read are drawn, otherwise
 * an eleven from one club becomes a ball of string.
 */
function chemistryLinks(placed: PlacedPlayer[]): ChemLink[] {
  const links: ChemLink[] = [];

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!;
      const b = placed[j]!;
      const sameClub = a.player.clubId === b.player.clubId;
      const sameNation = !sameClub && a.player.nation === b.player.nation;
      if (!sameClub && !sameNation) continue;

      // Distance in pitch percentage units. Long links across the whole pitch
      // add noise without adding meaning.
      const dx = a.x - b.x;
      const dy = (a.y - b.y) * 0.86;
      if (Math.hypot(dx, dy) > 46) continue;

      links.push({
        key: `${a.slotId}-${b.slotId}`,
        from: a,
        to: b,
        kind: sameClub ? 'club' : 'nation',
      });
    }
  }
  return links;
}

interface Press {
  from: string;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

interface DragState {
  from: string;
  /** Pointer position inside the pitch, in pixels. */
  x: number;
  y: number;
  over: string | null;
}

/** The slot under a screen point, found through the `data-slot-id` on each slot. */
const slotAt = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot-id]')?.dataset.slotId ?? null;

/**
 * The pitch.
 *
 * Slot coordinates come straight from the formation definition, so the shape is
 * identical at 320px and at 1440px — it scales, it never reflows into a
 * different formation. The token geometry is mirrored in
 * `lib/engine/pitch-layout.ts`, which checks every formation for overlaps.
 *
 * With `onMove`, a filled slot can be dragged with a mouse, a pen or a finger:
 * onto an empty slot to move the player, onto a team-mate to swap them. It is
 * plain pointer events, no library. Nobody leaves the pitch until a drop
 * lands, a drop the rules refuse changes nothing, and a press that does not
 * travel is still an ordinary tap that opens the picker, where the same moves
 * are offered as buttons for keyboards and switch access.
 */
export function PitchBoard({
  squad,
  side = 'home',
  onSlotSelect,
  activeSlotId,
  readOnly,
  showLinks = true,
  className,
  onMove,
  moveProblemFor,
}: {
  squad: Squad;
  side?: 'home' | 'away';
  onSlotSelect?: (slotId: string) => void;
  activeSlotId?: string | null;
  readOnly?: boolean;
  /** Draw chemistry links between connected team-mates. */
  showLinks?: boolean;
  className?: string;
  /** Drag a player to another slot. The caller decides whether the move stands. */
  onMove?: (fromSlotId: string, toSlotId: string) => void;
  /** Why a drop would be refused, so the target can say so before the drop. */
  moveProblemFor?: (fromSlotId: string, toSlotId: string) => string | null;
}) {
  const formation = requireFormation(squad.formationId);
  const accent = SIDE_ACCENT[side];
  const pitchRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<Press | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const draggable = Boolean(onMove) && !readOnly && Boolean(onSlotSelect);

  const placed = useMemo<PlacedPlayer[]>(() => {
    const out: PlacedPlayer[] = [];
    for (const slot of formation.slots) {
      const id = squad.picks[slot.id];
      const player = id ? getPlayer(id) : undefined;
      if (player) out.push({ slotId: slot.id, role: slot.role, player, x: slot.x, y: slot.y });
    }
    return out;
  }, [formation.slots, squad.picks]);

  // Links hide while a player is carried; they would point at where he was.
  const dragging = drag !== null;
  const links = useMemo(() => (showLinks && !dragging ? chemistryLinks(placed) : []), [placed, showLinks, dragging]);

  const endDrag = () => {
    pressRef.current = null;
    setDrag(null);
  };

  // Escape puts the player back where he was.
  useEffect(() => {
    if (!dragging) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      suppressClickRef.current = true;
      pressRef.current = null;
      setDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging]);

  const pressStart = (slotId: string, filled: boolean) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    suppressClickRef.current = false;
    if (!draggable || !filled || event.button !== 0 || !event.isPrimary) return;
    pressRef.current = { from: slotId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
  };

  const pressMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    if (!press.dragging) {
      if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < DRAG_THRESHOLD) return;
      press.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      from: press.from,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      over: slotAt(event.clientX, event.clientY),
    });
  };

  const pressEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    if (press.dragging) {
      // The click that follows a drag is not a tap on the slot.
      suppressClickRef.current = true;
      const to = slotAt(event.clientX, event.clientY);
      if (to && to !== press.from) onMove?.(press.from, to);
    }
    endDrag();
  };

  const carried = drag ? placed.find((p) => p.slotId === drag.from) : undefined;
  const target = drag && drag.over && drag.over !== drag.from ? drag.over : null;
  const dropProblem = drag && target ? (moveProblemFor?.(drag.from, target) ?? null) : null;

  // Convert a slot coordinate into the same space the tokens are laid out in.
  const px = (x: number) => x;
  const py = (y: number) => 100 - (y * 0.86 + 4);

  return (
    <div
      ref={pitchRef}
      className={cn(
        'pitch-turf relative w-full overflow-hidden border border-[var(--color-line-strong)]',
        'aspect-[3/4] sm:aspect-[4/4.2]',
        drag && 'select-none',
        className,
      )}
    >
      {/* Pitch markings */}
      <svg
        viewBox="0 0 100 130"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 size-full text-[rgba(242,247,243,0.16)]"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="96" height="126" fill="none" stroke="currentColor" strokeWidth="0.45" />
        <line x1="2" y1="65" x2="98" y2="65" stroke="currentColor" strokeWidth="0.45" />
        <circle cx="50" cy="65" r="13" fill="none" stroke="currentColor" strokeWidth="0.45" />
        <circle cx="50" cy="65" r="0.9" fill="currentColor" />
        <rect x="26" y="2" width="48" height="18" fill="none" stroke="currentColor" strokeWidth="0.45" />
        <rect x="38" y="2" width="24" height="7" fill="none" stroke="currentColor" strokeWidth="0.45" />
        <rect x="26" y="110" width="48" height="18" fill="none" stroke="currentColor" strokeWidth="0.45" />
        <rect x="38" y="121" width="24" height="7" fill="none" stroke="currentColor" strokeWidth="0.45" />
      </svg>

      {/* Chemistry links, drawn beneath the tokens */}
      {links.length > 0 ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden="true"
        >
          {links.map((link) => (
            <line
              key={link.key}
              x1={px(link.from.x)}
              y1={py(link.from.y)}
              x2={px(link.to.x)}
              y2={py(link.to.y)}
              stroke={link.kind === 'club' ? accent : 'rgba(242,247,243,0.4)'}
              strokeWidth={link.kind === 'club' ? 0.5 : 0.3}
              strokeDasharray={link.kind === 'nation' ? '1.4 1.6' : undefined}
              vectorEffect="non-scaling-stroke"
              opacity={link.kind === 'club' ? 0.75 : 0.5}
            />
          ))}
        </svg>
      ) : null}

      <ul className="absolute inset-0 list-none">
        {formation.slots.map((slot) => {
          const playerId = squad.picks[slot.id];
          const player = playerId ? getPlayer(playerId) : undefined;
          const active = activeSlotId === slot.id;
          const fit = player ? fitFor(player, slot.role) : null;
          const outOfPosition = fit === 'out-of-position';
          const isSource = drag?.from === slot.id;
          const isTarget = target === slot.id;
          const targetColour = isTarget ? (dropProblem ? 'var(--color-danger)' : accent) : null;

          const token = (
            <>
              <span
                className={cn(
                  'relative grid size-[clamp(40px,11vw,56px)] place-items-center border-2 transition-all duration-200',
                  player ? 'bg-[rgba(4,10,7,0.92)]' : 'border-dashed bg-[rgba(4,10,7,0.6)]',
                  isSource && 'opacity-40',
                )}
                style={{
                  borderColor: targetColour
                    ? targetColour
                    : player
                      ? outOfPosition
                        ? 'var(--color-danger)'
                        : player.cardType !== 'standard'
                          ? CARD_TYPE_TOKEN[player.cardType]
                          : TIER_TOKEN[player.tier]
                      : active
                        ? accent
                        : 'rgba(242,247,243,0.3)',
                  boxShadow: targetColour
                    ? `0 0 0 4px color-mix(in oklab, ${targetColour} 45%, transparent)`
                    : active
                      ? `0 0 0 3px color-mix(in oklab, ${accent} 38%, transparent)`
                      : player
                        ? '0 8px 20px -12px rgb(0 0 0 / 0.95)'
                        : undefined,
                }}
              >
                {player ? (
                  <span
                    className="stat-figure text-[clamp(15px,3.8vw,20px)]"
                    style={{ color: TIER_TOKEN[player.tier] }}
                  >
                    {player.rating}
                  </span>
                ) : (
                  <Plus className="size-4 text-[rgba(242,247,243,0.5)]" aria-hidden="true" />
                )}
              </span>

              <span className="mt-1.5 block max-w-[10ch] truncate text-center text-[11px] font-semibold leading-tight text-[var(--color-ink)]">
                {player ? player.short : slot.role}
              </span>
              {/* An empty slot already shows its role on the line above. */}
              {player ? (
                <span className="meta block text-center text-[11px] leading-tight text-[var(--color-ink-muted)]">
                  {slot.role}
                </span>
              ) : null}
            </>
          );

          return (
            <li
              key={slot.id}
              data-slot-id={slot.id}
              className="absolute -translate-x-1/2"
              style={{ left: `${slot.x}%`, bottom: `${slot.y * 0.86 + 4}%` }}
            >
              {readOnly || !onSlotSelect ? (
                <div className="flex w-[clamp(54px,13vw,68px)] flex-col items-center">{token}</div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    onSlotSelect(slot.id);
                  }}
                  onPointerDown={pressStart(slot.id, Boolean(player))}
                  onPointerMove={pressMove}
                  onPointerUp={pressEnd}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={(event) => {
                    // A touch starts captured by the token inside the button;
                    // moving capture to the button fires this on that token and
                    // it bubbles here. Only the button losing it ends a drag.
                    if (event.target === event.currentTarget && pressRef.current?.dragging) endDrag();
                  }}
                  aria-label={
                    player
                      ? `${slot.role}: ${player.name}, rated ${player.rating}. ${draggable ? 'Change or move player.' : 'Change player.'}`
                      : `${slot.role} is empty. Choose a player.`
                  }
                  className={cn(
                    'flex w-[clamp(54px,13vw,68px)] cursor-pointer flex-col items-center py-1',
                    // A filled slot owns its touch gestures so a finger can drag
                    // it; everywhere else on the pitch still scrolls the page.
                    draggable && player ? '[touch-action:none] cursor-grab active:cursor-grabbing' : '[touch-action:manipulation]',
                    'transition-transform duration-150',
                    'hover:scale-[1.07] active:scale-[0.97] motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]',
                  )}
                >
                  {token}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* The player being carried. The original stays on the pitch, dimmed,
          until the drop lands, so nobody vanishes mid-drag. It rides just
          above the pointer, clear of a fingertip and of the target's outline,
          and drops below it near the top edge so it is never cut off. */}
      {drag && carried ? (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-20 flex -translate-x-1/2 flex-col items-center',
            drag.y > GHOST_CLEARANCE ? '-translate-y-[calc(100%+18px)]' : 'translate-y-[26px]',
          )}
          style={{ left: drag.x, top: drag.y }}
        >
          <span
            className="grid size-[clamp(44px,12vw,60px)] place-items-center border-2 bg-[rgba(4,10,7,0.96)] shadow-[0_14px_30px_-10px_rgb(0_0_0/0.9)]"
            style={{ borderColor: accent }}
          >
            <span className="stat-figure text-[clamp(16px,4vw,22px)]" style={{ color: TIER_TOKEN[carried.player.tier] }}>
              {carried.player.rating}
            </span>
          </span>
          <span className="mt-1 max-w-[12ch] truncate bg-[rgba(4,10,7,0.88)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-ink)]">
            {carried.player.short}
          </span>
          {dropProblem ? (
            <span className="mt-1 w-max max-w-[24ch] bg-[var(--color-danger)] px-1.5 py-0.5 text-center text-[11px] font-semibold leading-tight text-white">
              {dropProblem}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Formation stamp, bottom corner, like a tactical board */}
      <span className="meta pointer-events-none absolute bottom-2 right-3 text-[10px] text-[rgba(242,247,243,0.35)]">
        {formation.shape}
      </span>
    </div>
  );
}
