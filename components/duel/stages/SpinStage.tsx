'use client';

import { useCallback, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Category } from '@/lib/domain/types';
import { WHEEL_SEGMENTS, sideSeed } from '@/lib/engine/wheel';
import { RARITY_META } from '@/lib/data/categories';
import { coverageFor } from '@/lib/engine/filters';
import { Wheel } from '@/components/duel/Wheel';
import { useWheelSpin } from '@/components/duel/useWheelSpin';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

export function SpinStage({
  side,
  managerName,
  seed,
  exclude,
  autoSpin,
  onResult,
  onContinue,
  continueLabel,
}: {
  side: 'home' | 'away';
  managerName: string;
  seed: string;
  exclude?: string[];
  /** Spin without waiting for a press — used for the AI turn. */
  autoSpin?: boolean;
  onResult: (category: Category) => void;
  onContinue: () => void;
  continueLabel: string;
}) {
  const reduceMotion = Boolean(useReducedMotion());

  // Timing, the lock and the reveal live in the shared hook, so this stage and
  // the home page wheel can never disagree about when a draw is final.
  const wheel = useWheelSpin({
    reduceMotion,
    onReveal: (outcome) => onResult(outcome.category),
  });
  const { phase, outcome, spin: spinWheel } = wheel;

  const accent = side === 'home' ? 'var(--color-home)' : 'var(--color-away)';

  const start = useCallback(() => {
    if (phase !== 'ready') return;
    spinWheel(sideSeed(seed, side), { exclude });
  }, [exclude, phase, seed, side, spinWheel]);

  useEffect(() => {
    if (!autoSpin || phase !== 'ready') return;
    const timer = window.setTimeout(start, 700);
    return () => window.clearTimeout(timer);
  }, [autoSpin, phase, start]);

  const landed = phase === 'revealed' && outcome ? outcome.category : null;
  const landedIndex = (phase === 'locked' || phase === 'revealed') && outcome ? outcome.segmentIndex : null;
  const status = phase === 'revealed' ? 'landed' : phase === 'ready' ? 'ready' : 'spinning';

  const rarity = landed ? RARITY_META[landed.rarity] : null;
  const eligible = landed ? coverageFor(landed).total : null;
  const spinning = status === 'spinning';

  return (
    <div className="relative">
      {/* Oversized watermark. Decorative, so it is hidden from the reading order. */}
      <span
        aria-hidden="true"
        className="ghost-type pointer-events-none absolute -top-6 left-1/2 z-0 -translate-x-1/2 text-[clamp(7rem,26vw,20rem)] sm:-top-12"
      >
        {spinning ? 'Spin' : landed ? 'Drawn' : 'Spin'}
      </span>

      <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col items-center">
          <p className="kicker mb-3 text-center" style={{ color: accent }}>
            {side === 'home' ? 'Manager one' : 'Manager two'} &middot; {managerName}
          </p>

          <Wheel
            segments={WHEEL_SEGMENTS}
            phase={phase}
            rotation={wheel.rotation}
            durationMs={wheel.timing.spinMs}
            onRest={wheel.handleRest}
            landedIndex={landedIndex}
            className="max-w-[min(72vw,440px)] translate-x-[5%]"
          />

          <div className="mt-9 flex w-full flex-col items-center gap-4">
            {status !== 'landed' ? (
              <Button
                size="lg"
                variant={side === 'home' ? 'primary' : 'ice'}
                onClick={start}
                loading={spinning}
                loadingLabel="Spinning"
                disabled={autoSpin && status === 'ready'}
                className={cn(
                  'min-w-[15rem] text-base',
                  status === 'ready' &&
                    !autoSpin &&
                    'motion-safe:animate-[pulse-ring_2.4s_var(--ease-out-soft)_infinite]',
                )}
              >
                {autoSpin ? 'Opponent spinning' : 'Spin the wheel'}
              </Button>
            ) : (
              <Button
                size="lg"
                variant={side === 'home' ? 'primary' : 'ice'}
                onClick={onContinue}
                className="min-w-[15rem] text-base"
              >
                {continueLabel}
              </Button>
            )}
          </div>
        </div>

        {/* The draw, revealed as a broadcast title card rather than a tooltip. */}
        <div aria-live="polite" className="lg:sticky lg:top-28">
          {landed && rarity ? (
            <article
              key={landed.id}
              className="slab rise-enter relative overflow-hidden p-6 sm:p-8"
              style={{ borderColor: `color-mix(in oklab, ${rarity.token} 40%, var(--color-line-strong))` }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: `linear-gradient(90deg, ${accent}, ${rarity.token})` }}
              />
              <span
                aria-hidden="true"
                className="absolute -right-20 -top-24 size-56 rounded-full opacity-20 blur-3xl"
                style={{ background: rarity.token }}
              />

              <div className="relative">
                <p className="kicker" style={{ color: rarity.token }}>
                  {rarity.label} category
                </p>

                <h2 className="mt-3 text-[clamp(2.4rem,7vw,4.2rem)] leading-[0.86]">
                  {landed.name}
                </h2>

                <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                  {landed.brief}
                </p>

                <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden border border-[var(--color-line)] bg-[var(--color-line)]">
                  <div className="bg-[var(--color-surface)] px-4 py-3">
                    <dt className="kicker text-[11px]">Eligible</dt>
                    <dd className="stat-figure mt-1 text-[1.75rem] text-[var(--color-ink)]">
                      {eligible}
                    </dd>
                  </div>
                  <div className="bg-[var(--color-surface)] px-4 py-3">
                    <dt className="kicker text-[11px]">Effect</dt>
                    <dd className="mt-1 text-[12px] leading-snug text-[var(--color-ink-soft)]">
                      {landed.modifier.label}
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          ) : (
            <div className="panel flex min-h-[19rem] flex-col justify-center gap-4 px-7 py-10">
              <p className="kicker">
                {spinning ? 'Drawing' : 'Awaiting the draw'}
              </p>
              <p className="text-[clamp(1.4rem,3vw,1.9rem)] font-display uppercase leading-[0.95] text-[var(--color-ink)]">
                {spinning ? 'Round and round' : `${WHEEL_SEGMENTS.length} ways to be tested`}
              </p>
              <p className="max-w-[40ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {spinning
                  ? 'The wheel is deciding which slice of world football you are allowed to pick from.'
                  : 'Both managers draw their own category. You are not building the same team as your opponent — you are building the best answer to a different question.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
