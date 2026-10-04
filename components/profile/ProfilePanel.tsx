'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, Check, Lock, Pencil, PlayCircle, Trash2 } from 'lucide-react';
import type { DuelRecord } from '@/lib/domain/types';
import { useProfileStore } from '@/lib/store/profile';
import { HISTORY_KEPT, historyKey, replayProblem } from '@/lib/engine/history';
import { ProfileSettings } from './ProfileSettings';
import { SuggestCategory } from './SuggestCategory';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_TIER_TOKEN,
  nextTier,
  tierFor,
  tierProgress,
  unlockedCount,
} from '@/lib/engine/progression';
import { rankFor } from '@/lib/data/ladder';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Panel, Skeleton, StatTile } from '@/components/ui/primitives';
import { ordinal } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

function ManagerIdentity() {
  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);
  const setManagerName = useProfileStore((s) => s.setManagerName);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.managerName);

  useEffect(() => {
    setDraft(profile.managerName);
  }, [profile.managerName]);

  const tier = tierFor(profile.rating);
  const next = nextTier(profile.rating);
  const progress = tierProgress(profile.rating);

  if (!hydrated) {
    return (
      <Panel className="grid gap-4 p-5">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-40" />
      </Panel>
    );
  }

  return (
    <Panel className="p-5 sm:p-6">
      {editing ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setManagerName(draft);
            setEditing(false);
          }}
        >
          <div className="flex-1">
            <label htmlFor="manager-name" className="kicker mb-2 block">
              Manager name
            </label>
            <input
              id="manager-name"
              value={draft}
              autoFocus
              maxLength={24}
              onChange={(event) => setDraft(event.target.value)}
              className="h-12 w-full rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3.5 text-base text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]"
            />
            <p className="mt-1.5 text-2xs text-[var(--color-ink-faint)]">
              Up to 24 characters. Shown on challenge links you send.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" icon={<Check className="size-4" aria-hidden="true" />}>
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(profile.managerName);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker mb-1.5" style={{ color: tier.token }}>
              {tier.name}
            </p>
            <h2 className="truncate text-[clamp(1.8rem,6vw,2.6rem)]">{profile.managerName}</h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
            icon={<Pencil className="size-3.5" aria-hidden="true" />}
          >
            Rename
          </Button>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between text-[12px]">
          <span className="tnum font-semibold text-[var(--color-ink)]">{profile.rating} rating</span>
          <span className="text-[var(--color-ink-muted)]">
            {next ? (
              <>
                <span className="tnum">{next.min - profile.rating}</span> to {next.name}
              </>
            ) : (
              'Top tier reached'
            )}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-3)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={`Progress through ${tier.name}`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]"
            style={{ width: `${progress * 100}%`, background: tier.token }}
          />
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-ink-muted)]">
          Currently {ordinal(rankFor(profile.rating))} in the field.
        </p>
      </div>
    </Panel>
  );
}

function Achievements() {
  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);
  const total = unlockedCount(profile);

  return (
    <section aria-labelledby="achievements-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="achievements-heading" className="text-2xl">
          Achievements
        </h2>
        <p className="tnum text-[12px] text-[var(--color-ink-muted)]">
          {hydrated ? `${total} of ${ACHIEVEMENTS.length}` : '—'}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((achievement) => {
          const progress = profile.achievements[achievement.id] ?? 0;
          const unlocked = hydrated && progress >= achievement.target;
          const token = ACHIEVEMENT_TIER_TOKEN[achievement.tier];

          return (
            <li key={achievement.id}>
              <div
                className={cn(
                  'flex h-full items-start gap-3 rounded-[12px] border p-3.5 transition-colors',
                  unlocked
                    ? 'border-[var(--color-line-strong)] bg-[var(--color-surface-2)]'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)]',
                )}
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background: unlocked ? `color-mix(in oklab, ${token} 16%, transparent)` : 'var(--color-surface-3)',
                  }}
                >
                  {unlocked ? (
                    <Award className="size-4" style={{ color: token }} aria-hidden="true" />
                  ) : (
                    <Lock className="size-3.5 text-[var(--color-ink-faint)]" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-[13px] font-semibold',
                      unlocked ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]',
                    )}
                  >
                    {achievement.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-ink-faint)]">
                    {achievement.description}
                  </p>
                  {!unlocked && achievement.target > 1 ? (
                    <p className="tnum mt-1.5 text-[10px] text-[var(--color-ink-faint)]">
                      {Math.min(progress, achievement.target)} / {achievement.target}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const PAGE = 20;
const RESULT_WORD = { win: 'Won', loss: 'Lost', draw: 'Drew' } as const;

/** What kind of duel it was, in a few words: "Solo, Pro · Chosen category". */
function duelMeta(record: DuelRecord): string {
  const mode =
    record.mode === 'solo'
      ? `Solo${record.difficulty ? `, ${record.difficulty[0]!.toUpperCase()}${record.difficulty.slice(1)}` : ''}`
      : record.mode === 'friend'
        ? 'Friend duel'
        : 'Pass and play';
  const source =
    record.categorySource === 'chosen'
      ? 'Chosen category'
      : record.categorySource === 'challenge'
        ? 'Challenge'
        : record.categorySource === 'wheel'
          ? 'Spun category'
          : null;
  return source ? `${mode} · ${source}` : mode;
}

function History() {
  const history = useProfileStore((s) => s.profile.history);
  const hydrated = useProfileStore((s) => s.hydrated);
  const [shown, setShown] = useState(PAGE);
  // Only formatted once the saved profile has loaded, which is always after
  // mount, so the server and client markup cannot disagree about a date.
  const formatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }), []);

  if (!hydrated) return <Skeleton className="h-40 w-full" />;

  if (history.length === 0) {
    return (
      <EmptyState
        title="No duels yet"
        description={`Your last ${HISTORY_KEPT} duels will appear here, with the categories you played and how each one went.`}
        action={<ButtonLink href="/duel">Play your first duel</ButtonLink>}
      />
    );
  }

  const scoreOnly = history.some((record) => replayProblem(record));

  return (
    <>
      <ul className="grid gap-2">
        {history.slice(0, shown).map((record) => {
          const tone =
            record.result === 'win'
              ? 'var(--color-home)'
              : record.result === 'loss'
                ? 'var(--color-danger)'
                : 'var(--color-ink-muted)';
          const key = historyKey(record);
          const when = formatter.format(record.playedAt);
          const replayable = replayProblem(record) === null;
          return (
            <li key={key}>
              <Panel className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 px-3.5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-[7px] text-[11px] font-bold uppercase"
                  style={{ color: tone, background: `color-mix(in oklab, ${tone} 14%, transparent)` }}
                  aria-label={RESULT_WORD[record.result]}
                >
                  {record.result === 'win' ? 'W' : record.result === 'loss' ? 'L' : 'D'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                    {record.home.categoryName}{' '}
                    <span className="text-[var(--color-ink-muted)]">v</span> {record.away.categoryName}
                  </p>
                  <p className="truncate text-2xs text-[var(--color-ink-muted)]">
                    v {record.away.name} · {duelMeta(record)}
                  </p>
                  <p className="text-2xs text-[var(--color-ink-muted)]">
                    <time dateTime={new Date(record.playedAt).toISOString()}>{when}</time>
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum font-display text-lg leading-none text-[var(--color-ink)]">
                    {record.home.goals}–{record.away.goals}
                  </p>
                  <p className="tnum mt-1 text-[12px] font-semibold" style={{ color: tone }}>
                    {record.ratingDelta >= 0 ? '+' : ''}
                    {record.ratingDelta}
                  </p>
                </div>
                <div className="col-span-3 flex justify-end border-t border-[var(--color-line)] pt-2.5 sm:col-span-1 sm:border-0 sm:pt-0">
                  {replayable ? (
                    <ButtonLink
                      href={`/duel?history=${encodeURIComponent(key)}`}
                      variant="secondary"
                      size="sm"
                      icon={<PlayCircle className="size-4" aria-hidden="true" />}
                      aria-label={`Replay ${record.home.categoryName} v ${record.away.categoryName}, ${when}`}
                    >
                      Replay
                    </ButtonLink>
                  ) : (
                    <span className="text-2xs text-[var(--color-ink-muted)]">Score only</span>
                  )}
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
      {history.length > shown ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, history.length - shown)} older duels
          </Button>
        </div>
      ) : null}
      {scoreOnly ? (
        <p className="mt-3 text-[12px] text-[var(--color-ink-muted)]">
          Duels marked “Score only” were played before FutDuel kept replays, or use a card or category that has
          since been retired.
        </p>
      ) : null}
    </>
  );
}

function DangerZone() {
  const reset = useProfileStore((s) => s.reset);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  return (
    <>
      <Panel className="flex flex-wrap items-center justify-between gap-4 border-[rgba(255,84,104,0.24)] p-5">
        <div>
          <h2 className="text-lg">Reset everything</h2>
          <p className="mt-1 max-w-[52ch] text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            Clears your rating, record, achievements, duel history, settings and category
            suggestions from this browser. It cannot be undone.
          </p>
        </div>
        <Button
          variant="danger"
          onClick={() => setOpen(true)}
          icon={<Trash2 className="size-4" aria-hidden="true" />}
        >
          Reset data
        </Button>
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Reset your manager?"
        description="This wipes your rating, achievements and history from this browser."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              variant="danger"
              block
              loading={working}
              loadingLabel="Clearing"
              onClick={async () => {
                setWorking(true);
                await reset();
                setWorking(false);
                setOpen(false);
              }}
            >
              Yes, reset everything
            </Button>
            <Button variant="secondary" block onClick={() => setOpen(false)}>
              Keep my record
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
          There is no account behind FutDuel, so there is no backup to restore from. Your fantasy
          squads are stored separately and are not affected.
        </p>
      </Modal>
    </>
  );
}

export function ProfilePanel() {
  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);

  const stats = useMemo(() => {
    const s = profile.stats;
    const winRate = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;
    return [
      { label: 'Played', value: s.played },
      { label: 'Won', value: s.won, tone: 'home' as const },
      { label: 'Win rate', value: `${winRate}%` },
      { label: 'Best streak', value: s.bestStreak, tone: 'gold' as const },
      { label: 'Goals for', value: s.goalsFor },
      { label: 'Goals against', value: s.goalsAgainst },
      { label: 'Spins', value: s.spins },
      { label: 'Categories seen', value: s.categoriesSeen.length },
    ];
  }, [profile.stats]);

  // The sections fill in once the saved profile loads, which moves them, so a
  // link to one (#history, #settings, #suggest) is honoured again after that.
  useEffect(() => {
    if (!hydrated || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [hydrated]);

  return (
    <div className="grid gap-10">
      <ManagerIdentity />

      <section aria-labelledby="record-heading">
        <h2 id="record-heading" className="mb-4 text-2xl">
          Record
        </h2>
        {hydrated ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((stat) => (
              <StatTile key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-[5.5rem]" />
            ))}
          </div>
        )}
      </section>

      <Achievements />

      <section id="history" aria-labelledby="history-heading" className="scroll-mt-24">
        <h2 id="history-heading" className="text-2xl">
          Recent duels
        </h2>
        <p className="mb-4 mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
          Your last {HISTORY_KEPT} duels, kept in this browser. Replay one to watch the same ninety minutes
          and see both elevens again; the oldest drop off as new ones are played.
        </p>
        <History />
      </section>

      <section id="settings" aria-labelledby="settings-heading" className="scroll-mt-24">
        <h2 id="settings-heading" className="mb-4 text-2xl">
          Settings
        </h2>
        <ProfileSettings />
      </section>

      <section id="suggest" aria-labelledby="suggest-heading" className="scroll-mt-24">
        <h2 id="suggest-heading" className="text-2xl">
          Suggest a category
        </h2>
        <p className="mb-4 mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
          Got a rule you would play under? Write it down here. FutDuel has no server to send it to, so it is
          saved on this device only and nobody else sees it.
        </p>
        <SuggestCategory />
      </section>

      <DangerZone />
    </div>
  );
}
