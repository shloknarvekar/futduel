import type { FootballFixture } from '@/lib/football/types';
import { formatDate, formatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/** What to say about a fixture's timing or state, in words. */
export function fixtureStatus(fixture: FootballFixture): string {
  if (fixture.phase === 'live') return fixture.stateLabel;
  if (fixture.phase === 'scheduled') {
    return fixture.kickoff ? `${formatDate(fixture.kickoff)} · ${formatTime(fixture.kickoff)}` : fixture.stateLabel;
  }
  return fixture.stateLabel;
}

/**
 * One real fixture. The score appears only when the provider reports one; a
 * match that has not started shows "v", never 0–0. From a feed that is not
 * current, a match in play is marked as in play when last updated, never as live.
 */
export function FixtureLine({
  fixture,
  showLeague = true,
  stale = false,
  className,
}: {
  fixture: FootballFixture;
  showLeague?: boolean;
  /** The feed this fixture came from is not current. */
  stale?: boolean;
  className?: string;
}) {
  const live = fixture.phase === 'live' && !stale;
  const wasLive = fixture.phase === 'live' && stale;
  const status = fixtureStatus(fixture);
  const statusText = live ? `Live · ${status}` : wasLive ? `In play when last updated · ${status}` : status;
  const summary = fixture.score
    ? `${fixture.home.name} ${fixture.score.home}, ${fixture.away.name} ${fixture.score.away}`
    : `${fixture.home.name} versus ${fixture.away.name}`;

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,13rem)] sm:gap-x-5 sm:px-6',
        className,
      )}
    >
      <p className="sr-only">
        {summary}. {statusText.replace(' · ', ', ')}
        {showLeague && fixture.leagueName ? `. ${fixture.leagueName}` : ''}.
      </p>

      <p aria-hidden="true" className="truncate text-right text-[15px] font-semibold text-[var(--color-ink)] sm:text-[17px]">
        {fixture.home.name}
      </p>

      <span
        aria-hidden="true"
        className={cn(
          'tnum grid min-w-[3.25rem] place-items-center border px-2 py-1 font-[family-name:var(--font-condensed)] text-[15px] font-bold leading-none',
          live
            ? 'border-[var(--color-home)] text-[var(--color-home)]'
            : fixture.score
              ? 'border-[var(--color-line-strong)] text-[var(--color-ink)]'
              : 'border-[var(--color-line-strong)] text-[var(--color-ink-muted)]',
        )}
      >
        {fixture.score ? `${fixture.score.home}–${fixture.score.away}` : 'v'}
      </span>

      <p aria-hidden="true" className="truncate text-[15px] font-semibold text-[var(--color-ink)] sm:text-[17px]">
        {fixture.away.name}
      </p>

      <div aria-hidden="true" className="col-span-3 text-center sm:col-span-1 sm:text-right">
        <p
          className={cn(
            'tnum text-[13px] leading-tight',
            live ? 'font-semibold text-[var(--color-home)]' : 'text-[var(--color-ink-soft)]',
          )}
        >
          {live ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-[var(--color-home)]" />
              {statusText}
            </span>
          ) : (
            statusText
          )}
        </p>
        {showLeague && fixture.leagueName ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-ink-muted)]">{fixture.leagueName}</p>
        ) : null}
      </div>
    </div>
  );
}
