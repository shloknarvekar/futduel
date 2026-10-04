import type { Metadata } from 'next';
import { challengesFor } from '@/lib/data/challenges';
import { ChallengeBoard } from '@/components/challenges/ChallengeBoard';

export const metadata: Metadata = {
  title: 'Challenges',
  description:
    'Four fixed briefs each week, each with a hard AI opponent waiting. Clear them for rating.',
};

// The board rotates weekly, so a day of caching is plenty.
export const revalidate = 86400;

export default function ChallengesPage() {
  const challenges = challengesFor(new Date());

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-8">
        <p className="kicker mb-2">This week</p>
        <h1 className="text-[clamp(2.2rem,7vw,3.4rem)]">Challenges</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[var(--color-ink-muted)]">
          No wheel here. The category is fixed, the opponent is picked to be awkward, and the
          harder briefs guarantee a strong eleven on the other side. The board rotates every week.
        </p>
      </header>

      <ChallengeBoard challenges={challenges} />
    </div>
  );
}
