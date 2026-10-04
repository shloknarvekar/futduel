import type { Metadata } from 'next';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { TIERS } from '@/lib/engine/progression';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description:
    'Climb six tiers from Sunday League to Legend against a fixed field of ranked managers.',
};

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-8">
        <p className="kicker mb-2">The ladder</p>
        <h1 className="text-[clamp(2.2rem,7vw,3.4rem)]">Ranks</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
          Every duel against an AI or a friend moves your rating by Elo, weighted a little by the
          margin. Six tiers, {TIERS[TIERS.length - 1]!.min} rating to reach the top one.
        </p>
      </header>

      <LeaderboardTable />
    </div>
  );
}
