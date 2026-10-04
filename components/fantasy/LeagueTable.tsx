'use client';

import type { Feed } from '@/lib/football/feed';
import { FEED_PROBLEM_MESSAGE } from '@/lib/football/feed';
import type { StandingRow } from '@/lib/football/types';
import { DataStatus } from '@/components/football/DataStatus';

/** Standings refresh on the server every ten minutes; older than this reads as not current. */
const MAX_LIVE_AGE_MS = 30 * 60_000;

/**
 * The real league table: position, team and points, the fields FutDuel reads
 * from the provider. Nothing is derived or estimated.
 */
export function LeagueTable({
  standings,
  attribution,
  leagueName,
}: {
  standings: Feed<StandingRow[]>;
  attribution: string;
  leagueName: string;
}) {
  if (standings.status === 'unavailable') {
    return (
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-6">
        <p className="text-[16px] font-semibold text-[var(--color-ink)]">The table is unavailable right now</p>
        <p className="mt-1.5 text-[14px] text-[var(--color-ink-soft)]">{FEED_PROBLEM_MESSAGE[standings.problem]}</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="league-table">
      <div className="mb-3 border-b border-[var(--color-line)] pb-3">
        <h2 id="league-table" className="text-[clamp(1.5rem,4vw,2rem)] leading-none">
          {leagueName} table
        </h2>
        <DataStatus feed={standings} attribution={attribution} maxLiveAgeMs={MAX_LIVE_AGE_MS} className="mt-3" />
      </div>

      {standings.data.length === 0 ? (
        <p className="text-[14px] text-[var(--color-ink-soft)]">No standings are published for this season yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14px]">
            <caption className="sr-only">{leagueName} standings: position, team and points</caption>
            <thead>
              <tr className="border-b border-[var(--color-line-strong)] text-[var(--color-ink-muted)]">
                <th scope="col" className="kicker w-14 py-2 pr-3 text-[11px] font-normal">
                  Pos
                </th>
                <th scope="col" className="kicker py-2 pr-3 text-[11px] font-normal">
                  Team
                </th>
                <th scope="col" className="kicker w-16 py-2 text-right text-[11px] font-normal">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {standings.data.map((row) => (
                <tr key={row.team.id} className="border-b border-[var(--color-line)]">
                  <td className="tnum py-2.5 pr-3 text-[var(--color-ink-soft)]">{row.position}</td>
                  <th scope="row" className="py-2.5 pr-3 font-semibold text-[var(--color-ink)]">
                    {row.team.name}
                  </th>
                  <td className="tnum py-2.5 text-right font-semibold text-[var(--color-ink)]">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
