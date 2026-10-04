import type { Metadata } from 'next';
import { getFootballProvider } from '@/lib/football/provider';
import { getFantasyGameweek } from '@/lib/football/fantasy';
import { FantasyExperience } from '@/components/fantasy/FantasyExperience';
import { FantasyUnavailable } from '@/components/fantasy/FantasyUnavailable';

export const metadata: Metadata = {
  title: 'Fantasy',
  description:
    'FutDuel Fantasy: pick an eleven from real squads and score FutDuel points from real match statistics, when live football data is connected.',
};

/** Re-rendered at most once a minute; the page also refreshes itself in the browser. */
export const revalidate = 60;

/**
 * Fantasy runs on real, current football or not at all. With no provider, or
 * a provider that cannot supply the current round, the page says so and shows
 * no fixtures, players or points.
 */
export default async function FantasyPage() {
  const provider = getFootballProvider();
  if (!provider) return <FantasyUnavailable problem="not-configured" />;

  const feed = await getFantasyGameweek(provider);
  if (feed.status === 'unavailable') return <FantasyUnavailable problem={feed.problem} />;

  const standings = await provider.getStandings(feed.data.season.id);
  return <FantasyExperience initial={feed} standings={standings} />;
}
