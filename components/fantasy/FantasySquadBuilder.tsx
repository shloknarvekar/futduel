'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2, TriangleAlert } from 'lucide-react';
import type { FantasyGameweek, FantasyRoundView } from '@/lib/football/fantasy-types';
import type { FantasyPosition, FootballSeason, SquadPlayer } from '@/lib/football/types';
import { SQUAD_RULES, squadRoundPoints, validateSquad, type PickWindow } from '@/lib/engine/fantasy-scoring';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { POSITION_GROUP, availabilityText, roundLabel, signedPoints } from './fantasy-format';
import { FantasyPlayerPicker } from './FantasyPlayerPicker';

/* -------------------------------------------------------------------------- */
/* Saved picks                                                                */
/* -------------------------------------------------------------------------- */

interface Picks {
  ids: number[];
  captainId: number | null;
  viceId: number | null;
}

interface Saved extends Picks {
  /** When the eleven last changed, in ms. */
  editedAt: number;
  /** The eleven that was in place at each passed deadline, by round id. */
  locked: Record<string, Picks>;
}

const EMPTY: Saved = { ids: [], captainId: null, viceId: null, editedAt: 0, locked: {} };
const POSITIONS: FantasyPosition[] = ['GK', 'DEF', 'MID', 'FWD'];

/** Picks belong to one competition's season; a new season starts a new eleven. */
export const storageKeyFor = (season: FootballSeason) => `futduel:fantasy:v2:${season.leagueId}:${season.id}`;

function parsePicks(value: unknown): Picks | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const ids = Array.isArray(raw.ids)
    ? [...new Set(raw.ids.filter((id): id is number => Number.isSafeInteger(id)))].slice(0, SQUAD_RULES.size)
    : [];
  const member = (id: unknown) => (typeof id === 'number' && ids.includes(id) ? id : null);
  const captainId = member(raw.captainId);
  const viceId = member(raw.viceId);
  return { ids, captainId, viceId: viceId === captainId ? null : viceId };
}

function readSaved(key: string): Saved {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    const picks = parsePicks(parsed);
    if (!picks) return EMPTY;
    const record = parsed as Record<string, unknown>;
    const locked: Record<string, Picks> = {};
    if (typeof record.locked === 'object' && record.locked !== null) {
      for (const [roundId, value] of Object.entries(record.locked)) {
        const round = parsePicks(value);
        if (round && /^\d+$/.test(roundId)) locked[roundId] = round;
      }
    }
    const editedAt = typeof record.editedAt === 'number' && Number.isFinite(record.editedAt) ? record.editedAt : 0;
    return { ...picks, editedAt, locked };
  } catch {
    return EMPTY;
  }
}

/**
 * Record which eleven counts for each round whose deadline has passed.
 *
 * This runs when the page loads and again before every change, so an eleven
 * last edited before a round's deadline is exactly the one that was in place
 * at it. An eleven edited after the deadline was not, and that round scores
 * nothing for it. Only the active and previous rounds are kept, and a record
 * for a deadline that has not passed (the provider moved a kickoff) is dropped.
 */
function withLockedRounds(saved: Saved, rounds: readonly (FantasyRoundView | null)[], now: number): Saved {
  const locked: Record<string, Picks> = {};
  for (const view of rounds) {
    if (!view?.deadline || Date.parse(view.deadline) > now) continue;
    const id = String(view.round.id);
    const existing = saved.locked[id];
    if (existing) locked[id] = existing;
    else if (saved.ids.length > 0 && saved.editedAt > 0 && saved.editedAt < Date.parse(view.deadline)) {
      locked[id] = { ids: saved.ids, captainId: saved.captainId, viceId: saved.viceId };
    }
  }
  return { ...saved, locked };
}

function write(key: string, saved: Saved) {
  try {
    window.localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    // Storage can be full or blocked; the eleven still works for this visit.
  }
}

/* -------------------------------------------------------------------------- */
/* Round points                                                               */
/* -------------------------------------------------------------------------- */

function RoundPoints({
  title,
  view,
  picks,
  byId,
  live,
  stale,
}: {
  title: string;
  view: FantasyRoundView;
  picks: Picks | undefined;
  byId: Map<number, SquadPlayer>;
  live: boolean;
  stale: boolean;
}) {
  const label = roundLabel(view.round.name);
  const finished = view.fixtures.filter((f) => f.phase === 'finished').length;

  const heading = (
    <>
      <p className="kicker text-[11px]" aria-hidden="true">
        {title}
      </p>
      <h2 className="mt-1 font-[family-name:var(--font-sans)] text-[15px] font-semibold normal-case leading-snug tracking-normal text-[var(--color-ink)]">
        <span className="sr-only">{title}: </span>
        {label}
      </h2>
    </>
  );

  if (!picks) {
    return (
      <section aria-label={`${title}, ${label}`} className="bg-[var(--color-void)] px-5 py-5">
        {heading}
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
          No eleven was saved in this browser before this round&rsquo;s deadline, so it scores nothing here.
        </p>
      </section>
    );
  }

  const squad = picks.ids.map((id) => byId.get(id)).filter((p): p is SquadPlayer => Boolean(p));
  const result = squadRoundPoints(squad, picks.captainId, picks.viceId, view.scores, (teamId) =>
    view.finishedTeamIds.includes(teamId),
  );
  const doubledId = result.doubled === 'captain' ? picks.captainId : result.doubled === 'vice' ? picks.viceId : null;

  return (
    <section aria-label={`${title}, ${label}`} className="bg-[var(--color-void)] px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {heading}
          <p className="mt-1 text-[12px] text-[var(--color-ink-muted)]">
            {finished} of {view.fixtures.length} matches finished
            {live ? (stale ? ' · matches were in play when last updated' : ' · matches in play') : ''}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="stat-figure block text-[clamp(2.2rem,6vw,3rem)] leading-none text-[var(--color-gold)]">
            {result.total}
          </span>
          <span className="kicker text-[10px]">points</span>
        </p>
      </div>

      {!view.hasStats ? (
        <p className="mt-3 text-[13px] text-[var(--color-ink-muted)]">
          No match statistics have been published for this round yet.
        </p>
      ) : null}
      {result.doubled === 'vice' ? (
        <p className="mt-3 text-[13px] text-[var(--color-ink-soft)]">
          Your captain played no minutes, so the vice-captain scored double.
        </p>
      ) : null}

      {view.hasStats && squad.length > 0 ? (
        <details className="group mt-4 border-t border-[var(--color-line)] pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
            How the points were scored
          </summary>
          <ul className="mt-1 grid gap-3 pb-1">
            {squad.map((player) => {
              const score = view.scores[player.id];
              const doubled = player.id === doubledId;
              const lines = score?.matches.flatMap((match) => match.lines) ?? [];
              return (
                <li key={player.id} className="text-[13px]">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold text-[var(--color-ink)]">
                      {player.name}
                      {doubled ? <span className="ml-1.5 text-[var(--color-gold)]">×2</span> : null}
                    </span>
                    <span className="tnum shrink-0 font-semibold text-[var(--color-ink)]">
                      {(score?.total ?? 0) * (doubled ? 2 : 1)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
                    {lines.length > 0
                      ? lines.map((line) => `${line.label} ${signedPoints(line.points)}`).join(' · ')
                      : 'No minutes recorded'}
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Squad builder                                                              */
/* -------------------------------------------------------------------------- */

const ROLE_BUTTON = cn(
  'grid size-11 shrink-0 cursor-pointer place-items-center rounded-[2px] font-[family-name:var(--font-condensed)] text-[15px] font-bold transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-home)]',
);
const ROLE_IDLE = 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-ink)]';

export function FantasySquadBuilder({
  data,
  pick,
  stale = false,
}: {
  data: FantasyGameweek;
  pick: PickWindow | { state: 'closed' };
  /** The feed is not current: matches in play are not described as live. */
  stale?: boolean;
}) {
  const storageKey = storageKeyFor(data.season);
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [ready, setReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { active, previous, players } = data;

  // Read after mount, so server and first client render agree, and settle any
  // passed deadline before anything can change.
  useEffect(() => {
    const next = withLockedRounds(readSaved(storageKey), [active, previous], Date.now());
    setSaved(next);
    write(storageKey, next);
    setReady(true);
  }, [storageKey, active, previous, pick.state]);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const squad = useMemo(
    () => saved.ids.map((id) => byId.get(id)).filter((p): p is SquadPlayer => Boolean(p)),
    [saved.ids, byId],
  );
  const unlisted = saved.ids.length - squad.length;
  const validation = validateSquad(squad);

  const update = (change: (current: Picks) => Picks) => {
    setSaved((stored) => {
      // A deadline may have passed since the last check; record it first.
      const current = withLockedRounds(stored, [active, previous], Date.now());
      const picks = change({ ...current, ids: current.ids.filter((id) => byId.has(id)) });
      const next: Saved = {
        ...current,
        ids: picks.ids,
        captainId: picks.captainId !== null && picks.ids.includes(picks.captainId) ? picks.captainId : null,
        viceId: picks.viceId !== null && picks.ids.includes(picks.viceId) ? picks.viceId : null,
        editedAt: Date.now(),
      };
      write(storageKey, next);
      return next;
    });
  };

  const add = (player: SquadPlayer) => update((p) => ({ ...p, ids: [...p.ids, player.id] }));
  const remove = (id: number) => update((p) => ({ ...p, ids: p.ids.filter((value) => value !== id) }));
  const makeCaptain = (id: number) =>
    update((p) => ({ ...p, captainId: p.captainId === id ? null : id, viceId: p.viceId === id ? null : p.viceId }));
  const makeVice = (id: number) =>
    update((p) => ({ ...p, viceId: p.viceId === id ? null : id, captainId: p.captainId === id ? null : p.captainId }));

  // While a round is locked each player shows this round's points; otherwise
  // last round's, for reference.
  const reference =
    pick.state === 'locked' && active
      ? { view: active, label: 'This round' }
      : previous
        ? { view: previous, label: 'Last round' }
        : null;

  const cards: { title: string; view: FantasyRoundView; live: boolean }[] = [];
  if (pick.state === 'locked' && active) {
    cards.push({ title: 'This round', view: active, live: active.fixtures.some((f) => f.phase === 'live') });
  }
  if (previous) cards.push({ title: 'Last round', view: previous, live: false });

  if (!ready) {
    return (
      <p role="status" className="text-[14px] text-[var(--color-ink-muted)]">
        Loading your eleven&hellip;
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      {cards.length > 0 ? (
        <div
          className={cn(
            'grid grid-cols-1 gap-px border border-[var(--color-line)] bg-[var(--color-line)]',
            cards.length > 1 && 'md:grid-cols-2',
          )}
        >
          {cards.map((card) => (
            <RoundPoints
              key={card.view.round.id}
              title={card.title}
              view={card.view}
              picks={saved.locked[String(card.view.round.id)]}
              byId={byId}
              live={card.live}
              stale={stale}
            />
          ))}
        </div>
      ) : null}

      <section aria-labelledby="fantasy-eleven">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-line)] pb-3">
          <div>
            <h2 id="fantasy-eleven" className="text-[clamp(1.6rem,4vw,2.2rem)] leading-none">
              Your eleven
            </h2>
            <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">
              {pick.state === 'locked'
                ? 'Changes you make now count from the next round.'
                : pick.state === 'open' && active
                  ? `Changes count for ${roundLabel(active.round.name)} until picks lock.`
                  : 'The season is over.'}
            </p>
          </div>
          <p className="tnum text-[13px] text-[var(--color-ink-soft)]" aria-live="polite">
            {squad.length} of {SQUAD_RULES.size} picked
          </p>
        </div>

        <p className="mt-3 max-w-[72ch] text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
          One goalkeeper, 3 to 5 defenders, 2 to 5 midfielders and 1 to 3 forwards, with no more than{' '}
          {SQUAD_RULES.maxPerTeam} from one team. Your captain scores double; if the captain plays no minutes, the
          vice-captain does.
        </p>

        {unlisted > 0 ? (
          <p className="mt-3 flex items-start gap-2 text-[13px] text-[var(--color-warn)]">
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>
              {unlisted === 1 ? 'One saved player is' : `${unlisted} saved players are`} no longer listed in a{' '}
              {data.season.leagueName} squad and will be dropped when you next change your eleven.
            </span>
          </p>
        ) : null}

        {squad.length === 0 ? (
          <div className="mt-5 border border-dashed border-[var(--color-line-strong)] px-5 py-8 text-center">
            <p className="text-[16px] font-semibold text-[var(--color-ink)]">No players picked yet</p>
            <p className="mx-auto mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
              Pick from this season&rsquo;s real {data.season.leagueName} squads. Injured and suspended players are
              marked.
            </p>
            <Button
              className="mt-5"
              onClick={() => setPickerOpen(true)}
              icon={<Plus className="size-4" aria-hidden="true" />}
            >
              Pick your first player
            </Button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5">
            {POSITIONS.map((position) => {
              const group = squad.filter((p) => p.position === position);
              if (group.length === 0) return null;
              return (
                <section key={position} aria-label={POSITION_GROUP[position]}>
                  <h3 className="kicker mb-2 text-[11px]">{POSITION_GROUP[position]}</h3>
                  <ul className="grid grid-cols-1 gap-px border border-[var(--color-line)] bg-[var(--color-line)]">
                    {group.map((player) => {
                      const isCaptain = saved.captainId === player.id;
                      const isVice = saved.viceId === player.id;
                      const status = availabilityText(player);
                      const points = reference ? (reference.view.scores[player.id]?.total ?? null) : null;
                      return (
                        <li
                          key={player.id}
                          className="flex items-center gap-2 bg-[var(--color-void)] py-2 pl-3 pr-1 sm:gap-3 sm:pl-4"
                        >
                          <span
                            className="tnum hidden size-9 shrink-0 place-items-center border border-[var(--color-line-strong)] font-[family-name:var(--font-condensed)] text-[15px] font-bold text-[var(--color-ink-soft)] min-[420px]:grid"
                            aria-hidden="true"
                          >
                            {player.jerseyNumber ?? ''}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-[var(--color-ink)]">
                              {player.name}
                              {isCaptain ? <span className="sr-only">, captain</span> : null}
                              {isVice ? <span className="sr-only">, vice-captain</span> : null}
                            </p>
                            <p className="truncate text-[12px] text-[var(--color-ink-muted)]">
                              {player.team.name}
                              {player.jerseyNumber !== null ? (
                                <span className="sr-only">, shirt {player.jerseyNumber}</span>
                              ) : null}
                              {status ? <span className="text-[var(--color-warn)]"> &middot; {status}</span> : null}
                            </p>
                          </div>
                          {reference ? (
                            <p className="w-12 shrink-0 text-right">
                              <span className="tnum block text-[15px] font-semibold text-[var(--color-ink)]">
                                {points ?? '–'}
                              </span>
                              <span className="block text-[10px] leading-tight text-[var(--color-ink-faint)]">
                                {reference.label}
                              </span>
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => makeCaptain(player.id)}
                            aria-pressed={isCaptain}
                            aria-label={`Captain: ${player.name}`}
                            className={cn(
                              ROLE_BUTTON,
                              isCaptain ? 'bg-[var(--color-gold)] text-[var(--color-void)]' : ROLE_IDLE,
                            )}
                          >
                            C
                          </button>
                          <button
                            type="button"
                            onClick={() => makeVice(player.id)}
                            aria-pressed={isVice}
                            aria-label={`Vice-captain: ${player.name}`}
                            className={cn(
                              ROLE_BUTTON,
                              isVice ? 'border border-[var(--color-gold)] text-[var(--color-gold)]' : ROLE_IDLE,
                            )}
                          >
                            V
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(player.id)}
                            aria-label={`Remove ${player.name}`}
                            className={cn(ROLE_BUTTON, 'text-[var(--color-ink-muted)] hover:bg-[rgba(255,84,104,0.1)] hover:text-[var(--color-danger)]')}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            {validation.complete ? (
              <p className="text-[13px] text-[var(--color-home)]">
                Eleven complete.
                {saved.captainId === null
                  ? ' Pick a captain to double their points.'
                  : saved.viceId === null
                    ? ' Pick a vice-captain as cover.'
                    : ''}
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-[var(--color-ink-muted)]">
                  {validation.missing.length > 0
                    ? `Still needed: ${validation.missing.join(', ')}.`
                    : `${SQUAD_RULES.size - squad.length} more to pick.`}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setPickerOpen(true)}
                  icon={<Plus className="size-4" aria-hidden="true" />}
                >
                  Add a player
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <FantasyPlayerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        players={players}
        squad={squad}
        onAdd={add}
        reference={
          reference
            ? { scores: reference.view.scores, label: `${reference.label} (${roundLabel(reference.view.round.name)})` }
            : null
        }
        leagueName={data.season.leagueName}
      />
    </div>
  );
}
