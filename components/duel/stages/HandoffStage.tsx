'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { entrance } from '@/lib/utils/motion';

/**
 * The privacy screen between two managers sharing a device. Without it, the
 * second manager builds their eleven having already seen the first one.
 */
export function HandoffStage({
  nextManager,
  onContinue,
}: {
  nextManager: string;
  onContinue: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={entrance(reduceMotion, { opacity: 0, scale: 0.98 })}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="panel mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-14 text-center"
    >
      <span className="grid size-14 place-items-center rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface-3)]">
        <EyeOff className="size-6 text-[var(--color-away)]" aria-hidden="true" />
      </span>
      <p className="kicker">Hand the device over</p>
      <h2 className="text-[clamp(1.7rem,6vw,2.4rem)]">
        <span className="text-[var(--color-away)]">{nextManager}</span>, you&rsquo;re up
      </h2>
      <p className="max-w-[42ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
        The first eleven is hidden. Build yours without seeing it, exactly as it should be.
      </p>
      <Button size="lg" variant="ice" onClick={onContinue} className="mt-2">
        I&rsquo;m {nextManager} — continue
      </Button>
    </motion.div>
  );
}
