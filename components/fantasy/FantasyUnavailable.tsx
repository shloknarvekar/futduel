import { CircleOff, Compass, Swords } from 'lucide-react';
import type { FeedProblem } from '@/lib/football/feed';
import { FEED_PROBLEM_MESSAGE } from '@/lib/football/feed';
import { ButtonLink } from '@/components/ui/Button';

/**
 * Fantasy with no current data behind it.
 *
 * FutDuel Fantasy runs only on real, current football. When that is missing
 * the page says so plainly and shows no fixtures, prices, players or points:
 * an old or generated calendar dressed as this week would be worse than a
 * closed game.
 */
export function FantasyUnavailable({ problem }: { problem: FeedProblem }) {
  const notConfigured = problem === 'not-configured';

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <h1 className="text-[clamp(2.6rem,8vw,4.5rem)]">Fantasy</h1>

      <section
        aria-labelledby="fantasy-unavailable"
        className="mt-8 max-w-[44rem] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-6 py-7 sm:px-8 sm:py-9"
      >
        <CircleOff className="size-7 text-[var(--color-ink-muted)]" aria-hidden="true" />
        <h2 id="fantasy-unavailable" className="mt-4 text-[clamp(1.6rem,4vw,2.2rem)] leading-none">
          {notConfigured ? 'Fantasy is switched off' : 'Fantasy is unavailable right now'}
        </h2>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          {notConfigured
            ? 'FutDuel Fantasy is played on real, current fixtures and real match statistics, and no live football data provider is connected. Rather than show an old or generated calendar as if it were this week, the game stays closed until one is.'
            : `${FEED_PROBLEM_MESSAGE[problem]} No fixtures, players or points are shown until current data is available again.`}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/duel" icon={<Swords className="size-4" aria-hidden="true" />}>
            Play a duel
          </ButtonLink>
          <ButtonLink href="/discover" variant="secondary" icon={<Compass className="size-4" aria-hidden="true" />}>
            Browse the cards
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
