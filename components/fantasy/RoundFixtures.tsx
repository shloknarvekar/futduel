import type { FantasyRoundView } from '@/lib/football/fantasy-types';
import { FixtureLine } from '@/components/football/FixtureLine';
import { roundLabel } from './fantasy-format';

function RoundList({ title, view, stale }: { title: string; view: FantasyRoundView; stale: boolean }) {
  const finished = view.fixtures.filter((f) => f.phase === 'finished').length;
  const headingId = `round-${view.round.id}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-[var(--color-line)] pb-3">
        <div>
          <p className="kicker mb-1 text-[11px]">{title}</p>
          <h2 id={headingId} className="text-[clamp(1.5rem,4vw,2rem)] leading-none">
            {roundLabel(view.round.name)}
          </h2>
        </div>
        <p className="tnum text-[13px] text-[var(--color-ink-soft)]">
          {finished} of {view.fixtures.length} played
        </p>
      </div>

      {view.fixtures.length === 0 ? (
        <p className="border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-5 text-[14px] text-[var(--color-ink-soft)]">
          No fixtures are listed for this round yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-px border border-[var(--color-line)] bg-[var(--color-line)]">
          {view.fixtures.map((fixture) => (
            <li key={fixture.id} className="bg-[var(--color-void)]">
              <FixtureLine fixture={fixture} showLeague={false} stale={stale} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The round's real fixtures, then last round's results. */
export function RoundFixtures({
  active,
  previous,
  stale = false,
}: {
  active: FantasyRoundView | null;
  previous: FantasyRoundView | null;
  /** The feed is not current: matches in play are not shown as live. */
  stale?: boolean;
}) {
  if (!active && !previous) {
    return <p className="text-[14px] text-[var(--color-ink-soft)]">No rounds are listed for this season.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-10">
      {active ? <RoundList title="This round" view={active} stale={stale} /> : null}
      {previous ? <RoundList title="Last round" view={previous} stale={stale} /> : null}
    </div>
  );
}
