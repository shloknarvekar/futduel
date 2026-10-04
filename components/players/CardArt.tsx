import { useId } from 'react';
import type { Player } from '@/lib/domain/types';
import { CLUB_BY_ID } from '@/lib/data/clubs';
import { CLUB_KIT } from './kits';
import { inkOn, luminanceOf, mixHex } from './player-visuals';

/**
 * The picture on a card.
 *
 * FutDuel holds no licence to player photography, and a likeness it drew or
 * generated of a real footballer would be worse than none. So the art is the
 * one image every card can honestly carry: the back of the player's shirt,
 * in their club's colour, with their name across the shoulders and the number
 * they wore that season, when it is known. It is cropped past the card edges so it reads as a
 * close-up rather than an icon, and lit from above like a floodlit pitch.
 *
 * Behind the shirt sit pitch markings that change with the card type: mown
 * stripes for a standard card, the penalty area for a Hero, the centre circle
 * for an Icon. Everything is drawn from data the card already owns.
 */
export function CardArt({
  player,
  className,
  showNumber = true,
}: {
  player: Player;
  className?: string;
  /** The outlined shirt number. Off for thumbnails, where it competes with the rating. */
  showNumber?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const club = CLUB_BY_ID.get(player.clubId);
  const brand = club?.color ?? '#3a4a44';
  const kit = CLUB_KIT[player.clubId];
  const base = kit?.shirt ?? brand;
  // Black and near-black kits vanish on a dark card, so they are lifted just
  // enough to keep a silhouette without pretending to be another colour.
  const shirt = luminanceOf(base) < 0.04 ? mixHex(base, '#8a9a94', 0.22) : base;
  const ink = inkOn(shirt);
  const outline = ink === INK_LIGHT ? '#000000' : '#ffffff';
  // A shirt that is not the brand colour wears the brand on its collar.
  const trim = kit ? brand : mixHex(shirt, ink === INK_LIGHT ? '#ffffff' : '#000000', 0.28);

  const surname = player.short.toUpperCase();
  const nameSize = Math.min(34, Math.max(16, 200 / (surname.length * 0.5)));
  const estimated = surname.length * nameSize * 0.5;
  // The number the player wore in this version's season. When it is not
  // sourced the back stays plain: a blank shirt is honest, a guessed number is
  // not. The position is shown in the card's rating column instead.
  const shirtNumber = player.shirtNumber;

  const id = (part: string) => `${uid}-${part}`;

  return (
    <svg
      viewBox="0 0 300 300"
      preserveAspectRatio="xMidYMin slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id('fabric')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mixHex(shirt, '#ffffff', 0.16)} />
          <stop offset="0.5" stopColor={shirt} />
          <stop offset="1" stopColor={mixHex(shirt, '#000000', 0.55)} />
        </linearGradient>
        <radialGradient id={id('flood')} cx="0.5" cy="-0.05" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <pattern id={id('knit')} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={ink} strokeOpacity="0.05" strokeWidth="1.6" />
        </pattern>
        {kit?.stripe ? (
          <>
            <pattern id={id('stripes')} width="44" height="10" patternUnits="userSpaceOnUse" x="-6">
              <rect x="0" y="0" width="22" height="10" fill={kit.stripe} />
            </pattern>
            {/* Stripes are flat colour; this puts the floodlit fall-off back on them. */}
            <linearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.35" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.5" />
            </linearGradient>
          </>
        ) : null}
        {/* Set below the rating column, which covers the top-left of the art. */}
        <path id={id('arch')} d="M 72 150 Q 150 130 228 150" />
      </defs>

      <PitchMarks type={player.cardType} />

      <g className="card-art__shirt">
        <path d={SHIRT} fill={`url(#${id('fabric')})`} />
        {kit?.stripe ? (
          <>
            <path d={SHIRT} fill={`url(#${id('stripes')})`} />
            <path d={SHIRT} fill={`url(#${id('shade')})`} />
          </>
        ) : null}
        <path d={SHIRT} fill={`url(#${id('knit')})`} />
        {/* Seams and folds: low-contrast strokes so the shape reads as cloth. */}
        <path d="M 64 44 C 70 92, 62 130, 52 158" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="1.4" />
        <path d="M 236 44 C 230 92, 238 130, 248 158" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="1.4" />
        <path d="M 104 170 C 112 212, 106 252, 110 300" fill="none" stroke="#000" strokeOpacity="0.09" strokeWidth="14" strokeLinecap="round" />
        <path d="M 200 176 C 192 220, 198 258, 194 300" fill="none" stroke="#fff" strokeOpacity="0.05" strokeWidth="12" strokeLinecap="round" />
        <path d={COLLAR} fill="none" stroke={trim} strokeWidth="8" strokeLinecap="round" />
        <path d="M 117 28 C 131 42, 169 42, 183 28" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="2" />

        {/* A soft outline keeps the name legible where it crosses stripes. */}
        <text
          fill={ink}
          fillOpacity="0.94"
          stroke={outline}
          strokeOpacity={kit?.stripe ? 0.45 : 0.18}
          strokeWidth="3"
          paintOrder="stroke"
          fontSize={nameSize}
          letterSpacing="1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <textPath
            href={`#${id('arch')}`}
            startOffset="50%"
            textAnchor="middle"
            {...(estimated > 170 ? { textLength: 170, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
          >
            {surname}
          </textPath>
        </text>
        {showNumber && shirtNumber !== null ? (
          <text
            x="150"
            y="268"
            textAnchor="middle"
            fontSize="112"
            fill={ink}
            fillOpacity="0.16"
            stroke={ink}
            strokeOpacity="0.55"
            strokeWidth="2.2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {shirtNumber}
          </text>
        ) : null}
        <path d={SHIRT} fill={`url(#${id('flood')})`} />
      </g>
    </svg>
  );
}

const INK_LIGHT = '#f2f7f3';

/** Back of a short-sleeved shirt, larger than the frame so the card crops it. */
const SHIRT =
  'M 112 24 C 128 40, 172 40, 188 24 L 236 44 C 268 54, 300 74, 326 102 L 318 186 C 296 180, 270 170, 248 158 L 252 320 L 48 320 L 52 158 C 30 170, 4 180, -18 186 L -26 102 C 0 74, 32 54, 64 44 Z';

const COLLAR = 'M 112 24 C 128 40, 172 40, 188 24';

function PitchMarks({ type }: { type: Player['cardType'] }) {
  // Custom properties only resolve through `style`; SVG presentation
  // attributes treat var() as invalid and fall back to black.
  if (type === 'icon') {
    return (
      <g style={{ fill: 'none', stroke: 'var(--color-icon-bright)', strokeOpacity: 0.42, strokeWidth: 1.5 }}>
        <circle cx="150" cy="40" r="118" />
        <circle cx="150" cy="40" r="62" style={{ strokeOpacity: 0.18 }} />
        <circle cx="150" cy="40" r="3.5" style={{ fill: 'var(--color-icon-bright)', stroke: 'none' }} />
        <line x1="-10" y1="40" x2="310" y2="40" />
      </g>
    );
  }
  if (type === 'hero') {
    return (
      <g style={{ fill: 'none', stroke: 'var(--color-hero-bright)', strokeOpacity: 0.38, strokeWidth: 1.5 }}>
        <path d="M 14 -4 V 70 H 286 V -4" />
        <path d="M 96 -4 V 26 H 204 V -4" />
        <path d="M 112 70 A 46 46 0 0 0 188 70" />
      </g>
    );
  }
  return (
    <g style={{ fill: 'var(--color-home)', fillOpacity: 0.035 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={i * 50} y="-10" width="25" height="320" />
      ))}
    </g>
  );
}
