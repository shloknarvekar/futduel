import { LOCK_LEAD_MS, SCORING_RULES, SQUAD_RULES } from '@/lib/engine/fantasy-scoring';

/**
 * FutDuel's scoring, stated in full. The statistics are real; the points are
 * FutDuel's own rules applied to them.
 */
export function ScoringRules({ attribution }: { attribution: string }) {
  return (
    <section aria-labelledby="scoring-rules" className="grid grid-cols-1 gap-6">
      <div className="border-b border-[var(--color-line)] pb-3">
        <h2 id="scoring-rules" className="text-[clamp(1.5rem,4vw,2rem)] leading-none">
          How points are scored
        </h2>
        <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
          Minutes, goals, assists, saves, goals conceded, cards, own goals and defensive actions come from the
          match data published by {attribution}. FutDuel turns them into points with the rules below. These are not the
          rules of any official fantasy game, and the provider&rsquo;s player ratings are never used as points. A
          statistic the provider has not published scores nothing.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full max-w-[40rem] border-collapse text-left text-[14px]">
          <caption className="sr-only">FutDuel fantasy scoring rules</caption>
          <thead>
            <tr className="border-b border-[var(--color-line-strong)]">
              <th scope="col" className="kicker py-2 pr-4 text-[11px] font-normal">
                Rule
              </th>
              <th scope="col" className="kicker w-20 py-2 text-right text-[11px] font-normal">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {SCORING_RULES.map((row) => (
              <tr key={row.rule} className="border-b border-[var(--color-line)]">
                <th scope="row" className="py-2.5 pr-4 font-normal text-[var(--color-ink)]">
                  {row.rule}
                </th>
                <td className="tnum py-2.5 text-right font-semibold text-[var(--color-ink)]">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid max-w-[70ch] list-disc gap-2 pl-5 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
        <li>Clean sheets and the win bonus count once a match is finished.</li>
        <li>Defensive actions are tackles, interceptions, clearances and blocked shots added together.</li>
        <li>
          If your captain&rsquo;s team has finished its matches and the captain played no minutes, the vice-captain
          scores double instead.
        </li>
        <li>
          Picks lock {LOCK_LEAD_MS / 60_000} minutes before a round&rsquo;s first kickoff. The eleven saved in this
          browser before then is the one that scores.
        </li>
        <li>
          An eleven is {SQUAD_RULES.size} players with no more than {SQUAD_RULES.maxPerTeam} from one team. There is
          no budget and there are no transfer limits.
        </li>
      </ul>
    </section>
  );
}
