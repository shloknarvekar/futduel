'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { spin as computeSpin, type SpinOutcome } from '@/lib/engine/wheel';
import { BACKSTOP_EXTRA_MS, SKIP_REVEAL_MS, spinTarget, spinTiming } from '@/lib/engine/spin-timing';

/**
 * ready     nothing drawn yet, or the last draw has been read and may be spun again
 * spinning  the rotor is travelling to the angle the engine chose
 * locked    the wheel has stopped on its wedge; the result is held for a beat
 * revealed  the category is announced and the flow may move on
 */
export type WheelPhase = 'ready' | 'spinning' | 'locked' | 'revealed';

/**
 * One spin of the wheel, from press to reveal.
 *
 * Shared by the arena and the home page so the two can never disagree about
 * when a result is final. The outcome is computed the moment the spin starts
 * and nothing after that can change it: timers only decide when it is shown.
 *
 * Timers own the phases, not the transition. `transitionend` is permission to
 * lock early, never a reason to; a collapsed duration or a throttled tab would
 * otherwise reveal a category while the rotor still sits at its start angle.
 * Leaving `spinning` also cancels the rotor's transition (the wheel drops its
 * transition-property), which lands it on its final angle, so the wheel is
 * correct at lock time whatever happened — including after a skip.
 */
export function useWheelSpin({
  reduceMotion,
  onReveal,
}: {
  reduceMotion: boolean;
  onReveal?: (outcome: SpinOutcome) => void;
}) {
  const timing = spinTiming(reduceMotion);

  const [phase, setPhase] = useState<WheelPhase>('ready');
  const [rotation, setRotation] = useState(0);
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);

  const phaseRef = useRef<WheelPhase>('ready');
  const outcomeRef = useRef<SpinOutcome | null>(null);
  const rotationRef = useRef(0);
  const startedAtRef = useRef(0);
  const spinMsRef = useRef(timing.spinMs);
  const revealAtRef = useRef(timing.revealAtMs);
  const onRevealRef = useRef(onReveal);

  useEffect(() => {
    onRevealRef.current = onReveal;
  });

  const move = useCallback((next: WheelPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const lock = useCallback(() => {
    if (phaseRef.current !== 'spinning') return;
    move('locked');
  }, [move]);

  const reveal = useCallback(() => {
    const current = phaseRef.current;
    if (current !== 'spinning' && current !== 'locked') return;
    const drawn = outcomeRef.current;
    if (!drawn) return;
    move('revealed');
    onRevealRef.current?.(drawn);
  }, [move]);

  /**
   * Starts a spin and returns the outcome it will land on, or null while a spin
   * is already under way. The draw depends only on the seed; the current angle
   * decides how far the rotor travels, never where it stops.
   */
  const spin = useCallback(
    (seed: string, options: { exclude?: string[] } = {}): SpinOutcome | null => {
      const current = phaseRef.current;
      if (current === 'spinning' || current === 'locked') return null;

      const next = computeSpin(seed, { exclude: options.exclude, from: rotationRef.current });
      // Reduced motion travels the last partial turn only, so the wheel still
      // moves and still lands on the drawn wedge without the long sweep.
      const target = spinTarget(next.rotation, reduceMotion);

      outcomeRef.current = next;
      rotationRef.current = target;
      startedAtRef.current = Date.now();
      spinMsRef.current = timing.spinMs;
      revealAtRef.current = timing.revealAtMs;

      setOutcome(next);
      setRotation(target);
      move('spinning');
      return next;
    },
    [move, reduceMotion, timing.revealAtMs, timing.spinMs],
  );

  /** Skips to the result. Always the result already drawn — skipping only shortens the wait. */
  const skip = useCallback(() => {
    const current = phaseRef.current;
    if (current === 'spinning') {
      const elapsed = Date.now() - startedAtRef.current;
      revealAtRef.current = Math.min(revealAtRef.current, elapsed + SKIP_REVEAL_MS);
      move('locked');
    } else if (current === 'locked') {
      reveal();
    }
  }, [move, reveal]);

  /** Wire to the rotor's transitionend. Ignored if it reports back before the spin could have finished. */
  const handleRest = useCallback(() => {
    if (Date.now() - startedAtRef.current < spinMsRef.current) return;
    lock();
  }, [lock]);

  // Scheduled from the moment the spin started, so neither the lock nor the
  // reveal can arrive before the wheel has visibly turned for its full time.
  useEffect(() => {
    if (phase !== 'spinning' && phase !== 'locked') return;
    const elapsed = Date.now() - startedAtRef.current;
    const timers: number[] = [];
    if (phase === 'spinning') {
      timers.push(window.setTimeout(lock, Math.max(0, spinMsRef.current - elapsed)));
    }
    const revealIn = Math.max(0, revealAtRef.current - elapsed);
    timers.push(window.setTimeout(reveal, revealIn));
    timers.push(window.setTimeout(reveal, revealIn + BACKSTOP_EXTRA_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase, lock, reveal]);

  return { phase, rotation, outcome, timing, spin, skip, handleRest };
}
