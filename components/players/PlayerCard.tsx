'use client';

import { forwardRef, useCallback, useId, useRef } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { Crown, Layers, Medal } from 'lucide-react';
import type { Attributes, Player } from '@/lib/domain/types';
import { CLUB_BY_ID } from '@/lib/data/clubs';
import { versionsOf } from '@/lib/data/players';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/format';
import { CardArt } from './CardArt';
import { CARD_TYPE_LABEL, POSITION_TOKEN, attributeLabels, attributeTone } from './player-visuals';

const ATTRIBUTE_KEYS: (keyof Attributes)[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];

/** The three numbers that matter most for a position, for narrow rows. */
const KEY_ATTRIBUTES: Record<Player['position'], (keyof Attributes)[]> = {
  GK: ['pace', 'defending', 'shooting'],
  DEF: ['defending', 'physical', 'pace'],
  MID: ['passing', 'dribbling', 'shooting'],
  FWD: ['shooting', 'pace', 'dribbling'],
};

const POSITION_NAME: Record<Player['position'], string> = {
  GK: 'goalkeeper',
  DEF: 'defender',
  MID: 'midfielder',
  FWD: 'forward',
};

export function NationChip({ code, nation }: { code: string; nation: string }) {
  return (
    <span
      className="tnum rounded-[3px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-1.5 py-0.5 font-[family-name:var(--font-condensed)] text-[11px] font-bold leading-none tracking-[0.06em] text-[var(--color-ink-soft)]"
      title={nation}
    >
      {code}
    </span>
  );
}

export function PositionChip({
  position,
  className,
}: {
  position: Player['position'];
  className?: string;
}) {
  return (
    <span
      className={cn(
        'meta inline-grid h-5 min-w-[2.2rem] place-items-center rounded-[3px] px-1 text-[11px] font-bold',
        className,
      )}
      style={{
        background: `color-mix(in oklab, ${POSITION_TOKEN[position]} 16%, transparent)`,
        color: POSITION_TOKEN[position],
      }}
    >
      {position}
    </span>
  );
}

/**
 * The Icon or Hero badge. Always a word plus a drawn mark, so the status never
 * depends on telling gold from silver. Standard cards carry no badge unless one
 * is asked for, where the absence of status is itself the information.
 */
export function CardTypeTag({
  type,
  size = 'card',
  showStandard = false,
  className,
}: {
  type: Player['cardType'];
  size?: 'card' | 'row' | 'detail';
  showStandard?: boolean;
  className?: string;
}) {
  if (type === 'standard' && !showStandard) return null;
  const Mark = type === 'icon' ? Crown : type === 'hero' ? Medal : null;

  if (size === 'card') {
    return (
      <span className={cn('fd-card__type', className)}>
        {Mark ? <Mark aria-hidden="true" strokeWidth={2.4} /> : null}
        {CARD_TYPE_LABEL[type]}
      </span>
    );
  }

  const tone =
    type === 'icon'
      ? 'bg-[linear-gradient(150deg,var(--color-icon-bright),var(--color-icon)_55%,var(--color-icon-deep))] text-[#120c02]'
      : type === 'hero'
        ? 'bg-[linear-gradient(150deg,var(--color-hero-bright),var(--color-hero)_55%,var(--color-hero-deep))] text-[#0d1418]'
        : 'border border-[var(--color-line-strong)] text-[var(--color-ink-soft)]';

  return (
    <span
      className={cn(
        'meta inline-flex shrink-0 items-center gap-1 rounded-[3px] font-bold leading-none tracking-[0.12em]',
        size === 'row' ? 'h-5 px-1.5 text-[11px]' : 'h-7 px-2.5 text-[13px]',
        tone,
        className,
      )}
    >
      {Mark ? (
        <Mark className={size === 'row' ? 'size-3' : 'size-3.5'} aria-hidden="true" strokeWidth={2.4} />
      ) : null}
      {type === 'standard' ? 'Standard card' : CARD_TYPE_LABEL[type]}
    </span>
  );
}

/**
 * What a card is, in the order a person says it: who, which version, what kind
 * of card, how good, where they play. Screen readers get this instead of the
 * visual scatter of chips, which repeated the club three times.
 */
function describePlayer(player: Player, versions = versionsOf(player.identityId).length): string {
  const version = player.era === 'legend' ? `${player.season} ${player.club}` : `${player.club}, ${player.season} squad`;
  const type = player.cardType === 'standard' ? '' : ` ${CARD_TYPE_LABEL[player.cardType]} card.`;
  const others = versions > 1 ? ` ${versions} versions of this player: open to see them all.` : '';
  return `${player.name}, ${version}.${type} Rated ${player.rating}, ${player.roles[0] ?? POSITION_NAME[player.position]}, ${player.nation}.${others}`;
}

/* -------------------------------------------------------------------------- */
/* Tilt                                                                       */
/* -------------------------------------------------------------------------- */

let reducedMotionQuery: MediaQueryList | null = null;
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  reducedMotionQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)');
  return reducedMotionQuery.matches;
}

/**
 * A card leans toward a fine pointer and catches the light where it rests.
 * Values are written straight to custom properties in one frame, so hovering a
 * grid never re-renders React. Touch and reduced motion get no tilt at all.
 */
function useTilt(enabled: boolean) {
  const frame = useRef(0);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.pointerType !== 'mouse' || prefersReducedMotion()) return;
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        el.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
      });
    },
    [enabled],
  );

  const onPointerLeave = useCallback((event: PointerEvent<HTMLElement>) => {
    cancelAnimationFrame(frame.current);
    const el = event.currentTarget;
    for (const prop of ['--mx', '--my', '--rx', '--ry']) el.style.removeProperty(prop);
  }, []);

  return enabled ? { onPointerMove, onPointerLeave } : {};
}

/* -------------------------------------------------------------------------- */
/* Collectible card                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The collectible: a portrait card for the collection grid, the Discover
 * showcase and the detail view.
 *
 * Interactive when `onSelect` is given, and then a real button whose name is a
 * sentence rather than a pile of chips. Without it the card is a picture of
 * information stated elsewhere on the page, so it is hidden from assistive tech.
 */
export const CollectibleCard = forwardRef<
  HTMLButtonElement,
  {
    player: Player;
    onSelect?: (player: Player) => void;
    className?: string;
    style?: CSSProperties;
    tilt?: boolean;
  }
>(function CollectibleCard({ player, onSelect, className, style, tilt = true }, ref) {
  const versions = versionsOf(player.identityId).length;
  const club = CLUB_BY_ID.get(player.clubId);
  const labels = attributeLabels(player);
  const legend = player.era === 'legend';
  const tiltHandlers = useTilt(tilt);

  const face = (
    <>
      {versions > 1 ? <span className="fd-card__stack" aria-hidden="true" /> : null}
      <span className="fd-card__frame" aria-hidden="true">
        <span className="fd-card__art">
          <CardArt player={player} />
        </span>

        <span className="fd-card__head">
          <span className="fd-card__rating">{player.rating}</span>
          <span className="fd-card__pos" style={{ color: POSITION_TOKEN[player.position] }}>
            {player.roles[0] ?? player.position}
          </span>
          <span className="fd-card__head-rule" />
          <span className="fd-card__code">{player.nationCode}</span>
          <span className="fd-card__code">{club?.short ?? ''}</span>
        </span>

        <span className="fd-card__marks">
          <CardTypeTag type={player.cardType} />
          {legend ? <span className="fd-card__season">{player.season}</span> : null}
        </span>

        <span className="fd-card__body">
          <span className="fd-card__name">{player.name}</span>
          <span className="fd-card__sub">
            <span>{player.club}</span>
            {versions > 1 ? (
              <span className="fd-card__versions">
                <Layers aria-hidden="true" strokeWidth={2.2} />
                {versions} versions
              </span>
            ) : null}
          </span>
          <span className="fd-card__rule" />
          <span className="fd-card__stats">
            {ATTRIBUTE_KEYS.map((key) => (
              <span key={key} className="fd-stat">
                <span className="fd-stat__value" style={{ color: attributeTone(player.attributes[key]) }}>
                  {player.attributes[key]}
                </span>
                <span className="fd-stat__label">{labels.short[key]}</span>
              </span>
            ))}
          </span>
        </span>

        <span className="fd-card__shine" />
      </span>
    </>
  );

  const shared = {
    className: cn('fd-card', className),
    style,
    'data-type': player.cardType,
    'data-era': player.era,
  };

  if (!onSelect) {
    return (
      <span {...shared} aria-hidden="true" {...tiltHandlers}>
        {face}
      </span>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      {...shared}
      data-interactive=""
      aria-label={describePlayer(player, versions)}
      onClick={() => onSelect(player)}
      {...tiltHandlers}
    >
      {face}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Row card                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The list form of the same card, for choosing under pressure in the duel
 * picker. It keeps the collectible's material (art, frame, badge, season) at a
 * size that scans, and never drops to a bare name on a phone: the three
 * attributes that matter for the position stay visible at every width.
 *
 * Unavailable rows stay focusable (`aria-disabled`) so the reason they are
 * unavailable can be reached and read, not just seen at half opacity.
 */
export function PlayerCard({
  player,
  onSelect,
  selected,
  disabled,
  meta,
  compact,
  side = 'home',
}: {
  player: Player;
  onSelect?: (player: Player) => void;
  selected?: boolean;
  disabled?: boolean;
  /** Slot-specific note, e.g. an out-of-position warning. */
  meta?: ReactNode;
  /** Show only the position's key attributes, at every width. */
  compact?: boolean;
  /** Which manager is picking, so selection wears their colour. */
  side?: 'home' | 'away';
}) {
  const labels = attributeLabels(player);
  const interactive = Boolean(onSelect);
  const legend = player.era === 'legend';
  const metaId = useId();
  const sideColor = side === 'away' ? 'var(--color-away)' : 'var(--color-home)';

  const content = (
    <>
      <span className="fd-row__art relative block h-[76px] w-[58px] shrink-0 overflow-hidden rounded-[3px] border border-[var(--accent)] bg-[var(--color-surface-3)]">
        <CardArt player={player} className="absolute inset-0 size-full" showNumber={false} />
        {/* On a phone the card type and season ride on the thumbnail, so the
            name keeps the whole first line. The shape of the mark (crown or
            medal) carries the type, not its colour. */}
        {player.cardType !== 'standard' || legend ? (
          <span className="absolute inset-x-0 top-0 flex h-[18px] items-center justify-center gap-1 bg-[rgb(3_6_5/0.82)] font-[family-name:var(--font-condensed)] text-[11px] font-bold leading-none text-[var(--color-ink)] sm:hidden">
            {player.cardType === 'icon' ? (
              <Crown className="size-3 text-[var(--color-icon-bright)]" aria-hidden="true" strokeWidth={2.4} />
            ) : player.cardType === 'hero' ? (
              <Medal className="size-3 text-[var(--color-hero-bright)]" aria-hidden="true" strokeWidth={2.4} />
            ) : null}
            {legend ? <span className="tnum">{player.season.slice(2)}</span> : null}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-8 bg-[linear-gradient(180deg,transparent,rgb(3_6_5/0.85))]"
        />
        <span className="stat-figure absolute bottom-1 left-1.5 text-[22px] text-[var(--color-ink)] [text-shadow:0_1px_6px_rgb(0_0_0/0.8)]">
          {player.rating}
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <PositionChip position={player.position} className="hidden sm:inline-grid" />
          <span className="min-w-0 truncate font-[family-name:var(--font-condensed)] text-[17px] font-bold uppercase leading-none tracking-[0.02em] text-[var(--color-ink)]">
            {player.name}
          </span>
          <CardTypeTag type={player.cardType} size="row" className="fd-row__tag hidden sm:inline-flex" />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] leading-tight text-[var(--color-ink-soft)]">
          <NationChip code={player.nationCode} nation={player.nation} />
          <span className="min-w-0 truncate">{player.club}</span>
          {legend ? (
            <span className="meta hidden shrink-0 rounded-[3px] border border-[var(--accent)] px-1.5 py-0.5 text-[11px] leading-none text-[var(--color-ink)] sm:inline">
              {player.season}
            </span>
          ) : (
            <span className="tnum shrink-0 text-[var(--color-ink-muted)]">{formatMoney(player.value)}</span>
          )}
        </span>
        {meta ? (
          <span id={metaId} className="text-[12px] leading-tight">
            {meta}
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-center gap-1.5 self-center sm:gap-2.5 sm:pl-1">
        {ATTRIBUTE_KEYS.map((key) => {
          const essential = KEY_ATTRIBUTES[player.position].includes(key);
          return (
            <span
              key={key}
              className={cn(
                'w-7 flex-col items-center gap-1 sm:w-8',
                compact ? (essential ? 'flex' : 'hidden') : essential ? 'flex' : 'hidden sm:flex',
              )}
            >
              <span
                className="tnum font-[family-name:var(--font-condensed)] text-[16px] font-bold leading-none"
                style={{ color: attributeTone(player.attributes[key]) }}
              >
                {player.attributes[key]}
              </span>
              <span className="meta text-[11px] leading-none text-[var(--color-ink-muted)]">{labels.short[key]}</span>
            </span>
          );
        })}
      </span>
    </>
  );

  const className = cn(
    'fd-row group relative flex w-full min-w-0 items-stretch gap-2.5 overflow-hidden rounded-[4px] border p-2 pr-2.5 text-left sm:gap-3 sm:pr-3',
    'bg-[linear-gradient(90deg,var(--row-tint),transparent_65%),var(--color-surface)]',
    'transition-[border-color,background-color,transform,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
    interactive &&
      !disabled &&
      'cursor-pointer hover:-translate-y-px hover:bg-[linear-gradient(90deg,var(--row-tint),transparent_65%),var(--color-surface-2)] hover:shadow-[0_12px_28px_-20px_rgb(0_0_0/0.95)] motion-reduce:hover:translate-y-0',
    interactive && '[touch-action:manipulation]',
    // Unavailable: the art and numbers recede, the words (including why) stay legible.
    disabled &&
      'cursor-not-allowed [&>span:first-child]:opacity-40 [&>span:first-child]:grayscale [&>span:last-child]:opacity-40 [&_.fd-row__tag]:opacity-40',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
  );

  const style: CSSProperties = {
    borderColor: selected ? sideColor : 'var(--accent)',
    boxShadow: selected ? `0 0 0 1px ${sideColor}` : undefined,
    outlineColor: sideColor,
  };

  if (!interactive) {
    return (
      <article className={className} style={style} data-type={player.cardType} data-era={player.era}>
        <span className="sr-only">{describePlayer(player)}</span>
        <span aria-hidden="true" className="contents">
          {content}
        </span>
      </article>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      data-type={player.cardType}
      data-era={player.era}
      aria-label={describePlayer(player)}
      aria-describedby={meta ? metaId : undefined}
      aria-disabled={disabled || undefined}
      aria-current={selected || undefined}
      onClick={() => {
        if (!disabled) onSelect?.(player);
      }}
    >
      {content}
    </button>
  );
}
