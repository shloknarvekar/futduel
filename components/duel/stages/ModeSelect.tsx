'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, LayoutList, Link as LinkIcon, RotateCw, Users } from 'lucide-react';
import type { AIDifficulty } from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { cn } from '@/lib/utils/cn';

export type DuelMode = 'solo' | 'local' | 'friend';

/** How a manager gets their category: from the wheel, or picked from the list. */
export type CategoryPick = 'wheel' | 'chosen';

const PICKS: { id: CategoryPick; name: string; blurb: string; icon: typeof Bot }[] = [
  { id: 'wheel', name: 'Spin the wheel', blurb: 'Let the wheel decide. Every category is equally likely.', icon: RotateCw },
  { id: 'chosen', name: 'Choose a category', blurb: 'Browse every category, read the briefs, pick the one you want.', icon: LayoutList },
];

const MODES: {
  id: DuelMode;
  name: string;
  blurb: string;
  icon: typeof Bot;
}[] = [
  {
    id: 'solo',
    name: 'Solo',
    blurb: 'Face an AI manager who spins their own category and drafts against you.',
    icon: Bot,
  },
  {
    id: 'local',
    name: 'Pass and play',
    blurb: 'Two managers, one device. Build in turn, then watch it settle.',
    icon: Users,
  },
  {
    id: 'friend',
    name: 'Friend duel',
    blurb: 'Build your eleven, send a link, and let them answer it in their own time.',
    icon: LinkIcon,
  },
];

const DIFFICULTIES: { value: AIDifficulty; label: string }[] = [
  { value: 'amateur', label: 'Amateur' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
];

export function ModeSelect({
  defaultName,
  onStart,
}: {
  defaultName: string;
  onStart: (config: {
    mode: DuelMode;
    difficulty: AIDifficulty;
    homeName: string;
    awayName: string;
    categorySource: CategoryPick;
  }) => void;
}) {
  const [mode, setMode] = useState<DuelMode>('solo');
  const [pick, setPick] = useState<CategoryPick>('wheel');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('pro');
  const [homeName, setHomeName] = useState(defaultName);
  const [awayName, setAwayName] = useState('Manager 2');

  // The saved profile arrives a moment after mount. Adopt it until the manager
  // types something of their own, then never touch the field again.
  const editedRef = useRef(false);
  useEffect(() => {
    if (!editedRef.current) setHomeName(defaultName);
  }, [defaultName]);

  return (
    <div className="grid gap-6">
      <fieldset>
        <legend className="kicker mb-3">Choose a duel</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((option) => {
            const Icon = option.icon;
            const active = mode === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  'relative flex cursor-pointer flex-col gap-2 rounded-[12px] border p-4 transition-all duration-150',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-home)]',
                  active
                    ? 'border-[var(--color-home)] bg-[color-mix(in_oklab,var(--color-home)_5%,transparent)]'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-2)]',
                )}
              >
                <input
                  type="radio"
                  name="duel-mode"
                  value={option.id}
                  checked={active}
                  onChange={() => setMode(option.id)}
                  className="sr-only"
                />
                <Icon
                  className="size-5"
                  style={{ color: active ? 'var(--color-home)' : 'var(--color-ink-muted)' }}
                  aria-hidden="true"
                />
                <span className="font-display text-lg leading-none">{option.name}</span>
                <span className="text-[12px] leading-relaxed text-[var(--color-ink-muted)]">{option.blurb}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="kicker mb-3">Your category</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PICKS.map((option) => {
            const Icon = option.icon;
            const active = pick === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  'relative flex min-h-11 cursor-pointer items-start gap-3 rounded-[12px] border p-4 transition-all duration-150',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-home)]',
                  active
                    ? 'border-[var(--color-home)] bg-[color-mix(in_oklab,var(--color-home)_5%,transparent)]'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-2)]',
                )}
              >
                <input
                  type="radio"
                  name="category-pick"
                  value={option.id}
                  checked={active}
                  onChange={() => setPick(option.id)}
                  className="sr-only"
                />
                <Icon
                  className="mt-0.5 size-5 shrink-0"
                  style={{ color: active ? 'var(--color-home)' : 'var(--color-ink-muted)' }}
                  aria-hidden="true"
                />
                <span className="grid gap-1.5">
                  <span className="font-display text-lg leading-none">{option.name}</span>
                  <span className="text-[12px] leading-relaxed text-[var(--color-ink-muted)]">{option.blurb}</span>
                </span>
              </label>
            );
          })}
        </div>
        {pick === 'chosen' && mode !== 'local' ? (
          <p className="mt-2.5 max-w-[60ch] text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            {mode === 'solo'
              ? 'You choose yours; the AI manager still spins for its own.'
              : 'You choose yours; your friend spins for theirs when they open the link.'}
          </p>
        ) : null}
      </fieldset>

      {mode === 'solo' ? (
        <div>
          <p className="kicker mb-2.5">Opponent difficulty</p>
          <Segmented
            label="Opponent difficulty"
            options={DIFFICULTIES}
            value={difficulty}
            onChange={setDifficulty}
          />
          <p className="mt-2.5 max-w-[56ch] text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            {difficulty === 'amateur'
              ? 'Reaches deep into the shortlist and mostly ignores chemistry.'
              : difficulty === 'pro'
                ? 'Builds a coherent spine and links players where it can.'
                : 'Takes close to the strongest legal eleven available, every time.'}
          </p>
        </div>
      ) : null}

      {mode === 'local' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="home-name" className="kicker mb-2 block">
              Manager 1
            </label>
            <input
              id="home-name"
              value={homeName}
              onChange={(event) => {
                editedRef.current = true;
                setHomeName(event.target.value.slice(0, 24));
              }}
              maxLength={24}
              className="h-12 w-full rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 text-base text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]"
            />
          </div>
          <div>
            <label htmlFor="away-name" className="kicker mb-2 block">
              Manager 2
            </label>
            <input
              id="away-name"
              value={awayName}
              onChange={(event) => setAwayName(event.target.value.slice(0, 24))}
              maxLength={24}
              className="h-12 w-full rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 text-base text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-away)]"
            />
          </div>
        </div>
      ) : null}

      {mode === 'friend' ? (
        <p className="max-w-[60ch] rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
          You will {pick === 'chosen' ? 'choose your category' : 'spin'}, build your eleven, and get a link to send. Your friend spins their own
          category, builds against you, and the match plays out on the same seed — so you both see
          the identical ninety minutes.
        </p>
      ) : null}

      <div>
        <Button
          size="lg"
          onClick={() =>
            onStart({
              mode,
              difficulty,
              homeName: homeName.trim() || 'You',
              awayName: awayName.trim() || 'Manager 2',
              categorySource: pick,
            })
          }
        >
          {pick === 'chosen' ? 'Choose a category' : 'Go to the wheel'}
        </Button>
      </div>
    </div>
  );
}
