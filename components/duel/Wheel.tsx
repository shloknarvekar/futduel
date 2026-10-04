'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Category } from '@/lib/domain/types';
import { RARITY_META } from '@/lib/data/categories';
import { SPIN_MS_FULL } from '@/lib/engine/spin-timing';
import type { WheelPhase } from '@/components/duel/useWheelSpin';
import { cn } from '@/lib/utils/cn';

const SIZE = 200;
const C = SIZE / 2;

/* Radii, outside in. The rim carries a rarity band and the pegs the marker
   ticks against; labels run from just inside the band towards the centre
   circle, which is drawn as the pitch marking it is. */
const R_RIM = 99;
const R_BAND_OUT = 97;
const R_BAND_IN = 91.5;
const R_GLYPH = 87;
const R_LABEL = 82.5;
const R_PITCH = 25;

/**
 * Geometry is rounded to three decimals before it reaches the DOM. Trigonometry
 * can land on a different last bit in Node than in the browser, and an SVG
 * attribute that differs by 1e-14 is still a hydration mismatch.
 */
const round = (n: number) => Math.round(n * 1000) / 1000;
const mod360 = (n: number) => ((n % 360) + 360) % 360;

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: round(C + radius * Math.cos(rad)), y: round(C + radius * Math.sin(rad)) };
}

function wedgePath(start: number, end: number, radius: number) {
  const a = polar(start, radius);
  const b = polar(end, radius);
  return `M ${C} ${C} L ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y} Z`;
}

function bandPath(start: number, end: number, inner: number, outer: number) {
  const a = polar(start, outer);
  const b = polar(end, outer);
  const c = polar(end, inner);
  const d = polar(start, inner);
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 0 0 ${d.x} ${d.y} Z`;
}

/* Rarity is carried three ways at once — band material, a glyph, and label
   ink — so it never depends on telling two colours apart. */
const BAND: Record<Category['rarity'], string> = {
  standard: 'rgba(255,255,255,0.07)',
  rare: 'rgba(233,240,244,0.30)',
  legendary: 'foil',
};
const TINT: Record<Category['rarity'], string | null> = {
  standard: null,
  rare: null,
  legendary: 'rgba(255,194,75,0.05)',
};
/* Labels stay close to white so the face reads as print, not a carnival.
   Rare takes a cold cast and Legendary a warm one; the glyph and the band
   do the real separating. */
const INK: Record<Category['rarity'], { rest: string; lit: string }> = {
  standard: { rest: '#b3b5bd', lit: '#f6f7fa' },
  rare: { rest: '#cdd2de', lit: '#eef1f8' },
  legendary: { rest: '#e2c68f', lit: '#ffe2a6' },
};

function Glyph({ rarity }: { rarity: Category['rarity'] }) {
  if (rarity === 'legendary') return <path d="M0 -2.5 L1.9 0 L0 2.5 L-1.9 0 Z" fill="#ffc24b" />;
  if (rarity === 'rare') return <circle r="1.3" fill="#e9f0f4" />;
  return <rect x="-0.3" y="-1.5" width="0.6" height="3" fill="rgba(255,255,255,0.34)" />;
}

/**
 * The printed face of the rotor. Rendered twice while the wheel is at speed:
 * once crisp, once through a blur, and the two are cross-faded so labels smear
 * instead of strobing. Only opacity changes during the spin, so neither layer
 * repaints while the compositor turns them.
 */
function Face({
  segments,
  landedIndex,
  foilId,
  baseId,
  blurred = false,
}: {
  segments: Category[];
  landedIndex: number | null;
  foilId: string;
  baseId: string;
  blurred?: boolean;
}) {
  const step = 360 / segments.length;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full" aria-hidden="true" focusable="false">
      {blurred ? null : (
        <defs>
          <radialGradient id={baseId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1c1d24" />
            <stop offset="62%" stopColor="#121318" />
            <stop offset="100%" stopColor="#0b0b0f" />
          </radialGradient>
          <linearGradient id={foilId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe2a6" />
            <stop offset="38%" stopColor="#ffc24b" />
            <stop offset="62%" stopColor="#a8701d" />
            <stop offset="100%" stopColor="#ffd47a" />
          </linearGradient>
        </defs>
      )}

      <circle cx={C} cy={C} r={R_RIM} fill={`url(#${baseId})`} />

      {segments.map((segment, index) => {
        const start = index * step;
        const end = start + step;
        const mid = start + step / 2;
        const landed = landedIndex === index;
        const dimmed = landedIndex != null && !landed;
        const band = BAND[segment.rarity];
        const tint = TINT[segment.rarity];

        return (
          <g key={segment.id} className="fd-wheel__seg" data-dim={dimmed || undefined}>
            {index % 2 === 1 ? <path d={wedgePath(start, end, R_BAND_IN)} fill="rgba(255,255,255,0.022)" /> : null}
            {tint ? <path d={wedgePath(start, end, R_BAND_IN)} fill={tint} /> : null}
            {landed ? <path d={wedgePath(start, end, R_BAND_IN)} fill="rgba(255,255,255,0.07)" /> : null}
            <path
              d={bandPath(start, end, R_BAND_IN, R_BAND_OUT)}
              fill={band === 'foil' ? `url(#${foilId})` : band}
              fillOpacity={band === 'foil' ? 0.72 : undefined}
            />
            <g transform={`translate(${C} ${C}) rotate(${round(mid)}) translate(0 ${-R_GLYPH})`}>
              <Glyph rarity={segment.rarity} />
            </g>
            {/* Every label reads from the rim towards the centre. With the
                marker at nine o'clock, whichever wedge it stops on is set
                horizontally and the right way up. */}
            <text
              transform={`translate(${C} ${C}) rotate(${round(mid)}) translate(0 ${-R_LABEL}) rotate(90)`}
              textAnchor="start"
              dominantBaseline="central"
              className="font-display"
              style={{
                fontSize: 7.2,
                letterSpacing: '0.035em',
                fill: landed ? INK[segment.rarity].lit : INK[segment.rarity].rest,
              }}
            >
              {segment.wheelLabel.toUpperCase()}
            </text>
          </g>
        );
      })}

      {segments.map((segment, index) => {
        const angle = index * step;
        const inner = polar(angle, R_PITCH);
        const bandIn = polar(angle, R_BAND_IN - 0.6);
        const rim = polar(angle, R_RIM);
        return (
          <g key={`peg-${segment.id}`}>
            <line x1={inner.x} y1={inner.y} x2={bandIn.x} y2={bandIn.y} stroke="rgba(255,255,255,0.055)" strokeWidth="0.4" />
            <line x1={bandIn.x} y1={bandIn.y} x2={rim.x} y2={rim.y} stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
          </g>
        );
      })}

      <circle cx={C} cy={C} r={R_PITCH} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
      <circle cx={C} cy={C} r={R_RIM - 0.3} fill="none" stroke="#35363f" strokeWidth="0.6" />

      {!blurred && landedIndex != null ? (
        <path
          className="fd-wheel__lock"
          d={bandPath(landedIndex * step, (landedIndex + 1) * step, R_PITCH + 1.2, R_BAND_OUT)}
          pathLength={1}
          fill="none"
          stroke="var(--wheel-accent)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

/** The angle a rotor is at right now, including mid-transition. */
function readAngle(element: Element): number {
  const transform = getComputedStyle(element).transform;
  const match = /matrix\(\s*([-\d.e]+),\s*([-\d.e]+)/.exec(transform);
  if (!match) return 0;
  return (Math.atan2(Number(match[2]), Number(match[1])) * 180) / Math.PI;
}

/**
 * The wheel.
 *
 * The rotation is decided by the engine and the wheel is simply told where to
 * stop — the visual can never disagree with the draw. The engine lands the
 * chosen wedge at the rotor's twelve o'clock; the whole assembly is turned a
 * quarter back so that point sits at nine, beside the marker.
 *
 * Motion is split by what it is allowed to affect:
 *   - the rotor is a CSS transition on `transform`, run by the compositor, so a
 *     throttled main thread cannot stall it or desynchronise it from state;
 *   - anticipation, speed blur and the lock are CSS keyed off `data-state`;
 *   - the marker's flapper and the live readout follow the rotor's measured
 *     angle on animation frames. They are feedback only: if frames stop, the
 *     draw, the lock and the reveal all still happen on time.
 */
export function Wheel({
  segments,
  phase,
  rotation,
  durationMs = SPIN_MS_FULL,
  onRest,
  landedIndex = null,
  armed = false,
  pressed = false,
  onTick,
  className,
}: {
  segments: Category[];
  phase: WheelPhase;
  rotation: number;
  durationMs?: number;
  /** Fired when the rotor's transform transition finishes. */
  onRest?: () => void;
  /** The wedge the wheel has stopped on, once it has. */
  landedIndex?: number | null;
  /** Hovered or focused: the wheel draws back slightly, ready to go. */
  armed?: boolean;
  /** Held down: the wheel gives under the press. */
  pressed?: boolean;
  /** Called with the wedge under the marker each time it changes during a spin. */
  onTick?: (index: number) => void;
  className?: string;
}) {
  const reduceMotion = Boolean(useReducedMotion());
  const uid = useId().replace(/:/g, '');
  const rotorRef = useRef<HTMLDivElement>(null);
  const flapperRef = useRef<HTMLDivElement>(null);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTickRef.current = onTick;
  });

  const spinning = phase === 'spinning';
  const landed = landedIndex != null ? segments[landedIndex] : null;
  const accent = landed
    ? landed.rarity === 'standard'
      ? 'var(--color-home)'
      : RARITY_META[landed.rarity].token
    : 'var(--color-home)';

  // Marker flapper and readout. A tiny damped spring, kicked each time a peg
  // passes the marker: at full speed the kicks arrive faster than the spring
  // can return, so the flapper rides up and trembles; as the wheel slows the
  // kicks separate into single ticks and the flapper drops back between them.
  useEffect(() => {
    if (!spinning) return;
    const rotor = rotorRef.current;
    const flapper = flapperRef.current;
    if (!rotor) return;

    const step = 360 / segments.length;
    const flap = Boolean(flapper) && !reduceMotion;
    let frame = 0;
    let last = performance.now();
    let lastIndex = -1;
    let angle = 0;
    let velocity = 0;

    if (flap && flapper) flapper.style.transition = 'none';

    const loop = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;

      const underMarker = Math.floor(mod360(-readAngle(rotor)) / step) % segments.length;
      if (underMarker !== lastIndex) {
        if (lastIndex !== -1) velocity -= 240;
        lastIndex = underMarker;
        onTickRef.current?.(underMarker);
      }

      if (flap && flapper) {
        for (let i = 0; i < 2; i++) {
          const h = dt / 2;
          velocity += (-1500 * angle - 30 * velocity) * h;
          angle = Math.max(-17, Math.min(4, angle + velocity * h));
        }
        flapper.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      if (flapper) {
        // Hand the flapper back to CSS, which eases it onto its seat.
        flapper.style.transition = '';
        flapper.style.transform = '';
      }
    };
  }, [spinning, segments.length, reduceMotion]);

  const foilId = `${uid}-foil`;
  const baseId = `${uid}-base`;

  return (
    <div
      className={cn('fd-wheel relative mx-auto aspect-square w-full', className)}
      data-state={phase}
      data-armed={armed && (phase === 'ready' || phase === 'revealed') ? '' : undefined}
      data-pressed={pressed && (phase === 'ready' || phase === 'revealed') ? '' : undefined}
      // --spin-ms only exists mid-spin. The duration depends on the reduced
      // motion preference, which the server cannot know, so rendering it at
      // rest would make the server and client HTML disagree.
      style={{ '--spin-ms': spinning ? `${durationMs}ms` : undefined, '--wheel-accent': accent } as CSSProperties}
    >
      <div aria-hidden="true" className="fd-wheel__glow" />
      <div aria-hidden="true" className="fd-wheel__floor" />

      <div className="fd-wheel__body">
        <div className="fd-wheel__orient">
          <div className="fd-wheel__cock">
            <div
              ref={rotorRef}
              // Marked essential so the global reduced-motion rule cannot zero
              // this transition out. Reduced motion is honoured by shortening
              // the journey instead of deleting the motion outright.
              data-motion="essential"
              className="wheel-rotor absolute inset-0"
              style={{
                transform: `rotate(${round(rotation)}deg)`,
                transitionDuration: `${spinning ? durationMs : 0}ms`,
                // Dropping the property, not just the duration, is what stops
                // a running transition. A zero duration leaves one already in
                // flight to finish on its own clock, so a skipped or throttled
                // spin would keep turning under a result that has already
                // locked. With no transition-property it is cancelled and the
                // rotor lands on its final angle at once.
                transitionProperty: spinning ? 'transform' : 'none',
              }}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget && event.propertyName === 'transform') onRest?.();
              }}
            >
              <div className="fd-wheel__faces">
                <Face segments={segments} landedIndex={landedIndex} foilId={foilId} baseId={baseId} />
              </div>
              {spinning && !reduceMotion ? (
                <div className="fd-wheel__blur">
                  <Face segments={segments} landedIndex={null} foilId={foilId} baseId={baseId} blurred />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Light stays where the floodlights are while the wheel turns under it. */}
        <div aria-hidden="true" className="fd-wheel__sheen" />
        <div aria-hidden="true" className="fd-wheel__shade" />
        <div aria-hidden="true" className="fd-wheel__spot" />

        <div aria-hidden="true" className="fd-wheel__hub">
          <svg viewBox="-22 -22 44 44" className="size-full" focusable="false">
            <defs>
              <radialGradient id={`${uid}-hub`} cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor="#23242c" />
                <stop offset="100%" stopColor="#08080b" />
              </radialGradient>
            </defs>
            <circle r="21" fill={`url(#${uid}-hub)`} stroke="#35363f" strokeWidth="0.9" />
            <circle className="fd-wheel__hub-ring" r="20.2" fill="none" stroke="var(--wheel-accent)" strokeWidth="1.1" />
            <circle r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
            <path d="M0 -8.5 A8.5 8.5 0 0 0 0 8.5 Z" fill="var(--color-home)" opacity="0.92" />
            <path d="M0 -8.5 A8.5 8.5 0 0 1 0 8.5 Z" fill="var(--color-away)" opacity="0.5" />
            <circle r="3.4" fill="var(--color-void)" stroke="var(--color-ink)" strokeWidth="0.8" />
          </svg>
        </div>
      </div>

      <div aria-hidden="true" className="fd-wheel__marker">
        <div ref={flapperRef} className="fd-wheel__flapper">
          <svg viewBox="0 0 64 24" className="size-full" focusable="false">
            <path d="M10 5 L63 12 L10 19 Z" fill="var(--color-ink)" />
            <path d="M13 9.3 L51 12 L13 14.7 Z" fill="var(--color-home)" />
            <circle cx="10" cy="12" r="8.6" fill="#17181e" stroke="#3c3e48" strokeWidth="1.2" />
            <circle cx="10" cy="12" r="3.3" fill="var(--color-ink-muted)" />
            <circle cx="8.9" cy="10.9" r="1.1" fill="var(--color-ink)" opacity="0.75" />
          </svg>
        </div>
      </div>
    </div>
  );
}
