'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import type { Category, CategoryGroup } from '@/lib/domain/types';
import { CATEGORY_GROUP_LABEL, RARITY_META } from '@/lib/data/categories';
import { WHEEL_SEGMENTS } from '@/lib/engine/wheel';
import { coverageFor } from '@/lib/engine/filters';
import { CategoryCard } from '@/components/duel/CategoryCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

const RARITY_TONE = { standard: 'neutral', rare: 'away', legendary: 'gold' } as const;

/**
 * Choosing a category instead of spinning for one.
 *
 * The list is the wheel's own segments, the categories the viability judge
 * passed, so a chosen category is exactly as playable as a spun one and no
 * rule is loosened by choosing. Nothing here draws or changes the wheel; the
 * choice is simply the category the builder opens on.
 */
export function CategoryChooser({
  side,
  managerName,
  exclude = [],
  excludedNote,
  opponentNote,
  continueLabel,
  onChoose,
}: {
  side: 'home' | 'away';
  managerName: string;
  /** Categories this manager may not take, such as the one the other manager already has. */
  exclude?: string[];
  excludedNote?: string;
  /** What happens on the other side once this choice is made. */
  opponentNote?: string;
  continueLabel: string;
  onChoose: (category: Category) => void;
}) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const name = useId();
  const accent = side === 'home' ? 'var(--color-home)' : 'var(--color-away)';

  // Grouped the way the categories are written, so related rules sit together.
  const groups = useMemo(() => {
    const byGroup = new Map<CategoryGroup, Category[]>();
    for (const category of WHEEL_SEGMENTS) {
      byGroup.set(category.group, [...(byGroup.get(category.group) ?? []), category]);
    }
    return [...byGroup.entries()];
  }, []);

  const chosen = WHEEL_SEGMENTS.find((category) => category.id === chosenId) ?? null;
  const choose = () => {
    if (chosen && !exclude.includes(chosen.id)) onChoose(chosen);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
      <div className="min-w-0">
        <p className="kicker mb-1.5" style={{ color: accent }}>
          {side === 'home' ? 'Manager one' : 'Manager two'} &middot; {managerName}
        </p>
        <h2 className="text-[clamp(1.6rem,4.5vw,2.3rem)]">Choose your category</h2>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
          No wheel this time. Read the briefs, pick the rule you want to build under, and every
          other rule of the duel stays the same. {opponentNote}
        </p>

        {groups.map(([group, categories]) => (
          <fieldset key={group} className="mt-7">
            <legend className="kicker mb-3">{CATEGORY_GROUP_LABEL[group]}</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {categories.map((category) => {
                const taken = exclude.includes(category.id);
                const active = chosenId === category.id;
                const eligible = coverageFor(category).total;
                return (
                  <label
                    key={category.id}
                    className={cn(
                      'relative flex min-h-11 flex-col gap-2 rounded-[4px] border p-3.5 transition-colors duration-150',
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--side-accent)]',
                      taken
                        ? 'cursor-not-allowed border-dashed border-[var(--color-line)] opacity-60'
                        : active
                          ? 'cursor-pointer bg-[var(--color-surface-2)]'
                          : 'cursor-pointer border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-2)]',
                    )}
                    style={{ '--side-accent': accent, ...(active ? { borderColor: accent } : {}) } as React.CSSProperties}
                  >
                    <input
                      type="radio"
                      name={name}
                      value={category.id}
                      checked={active}
                      disabled={taken}
                      onChange={() => setChosenId(category.id)}
                      className="sr-only"
                    />
                    <span className="flex items-start gap-2">
                      <span className="min-w-0 font-display text-[17px] uppercase leading-tight text-[var(--color-ink)]">
                        {category.name}
                      </span>
                      <Badge tone={RARITY_TONE[category.rarity]} className="ml-auto shrink-0 px-2 py-0.5 text-[10px]">
                        {RARITY_META[category.rarity].label}
                      </Badge>
                    </span>
                    <span className="text-[12px] leading-snug text-[var(--color-ink-soft)]">{category.brief}</span>
                    <span className="meta flex items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]">
                      <Users className="size-3" aria-hidden="true" />
                      {taken ? excludedNote : `${eligible} players eligible`}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <p className="mt-8 text-[12px] text-[var(--color-ink-muted)]">
          Missing a rule you would play?{' '}
          <Link
            href="/profile#suggest"
            className="font-semibold text-[var(--color-ink-soft)] underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            Suggest a category
          </Link>
          .
        </p>

        {/* On a phone the list is long; the choice and its button follow the
            reader down it instead of waiting at the very end. */}
        {/* Clears the phone's bottom navigation, as the match scoreboard does. */}
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 mt-6 lg:hidden">
          <div className="flex items-center gap-3 rounded-[4px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] p-3 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)]">
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--color-ink)]" aria-live="polite">
              {chosen ? chosen.name : 'Nothing chosen yet'}
            </p>
            <Button
              variant={side === 'home' ? 'primary' : 'ice'}
              disabled={!chosen}
              onClick={choose}
              icon={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              {continueLabel}
            </Button>
          </div>
        </div>
      </div>

      <aside className="hidden content-start gap-4 lg:sticky lg:top-24 lg:grid lg:self-start">
        {chosen ? (
          <CategoryCard key={chosen.id} category={chosen} side={side} />
        ) : (
          <div className="rounded-[14px] border border-dashed border-[var(--color-line-strong)] p-6 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
            Pick a category to see its brief, rarity and how many players it allows.
          </div>
        )}
        <Button size="lg" block variant={side === 'home' ? 'primary' : 'ice'} disabled={!chosen} onClick={choose}>
          {continueLabel}
        </Button>
      </aside>
    </div>
  );
}
