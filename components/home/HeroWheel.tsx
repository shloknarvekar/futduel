'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight, Lock, LockOpen } from 'lucide-react';
import type { Category } from '@/lib/domain/types';
import { RARITY_META } from '@/lib/data/categories';
import { WHEEL_SEGMENTS, sideSeed } from '@/lib/engine/wheel';
import { coverageFor } from '@/lib/engine/filters';
import { makeSeed } from '@/lib/engine/rng';
import { useProfileStore } from '@/lib/store/profile';
import { Wheel } from '@/components/duel/Wheel';
import { useWheelSpin, type WheelPhase } from '@/components/duel/useWheelSpin';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ImageStreamHero } from '@/components/ui/ImageStreamHero';
import { HERO_STREAM } from '@/components/home/hero-stream';

const RARITY_ORDER: Category['rarity'][] = ['standard', 'rare', 'legendary'];

/** Name ink on the reveal. Standard categories take plain white; rarity keeps its metal. */
const NAME_INK: Record<Category['rarity'], string> = {
  standard: 'var(--color-ink)',
  rare: 'var(--color-away)',
  legendary: 'var(--color-gold)',
};

/** The same three marks the wheel prints beside each label. */
function RarityGlyph({ rarity }: { rarity: Category['rarity'] }) {
  return (
    <svg viewBox="-4 -4 8 8" className="size-2.5 shrink-0" aria-hidden="true" focusable="false">
      {rarity === 'legendary' ? (
        <path d="M0 -3.4 L2.6 0 L0 3.4 L-2.6 0 Z" fill="var(--color-gold)" />
      ) : rarity === 'rare' ? (
        <circle r="2.1" fill="var(--color-away)" />
      ) : (
        <rect x="-0.6" y="-3" width="1.2" height="6" fill="var(--color-ink-muted)" />
      )}
    </svg>
  );
}

/** A wheel and its marker, drawn at icon size and weight. */
function SpinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="14" cy="12" r="8" />
      <circle cx="14" cy="12" r="2" />
      <path d="M14 4v4M14 16v4M22 12h-4M10 12H6" strokeWidth="1.6" />
      <path d="M1.5 12h3" strokeLinecap="round" />
    </svg>
  );
}

function statusLabel(phase: WheelPhase) {
  if (phase === 'spinning') return 'Drawing';
  if (phase === 'locked') return 'Locked';
  return 'Category locked';
}

/**
 * The corridor, centred on whichever part of the hero it is anchored to. Two
 * instances exist and CSS shows one: the wheel on tablet and desktop, the
 * statement on a phone, where the wheel is nearly as wide as the screen and
 * would hide the whole stream behind itself.
 *
 * It is decorative — the corridor inside is already aria-hidden, and this
 * hides the wrapper too so neither instance is reachable or announced.
 */
function HeroStream({ anchor }: { anchor: 'intro' | 'stage' }) {
  return (
    <div className="fd-hero__stream" data-anchor={anchor} aria-hidden="true">
      {/* 30s for one card to cross the corridor: slow enough to read as a
          drift through a room rather than a carousel. */}
      <ImageStreamHero images={HERO_STREAM} speed={30} axis={50} />
    </div>
  );
}

/**
 * The home page hero: the draw itself.
 *
 * The wheel here is not a picture of the game, it is the first move of one.
 * It spins through the same hook as the arena and draws the home side's
 * category from the same seed derivation, so the link it hands on re-derives
 * exactly the category shown. Nothing on this page picks a category of its
 * own, and nothing shown during the spin is invented: the running readout is
 * whichever wedge is physically under the marker at that moment.
 */
export function HeroWheel({ footballers }: { footballers: number }) {
  const reduceMotion = Boolean(useReducedMotion());
  const registerSpin = useProfileStore((s) => s.registerSpin);

  const [seed, setSeed] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);

  const actionRef = useRef<HTMLButtonElement>(null);
  const enterRef = useRef<HTMLAnchorElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  const wheel = useWheelSpin({
    reduceMotion,
    onReveal: (outcome) => {
      // A spin is a spin wherever it happens. Written only once the stored
      // profile has loaded, so this can never replace it with a blank one.
      if (useProfileStore.getState().hydrated) registerSpin(outcome.category.id);
    },
  });

  const { phase, outcome } = wheel;
  const busy = phase === 'spinning' || phase === 'locked';
  const drawn = outcome?.category ?? null;
  const landedIndex = phase === 'locked' || phase === 'revealed' ? (outcome?.segmentIndex ?? null) : null;

  const startSpin = () => {
    const next = makeSeed();
    if (wheel.spin(sideSeed(next, 'home'))) {
      setSeed(next);
      setPressed(false);
    }
  };

  const onAction = () => {
    if (busy) wheel.skip();
    else startSpin();
  };

  // The readout is written directly rather than through state: during the fast
  // part of a spin it changes every frame, and re-rendering the hero sixty
  // times a second to show a blur of names would be waste.
  useEffect(() => {
    const readout = readoutRef.current;
    if (!readout) return;
    if (phase === 'spinning') readout.textContent = reduceMotion ? 'On the wheel' : '';
    if (phase === 'locked' && drawn) readout.textContent = drawn.name;
  }, [phase, drawn, reduceMotion]);

  useEffect(() => {
    if (phase !== 'revealed') return;
    // Whoever started the spin from the keyboard should land on the way
    // forward, not on "Spin again".
    if (document.activeElement === actionRef.current) enterRef.current?.focus({ preventScroll: true });
    // On a phone the result lands below the wheel, behind the tab bar. Bring
    // it into view; where it is already visible this does nothing.
    consoleRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [phase, reduceMotion]);

  const rarity = drawn ? RARITY_META[drawn.rarity] : null;
  const eligible = drawn ? coverageFor(drawn).total : null;

  const announcement =
    phase === 'spinning'
      ? 'Spinning the wheel.'
      : phase === 'revealed' && drawn && rarity
        ? `Category locked: ${drawn.name}. ${rarity.label} category, ${eligible} eligible footballers. Build your strongest eleven.`
        : '';

  return (
    <section className="fd-hero" data-phase={phase} aria-labelledby="hero-title">
      <div className="fd-hero__grid">
        <div className="fd-hero__intro">
          {/* The corridor's anchor on a phone: the statement sits in its open
              centre, with the cards sweeping out past both shoulders. */}
          <HeroStream anchor="intro" />

          <p className="fd-hero__kicker">FutDuel</p>
          <h1 id="hero-title" className="fd-hero__title">
            <span>Build.</span> <span>Battle.</span> <span>Prove it.</span>
          </h1>
        </div>

        {/* Each beat is kept whole; the line may only break between them. */}
        <p className="fd-hero__lede">
          <span>Spin a category.</span> <span>Build your strongest XI.</span> <span>Duel.</span>
        </p>

        <div className="fd-hero__cta">
          <Button
            ref={actionRef}
            size="lg"
            variant={phase === 'ready' ? 'primary' : 'secondary'}
            icon={phase === 'ready' ? <SpinIcon /> : undefined}
            onClick={onAction}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setPressed(false);
            }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => {
              setHovered(false);
              setPressed(false);
            }}
            onPointerDown={() => {
              if (!busy) setPressed(true);
            }}
            onKeyDown={(event) => {
              if (!busy && (event.key === ' ' || event.key === 'Enter')) setPressed(true);
            }}
            onKeyUp={() => setPressed(false)}
            // One fixed box for all three labels, so the button a spin was
            // started from does not resize or slide out from under the pointer
            // when it becomes "Skip to result".
            className="h-12 min-w-[9.5rem] px-5 text-[13px] sm:h-14 sm:min-w-[11.75rem] sm:px-8 sm:text-[15px]"
          >
            {phase === 'ready' ? 'Spin for duel' : busy ? 'Skip to result' : 'Spin again'}
          </Button>

          {/* Kept in every phase: it is the way to the builder without a draw,
              and removing it re-centred the row under the pointer mid-flow. */}
          <ButtonLink
            href="/duel"
            variant="secondary"
            className="h-12 min-w-[9.5rem] px-5 text-[13px] sm:h-14 sm:min-w-[11.75rem] sm:px-8 sm:text-[15px]"
          >
            Build your XI
          </ButtonLink>
        </div>

        <div className="fd-hero__stage">
          {/* The corridor's anchor from tablet up: the cards are born behind
              the wheel, so the wheel is what deals them. */}
          <HeroStream anchor="stage" />

          {/* A pointer shortcut to the spin button, which is the accessible control. */}
          <div
            aria-hidden="true"
            className="fd-hero__wheel"
            onClick={() => {
              if (!busy) startSpin();
            }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => {
              setHovered(false);
              setPressed(false);
            }}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
          >
            <Wheel
              segments={WHEEL_SEGMENTS}
              phase={phase}
              rotation={wheel.rotation}
              durationMs={wheel.timing.spinMs}
              onRest={wheel.handleRest}
              landedIndex={landedIndex}
              armed={hovered || focused}
              pressed={pressed}
              onTick={(index) => {
                if (readoutRef.current && !reduceMotion) {
                  readoutRef.current.textContent = WHEEL_SEGMENTS[index]?.name ?? '';
                }
              }}
            />
          </div>
        </div>

        <div ref={consoleRef} className="fd-hero__console" data-phase={phase}>
          {phase !== 'ready' && drawn && rarity ? (
            <div
              // One key for the whole draw: the status line and the name stay
              // put from lock to reveal, and only what is new arrives.
              key={`draw-${seed}`}
              className="fd-hero__draw"
              style={
                {
                  '--rarity-ink': NAME_INK[drawn.rarity],
                  '--name-ink': NAME_INK[drawn.rarity],
                } as CSSProperties
              }
            >
              <p className="fd-hero__status">
                <span className="fd-hero__state">
                  {phase === 'spinning' ? (
                    <LockOpen className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Lock className="size-3.5" aria-hidden="true" />
                  )}
                  {statusLabel(phase)}
                </span>
                {phase === 'revealed' ? (
                  <span className="fd-hero__rarity" data-rarity={drawn.rarity}>
                    <RarityGlyph rarity={drawn.rarity} />
                    {rarity.label}
                  </span>
                ) : null}
                <span className="fd-hero__seed">
                  Draw <b>{seed}</b>
                </span>
              </p>

              {phase === 'revealed' ? (
                <h2 className="fd-hero__name" style={{ '--chars': Math.max(drawn.name.length, 9) } as CSSProperties}>
                  {drawn.name}
                </h2>
              ) : (
                <span
                  ref={readoutRef}
                  aria-hidden="true"
                  data-live=""
                  className="fd-hero__name"
                  // Seated at its final size the moment the wheel locks, so the
                  // reveal changes the name's colour, never its size.
                  style={phase === 'locked' ? ({ '--chars': Math.max(drawn.name.length, 9) } as CSSProperties) : undefined}
                />
              )}

              {phase === 'revealed' ? (
                <div className="fd-hero__detail">
                  <p className="fd-hero__brief">
                    {drawn.brief} <span className="text-[var(--color-ink)]">Build your strongest XI.</span>
                  </p>
                  <dl className="fd-hero__facts">
                    <div>
                      <dt>Eligible</dt>
                      <dd>
                        <span className="tnum">{eligible}</span> footballers
                      </dd>
                    </div>
                    <div>
                      <dt>Match effect</dt>
                      <dd>{drawn.modifier.label}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {phase === 'revealed' && seed ? (
                <Link
                  ref={enterRef}
                  href={`/duel?draw=${seed}`}
                  aria-label={`Enter squad builder with ${drawn.name}`}
                  className="fd-hero__enter"
                >
                  Enter squad builder
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* The wheel's marks and how many categories carry each: rarity is how
            a category looks and how hard it is to build under. Every one of
            them lands exactly as often as any other. */}
        <dl className="fd-hero__key" aria-label="The wheel">
          {RARITY_ORDER.map((key) => (
            <div key={key}>
              <dt>
                <RarityGlyph rarity={key} />
                {RARITY_META[key].label}
              </dt>
              <dd>{WHEEL_SEGMENTS.filter((segment) => segment.rarity === key).length}</dd>
            </div>
          ))}
          <div>
            <dt>Equal odds</dt>
            <dd>1 in {WHEEL_SEGMENTS.length}</dd>
          </div>
          <div>
            <dt>Footballers</dt>
            <dd>{footballers}</dd>
          </div>
        </dl>
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
