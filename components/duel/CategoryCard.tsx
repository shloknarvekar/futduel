'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Users } from 'lucide-react';
import type { Category } from '@/lib/domain/types';
import { RARITY_META } from '@/lib/data/categories';
import { coverageFor } from '@/lib/engine/filters';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';
import { entrance } from '@/lib/utils/motion';

export function CategoryCard({
  category,
  side = 'home',
  animate = true,
  compact,
  tags,
  className,
}: {
  category: Category;
  side?: 'home' | 'away';
  animate?: boolean;
  compact?: boolean;
  /** Extra rules in force for this build, shown beside the rarity. */
  tags?: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const rarity = RARITY_META[category.rarity];
  const coverage = coverageFor(category);
  const accent = side === 'home' ? 'var(--color-home)' : 'var(--color-away)';

  return (
    <motion.article
      initial={animate ? entrance(reduceMotion, { opacity: 0, y: 14, scale: 0.97 }) : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-[14px] border bg-[var(--color-surface)]',
        className,
      )}
      style={{ borderColor: `color-mix(in oklab, ${rarity.ring} 45%, var(--color-line))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${accent}, ${rarity.token})` }}
      />
      <span
        aria-hidden="true"
        className="absolute -right-16 -top-16 size-40 rounded-full opacity-[0.16] blur-2xl"
        style={{ background: rarity.token }}
      />

      <div className={cn('relative', compact ? 'p-4' : 'p-5 sm:p-6')}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={category.rarity === 'legendary' ? 'gold' : category.rarity === 'rare' ? 'away' : 'neutral'}>
            {rarity.label}
          </Badge>
          {tags}
          <span className="inline-flex items-center gap-1.5 text-2xs text-[var(--color-ink-faint)]">
            <Users className="size-3.5" aria-hidden="true" />
            <span className="tnum">{coverage.total}</span> eligible
          </span>
        </div>

        <h3
          className={cn('leading-[0.92]', compact ? 'text-[clamp(1.3rem,4vw,1.7rem)]' : 'text-[clamp(1.8rem,6vw,2.8rem)]')}
          style={{ color: category.rarity === 'standard' ? 'var(--color-ink)' : rarity.token }}
        >
          {category.name}
        </h3>

        <p className={cn('mt-2 max-w-[52ch] leading-relaxed text-[var(--color-ink-muted)]', compact ? 'text-[13px]' : 'text-sm')}>
          {category.brief}
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2.5">
          <Sparkles className="mt-px size-3.5 shrink-0" style={{ color: accent }} aria-hidden="true" />
          <p className="text-[12px] leading-snug text-[var(--color-ink-soft)]">
            <span className="kicker mr-1.5 text-[9px]">Match effect</span>
            {category.modifier.label}
          </p>
        </div>
      </div>
    </motion.article>
  );
}
