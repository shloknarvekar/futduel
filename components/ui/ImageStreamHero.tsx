'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/* ── the corridor ────────────────────────────────────────────────
 * Two rails of cards ride from far behind the screen toward the
 * viewer. Perspective alone does the work that looks like two
 * animations: as a card's z grows it gets bigger *and* its screen x
 * sweeps outward from the vanishing point, because the projection
 * scales position and size by the same factor.
 *
 * Three things shape it, and each one fixes a specific artefact:
 *
 * 1. Depth is authored as *apparent size*, geometrically — each card
 *    is a constant ratio bigger than the one behind it, all the way
 *    out. Spacing a straight z-range evenly instead makes the near
 *    cards tear apart from each other as the projection blows up.
 * 2. The rails open hard in the first stretch and then hold
 *    (`fan` > 1). That opening cancels the — still slow — growth back
 *    there, so the ribbon leaves the centre as a flat band, bends
 *    once, and only then runs out on the diagonal. Parallel rails
 *    project to a straight cone with no bend at all.
 * 3. Neither end of the loop is ever on screen. A card dies with its
 *    inner edge past 50cqw, clear of the container's edge. And it is
 *    born *across* the axis — `railBirth` is negative, so the newest
 *    card starts on the far side and sweeps back through the centre.
 *    That plugs the throat: the axis stays covered at every instant,
 *    and a newborn lands behind cards that already cover it, so it
 *    needs no fade in. Birthing on its own side instead leaves a hole
 *    at dead centre that blinks open once every cycle.
 *
 * Every length is in `cqw` — a percentage of the container's width —
 * so the whole corridor keeps its proportions at any size. The
 * defaults were fitted numerically against a reference recording's
 * card-height and edge-position profile, not eyeballed.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Geometry of the corridor. Every length is `cqw`, a percentage of the
 * container's width, so the shape is resolution-independent.
 *
 * These interact: the ribbon only stays solid while consecutive cards
 * overlap, which needs `exitHeight / birthHeight` spread over enough
 * `cards`. Raising `exitHeight`, dropping `cards`, or pulling `railExit`
 * in all push toward a visible tear near the frame edge.
 *
 * It is not a prop. The values were fitted numerically against a reference
 * profile, there is one corridor in this product, and a caller who changed
 * one of these without the others would tear the ribbon.
 */
type CorridorPath = {
  /** Strength of the projection. Lower is a wider-angle, more dramatic rush. */
  perspective: number;
  /** Card width in world units. */
  cardWidth: number;
  /** Card height in world units. */
  cardHeight: number;
  /** Corner radius applied to each card. */
  cardRadius: number;
  /** On-screen card height at the waist, where a card is born. */
  birthHeight: number;
  /** On-screen card height as a card leaves the frame. */
  exitHeight: number;
  /**
   * Lateral offset at birth. Negative starts the card across the axis so the
   * centre never opens up — see note 3 above.
   */
  railBirth: number;
  /** Lateral offset once the rails have finished opening. */
  railExit: number;
  /** How front-loaded the opening is. >1 opens early then holds. */
  fan: number;
  /** Y-rotation at birth, degrees. */
  turnBirth: number;
  /** Y-rotation at exit, degrees. */
  turnExit: number;
  /** Keyframe stops used to trace the curve. Raise only if motion looks faceted. */
  stops: number;
};

const PATH: CorridorPath = {
  perspective: 30,
  cardWidth: 18,
  cardHeight: 25,
  cardRadius: 0.4,
  birthHeight: 2.6,
  exitHeight: 46,
  railBirth: -11,
  railExit: 44,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 24,
};

/** Sample the path once so the CSS keyframes trace the real curve. */
function keyframes(dir: 1 | -1, name: string, p: CorridorPath) {
  const steps: string[] = [];
  for (let s = 0; s <= p.stops; s++) {
    const u = s / p.stops;
    // Geometric in apparent size, so consecutive cards keep a constant size
    // ratio and the ribbon stays solid at both ends.
    const scale =
      (p.birthHeight / p.cardHeight) *
      Math.pow(p.exitHeight / p.birthHeight, u);
    const z = p.perspective * (1 - 1 / scale);
    const rail =
      p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - u, p.fan);
    const turn = p.turnBirth + (p.turnExit - p.turnBirth) * u;
    steps.push(
      `${(u * 100).toFixed(2)}%{transform:translate3d(${(dir * rail).toFixed(
        2,
      )}cqw,0,${z.toFixed(2)}cqw) rotateY(${(-dir * turn).toFixed(2)}deg)}`,
    );
  }
  return `@keyframes ${name}{${steps.join('')}}`;
}

export type StreamImage = {
  src: string;
  /** Responsive candidates, e.g. from `getImageProps`. */
  srcSet?: string;
  sizes?: string;
  /**
   * CSS `object-position` for this image. Cards are 18:25, so a tall phone
   * shot or a wide landscape loses a lot to the crop; point it at the subject.
   */
  position?: string;
  /**
   * Scale the image inside its card. For a frame where the subject is small
   * and the rest is empty ground, `object-position` alone cannot help.
   * @default 1
   */
  zoom?: number;
  /** Only used if you drop the decorative treatment; the corridor is aria-hidden. */
  alt?: string;
};

export type ImageStreamHeroProps = {
  /**
   * Images cycled onto the rails. With `cards` or fewer, both rails run the
   * same sequence and the corridor reads as one mirrored stream; fewer simply
   * repeat. With more, the rails take opposite halves of the set and every
   * card moves on to the next image each time it passes out of frame, so the
   * whole set is shown instead of the first `cards` of it.
   */
  images: StreamImage[];
  /**
   * Cards on each rail at once. More cards means a denser corridor, not a
   * faster one — spacing is derived from this and `speed`. Drop it far below
   * the default and consecutive cards grow too fast to stay overlapped near
   * the exit, which tears a gap in the ribbon.
   * @default 9
   */
  cards?: number;
  /**
   * Seconds for one card to travel the whole corridor.
   * @default 18
   */
  speed?: number;
  /**
   * Vertical placement of the corridor's axis, as a percentage of height.
   * @default 55
   */
  axis?: number;
  /** Content rendered above the corridor. */
  children?: React.ReactNode;
  className?: string;
};

export function ImageStreamHero({
  images,
  cards = 9,
  speed = 18,
  axis = 55,
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & ImageStreamHeroProps) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const right = `ish-r-${id}`;
  const left = `ish-l-${id}`;
  const card = `ish-c-${id}`;

  const count = images.length;
  // Only a set larger than one rail needs to travel; below that the original
  // mirrored, repeating stream is kept exactly.
  const cycles = count > cards;
  const leftOffset = cycles ? Math.floor(count / 2) : 0;

  // A card swaps image while it is reborn behind the others, so the next
  // image should already be in the cache by then. A paused corridor never
  // swaps, so it never needs them — but it starts swapping the moment the
  // motion preference is turned off, so that is listened for rather than
  // read once at mount.
  React.useEffect(() => {
    if (!cycles) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warmed = false;

    const warm = () => {
      warmed = true;
      for (const img of images) {
        const pre = new Image();
        pre.decoding = 'async';
        if (img.sizes) pre.sizes = img.sizes;
        if (img.srcSet) pre.srcset = img.srcSet;
        pre.src = img.src;
      }
    };

    const schedule = () => {
      if (warmed || media.matches) return;
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(warm, { timeout: 4000 });
      else timer = setTimeout(warm, 1500);
    };

    schedule();
    media.addEventListener('change', schedule);
    return () => {
      media.removeEventListener('change', schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [cycles, images]);

  const css = React.useMemo(
    () =>
      `${keyframes(1, right, PATH)}${keyframes(-1, left, PATH)}` +
      // Pausing rather than disabling keeps the corridor whole: every card is
      // already dropped mid-flight by its negative delay, so it freezes as a
      // finished still instead of collapsing onto the axis.
      // !important because each card's inline `animation` shorthand resets
      // play-state to running, and an inline style outranks this rule.
      `@media(prefers-reduced-motion:reduce){.${card}{animation-play-state:paused!important}}`,
    [right, left, card],
  );

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      // FutDuel's global reduced-motion rule cuts every animation to nothing
      // unless it is marked essential. This one handles reduced motion itself
      // (it pauses mid-flight, above), so it opts out of the blanket rule.
      data-motion="essential"
      {...props}
      style={{ containerType: 'inline-size', ...props.style }}
    >
      <style>{css}</style>

      <div
        aria-hidden
        className='pointer-events-none absolute inset-0'
        style={{
          perspective: `${PATH.perspective}cqw`,
          perspectiveOrigin: `50% ${axis}%`,
        }}
      >
        <div
          className='absolute inset-0'
          style={{ transformStyle: 'preserve-3d' }}
        >
          {[right, left].map((name, rail) =>
            Array.from({ length: cards }, (_, i) => (
              <StreamCard
                key={`${name}-${i}`}
                images={images}
                // The highest index is furthest along, so it takes the head of
                // the sequence; each rebirth continues where the back left off.
                start={(cycles ? (rail === 1 ? leftOffset : 0) + cards - 1 - i : i)}
                step={cycles ? cards : 0}
                lead={i >= cards - 2}
                className={cn(card, 'absolute overflow-hidden')}
                style={{
                  // A neutral plate, so the corridor has its geometry before it
                  // has its photographs.
                  backgroundColor: 'rgb(128 128 128 / 0.14)',
                  left: '50%',
                  top: `${axis}%`,
                  width: `${PATH.cardWidth}cqw`,
                  height: `${PATH.cardHeight}cqw`,
                  marginLeft: `${-PATH.cardWidth / 2}cqw`,
                  marginTop: `${-PATH.cardHeight / 2}cqw`,
                  borderRadius: `${PATH.cardRadius}cqw`,
                  animation: `${name} ${speed}s linear infinite`,
                  // Negative delay drops each card mid-flight, so the
                  // corridor is already full on the first frame.
                  animationDelay: `${-(i * speed) / cards}s`,
                  backfaceVisibility: 'hidden',
                }}
              />
            )),
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

/**
 * One card on a rail. Each `animationiteration` is the moment the card leaves
 * the frame and is reborn at the waist behind the cards already there, so
 * changing its image then is never seen. The old image stays up until the new
 * one has loaded, and the swap re-renders this card alone.
 */
function StreamCard({
  images,
  start,
  step,
  lead,
  className,
  style,
}: {
  images: StreamImage[];
  start: number;
  /** How far along the sequence each lap moves. 0 keeps one image for good. */
  step: number;
  /** Near the exit, so it is one of the largest cards on the first frame. */
  lead: boolean;
  className: string;
  style: React.CSSProperties;
}) {
  const [lap, setLap] = React.useState(0);
  const count = images.length;
  const img = count > 0 ? images[(start + lap * step) % count] : undefined;

  return (
    <div
      className={className}
      style={style}
      onAnimationIteration={step > 0 ? () => setLap((n) => n + 1) : undefined}
    >
      {img ? (
        <img
          src={img.src}
          srcSet={img.srcSet}
          sizes={img.sizes}
          alt={img.alt ?? ''}
          // The biggest cards are most of what the first frame is; the rest of
          // the corridor can arrive behind them.
          loading={lead ? 'eager' : 'lazy'}
          fetchPriority={lead ? 'high' : undefined}
          decoding="async"
          className='h-full w-full object-cover'
          style={{
            objectPosition: img.position,
            scale: img.zoom && img.zoom !== 1 ? String(img.zoom) : undefined,
          }}
          draggable={false}
        />
      ) : null}
    </div>
  );
}
