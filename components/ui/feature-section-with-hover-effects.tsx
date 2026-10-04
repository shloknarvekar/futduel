import Link from 'next/link';
import {
  IconAdjustmentsBolt,
  IconBroadcast,
  IconCards,
  IconCategory,
  IconRotateClockwise2,
  IconShirtSport,
  IconSoccerField,
  IconSwords,
} from '@tabler/icons-react';
import type { Category } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { ACTIVE_CATEGORIES } from '@/lib/engine/category-pool';
import { FORMATIONS } from '@/lib/data/formations';
import { IDENTITIES, PLAYERS } from '@/lib/data/players';
import { HISTORY_KEPT } from '@/lib/engine/local-limits';

/**
 * One example of each kind of category the wheel holds: the first rare or
 * legendary one of every family, so the strip shows the range (a generation,
 * a competition, a style, a shape, a region, a club, a wildcard) and follows
 * the real pool as it changes.
 */
function categoryExamples(): Category[] {
  const firstOfGroup = new Map<Category['group'], Category>();
  for (const category of ACTIVE_CATEGORIES) {
    if (category.group === 'open' || category.rarity === 'standard' || firstOfGroup.has(category.group)) continue;
    firstOfGroup.set(category.group, category);
  }
  return [...firstOfGroup.values()];
}

/**
 * The homepage's one explanation of FutDuel. The first three cells are the
 * game itself, spin, build and duel, in order; the rest are what makes each
 * of those moves deep. Every cell opens the page where it lives, every claim
 * is something the game does today, and every number is read from the game
 * data so none of them can drift.
 */
export function FeaturesSectionWithHoverEffects() {
  const iconProps = { 'aria-hidden': true, stroke: 1.6, className: 'size-6' } as const;
  const examples = categoryExamples();
  const features = [
    {
      title: 'Spin the wheel',
      description: 'Draw a category or choose one. Its rules decide who you can pick, and it tilts the match.',
      icon: <IconRotateClockwise2 {...iconProps} />,
      href: '/duel',
    },
    {
      title: 'Build your XI',
      description: 'Fill eleven positions from the players your category allows. Chemistry rewards a shared club, country or league.',
      icon: <IconShirtSport {...iconProps} />,
      href: '/duel',
    },
    {
      title: 'Duel',
      description: 'Face an AI or a friend over ninety minutes simulated from a seed. AI and link duels move your rank.',
      icon: <IconSwords {...iconProps} />,
      href: '/duel',
    },
    {
      title: 'Categories',
      description: `${ACTIVE_CATEGORIES.length} in play, from leagues and generations to budgets and styles. Four a week become Challenges.`,
      icon: <IconCategory {...iconProps} />,
      href: '/challenges',
    },
    {
      title: 'Every era',
      description: `${IDENTITIES.length} footballers on ${PLAYERS.length} cards: today’s squads, Icons, Heroes and past seasons, all in Discover.`,
      icon: <IconCards {...iconProps} />,
      href: '/discover',
    },
    {
      title: 'Tactical shapes',
      description: `${FORMATIONS.length} formations, from 4-3-3 CAM to five at the back. Drag players to move or swap them.`,
      icon: <IconSoccerField {...iconProps} />,
      href: '/duel',
    },
    {
      title: 'Guided or Manual',
      description: 'Guided suggests players for every position and Quick Build fills all eleven at once. Manual leaves it to you.',
      icon: <IconAdjustmentsBolt {...iconProps} />,
      href: '/duel',
    },
    {
      title: 'Broadcast and replay',
      description: `Watch minute by minute with both lineups a tap away, and replay any of your last ${HISTORY_KEPT} duels.`,
      icon: <IconBroadcast {...iconProps} />,
      href: '/profile#history',
    },
  ];
  return (
    <>
      <ul className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => (
          <Feature key={feature.title} {...feature} index={index} />
        ))}
      </ul>

      {/* A few real categories by name, so "categories" means something before
          the first spin. A caption to the grid, not another set of cards. */}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-5 lg:mt-10">
        <p className="kicker shrink-0 text-[11px]" id="category-examples">
          On the wheel
        </p>
        {/* Every name carries its own mark, so a wrapped line on a phone
            starts like the others instead of with a stray separator. */}
        <ul
          aria-labelledby="category-examples"
          className="meta flex flex-wrap items-baseline gap-x-4 gap-y-1.5 text-[12px] text-foreground"
        >
          {examples.map((category) => (
            <li key={category.id} className="whitespace-nowrap">
              <span aria-hidden="true" className="mr-1.5 text-primary">
                ·
              </span>
              {category.name}
            </li>
          ))}
          <li className="whitespace-nowrap text-muted-foreground">
            <span aria-hidden="true" className="mr-1.5">
              ·
            </span>
            and {ACTIVE_CATEGORIES.length - examples.length} more
          </li>
        </ul>
      </div>
    </>
  );
}

const Feature = ({
  title,
  description,
  icon,
  href,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  index: number;
}) => {
  const id = `feature-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <li
      className={cn(
        'border-border',
        // One column: a rule between cells. Two: a rule down the middle and
        // between rows. Four: the original open grid, ruled between cells
        // with the outer edges left open top and bottom.
        index < 7 && 'max-md:border-b',
        index < 6 && 'md:max-lg:border-b',
        index % 2 === 0 && 'md:max-lg:border-r',
        'lg:border-r',
        (index === 0 || index === 4) && 'lg:border-l',
        index < 4 && 'lg:border-b',
      )}
    >
      <Link
        href={href}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className={cn(
          'group/feature relative flex h-full flex-col py-5 md:py-8 lg:py-10',
          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
        )}
      >
        {index < 4 && (
          <div className="pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-t from-accent to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100 group-focus-visible/feature:opacity-100" />
        )}
        {index >= 4 && (
          <div className="pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-b from-accent to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100 group-focus-visible/feature:opacity-100" />
        )}
        {/* On a phone the icon rides beside the title, top right, so eight
            cells stay a short read instead of a long scroll. */}
        <div className="z-10 px-6 text-muted-foreground transition-colors duration-200 group-hover/feature:text-primary group-focus-visible/feature:text-primary max-md:absolute max-md:right-0 max-md:top-5 md:relative md:mb-4 md:px-8 lg:px-10">
          {icon}
        </div>
        <div className="relative z-10 mb-2 px-6 max-md:pr-16 md:px-8 lg:px-10">
          <div className="absolute inset-y-0 left-0 h-6 w-1 origin-center rounded-br-full rounded-tr-full bg-[var(--color-line-strong)] transition-all duration-200 group-hover/feature:h-8 group-hover/feature:bg-primary group-focus-visible/feature:h-8 group-focus-visible/feature:bg-primary motion-reduce:transition-colors" />
          <h3
            id={`${id}-title`}
            className="inline-block text-[1.4rem] leading-6 text-foreground transition duration-200 motion-safe:group-hover/feature:translate-x-2 motion-safe:group-focus-visible/feature:translate-x-2"
          >
            {title}
          </h3>
        </div>
        <p
          id={`${id}-description`}
          className="relative z-10 max-w-xs px-6 text-[13px] leading-relaxed text-muted-foreground md:px-8 md:text-sm lg:px-10"
        >
          {description}
        </p>
      </Link>
    </li>
  );
};
