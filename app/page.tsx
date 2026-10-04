import Link from 'next/link';
import { ArrowUpRight, Swords } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { HeroWheel } from '@/components/home/HeroWheel';
import { IDENTITIES } from '@/lib/data/players';
import { getFootballProvider } from '@/lib/football/provider';
import { NextUpFixtures } from '@/components/home/NextUpFixtures';
import { FeaturesSectionWithHoverEffects } from '@/components/ui/feature-section-with-hover-effects';

/**
 * Re-rendered at most once a minute, so real fixtures on the page stay close
 * to the provider's; the fixture list also refreshes itself in the browser.
 */
export const revalidate = 60;

/** A section heading with a rule, used everywhere below the fold. */
function Rule({ label, title, href, cta }: { label: string; title: string; href?: string; cta?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        <p className="kicker mb-2">{label}</p>
        <h2 className="text-[clamp(1.9rem,5vw,3rem)]">{title}</h2>
      </div>
      {href && cta ? (
        <Link
          href={href}
          className="meta group inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-[var(--color-home)]"
        >
          {cta}
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  // Real fixtures only. With no provider configured the section is left out
  // entirely: there is no generated or old schedule to fall back to.
  const provider = getFootballProvider();
  const fixtures = provider ? await provider.getUpcomingFixtures() : null;

  return (
    <>
      {/* ------------------------------------------------------------- Hero */}
      <HeroWheel footballers={IDENTITIES.length} />

      {/* ------------------------------------------------------- Features */}
      {/* The one explanation of the game: the loop, the categories and the
          depth behind them, in a single grid. */}
      <section className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <Rule label="Spin · Build · Duel" title="Everything that makes a FutDuel" href="/duel" cta="Spin for one" />
        <FeaturesSectionWithHoverEffects />
      </section>

      {/* ------------------------------------------------------- Fixtures */}
      {provider && fixtures ? (
        <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <Rule label="Real football" title="Next up" href="/fantasy" cta="Open fantasy" />
          <NextUpFixtures initial={fixtures} attribution={provider.attribution} />
        </section>
      ) : null}

      {/* ------------------------------------------------------- Final CTA */}
      <section className="relative overflow-hidden border-t border-border">
        <span
          aria-hidden="true"
          className="ghost-type absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(5rem,18vw,14rem)]"
        >
          Kick off
        </span>
        <div className="relative mx-auto max-w-[1240px] px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
          <h2 className="text-[clamp(2.4rem,8vw,4.5rem)] leading-[0.88]">
            Settle it
            <br />
            <span className="text-[var(--color-home)]">on the pitch</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[44ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
            No account, no sign-up, nothing to install. Your record lives in your own browser.
          </p>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/duel" size="lg" icon={<Swords className="size-4" aria-hidden="true" />}>
              Spin the wheel
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
