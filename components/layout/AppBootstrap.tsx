'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Award } from 'lucide-react';
import { useProfileStore } from '@/lib/store/profile';
import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_TIER_TOKEN } from '@/lib/engine/progression';
import { entrance, exit } from '@/lib/utils/motion';

/**
 * Loads the local profile once on mount and surfaces achievement unlocks.
 *
 * The toast is polite rather than assertive and never takes focus — it is a
 * reward, not an interruption.
 */
export function AppBootstrap() {
  const hydrate = useProfileStore((s) => s.hydrate);
  const unlocks = useProfileStore((s) => s.pendingUnlocks);
  const clearUnlocks = useProfileStore((s) => s.clearUnlocks);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (unlocks.length === 0) return;
    const timer = setTimeout(clearUnlocks, 5200);
    return () => clearTimeout(timer);
  }, [unlocks, clearUnlocks]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[900] flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      <AnimatePresence initial={false}>
        {unlocks.map((unlock) => {
          const tier = ACHIEVEMENT_BY_ID.get(unlock.id)?.tier ?? 'bronze';
          return (
            <motion.div
              key={unlock.id}
              initial={entrance(reduceMotion, { opacity: 0, y: 16, scale: 0.97 })}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={exit(reduceMotion, { opacity: 0, y: 8, scale: 0.98 })}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[12px] border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] px-4 py-3 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.95)]"
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full"
                style={{ background: `color-mix(in oklab, ${ACHIEVEMENT_TIER_TOKEN[tier]} 18%, transparent)` }}
              >
                <Award className="size-4" style={{ color: ACHIEVEMENT_TIER_TOKEN[tier] }} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="kicker text-[9px]">Achievement unlocked</p>
                <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{unlock.name}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
