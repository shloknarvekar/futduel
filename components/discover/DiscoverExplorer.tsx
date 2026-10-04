'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Crown, History, Medal, Search, SlidersHorizontal } from 'lucide-react';
import type { LeagueId, Player } from '@/lib/domain/types';
import { CURRENT_PLAYERS, DATASET_SEASON, IDENTITIES, LEGEND_PLAYERS, PLAYERS } from '@/lib/data/players';
import { footballerCount, onePerFootballer } from '@/lib/engine/versions';
import { CLUBS, LEAGUES } from '@/lib/data/clubs';
import { CLUB_STRENGTH } from '@/lib/data/club-strength';
import { queryPool } from '@/lib/engine/filters';
import { CollectibleCard } from '@/components/players/PlayerCard';
import { PlayerDetail } from '@/components/players/PlayerDetail';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

const PAGE = 30;

const POSITIONS = [
  { value: 'ALL' as const, label: 'All' },
  { value: 'GK' as const, label: 'GK' },
  { value: 'DEF' as const, label: 'DEF' },
  { value: 'MID' as const, label: 'MID' },
  { value: 'FWD' as const, label: 'FWD' },
];

const SORTS = [
  { value: 'rating' as const, label: 'Rating' },
  { value: 'value' as const, label: 'Value' },
  { value: 'pace' as const, label: 'Pace' },
  { value: 'age' as const, label: 'Age', shortLabel: 'Age' },
  { value: 'name' as const, label: 'A–Z', shortLabel: 'A–Z' },
];

type Shelf = 'all' | 'current' | 'legend' | 'icon' | 'hero';

const SHELF_FILTER: Record<Shelf, (p: Player) => boolean> = {
  all: () => true,
  current: (p) => p.era === 'current',
  legend: (p) => p.era === 'legend',
  icon: (p) => p.cardType === 'icon',
  hero: (p) => p.cardType === 'hero',
};

// Counts are footballers, not cards: the collection shows one card per person.
const shelfCount = (shelf: Shelf) => footballerCount(PLAYERS.filter(SHELF_FILTER[shelf]));

const SHELVES: { value: Shelf; label: string; count: number }[] = [
  // Rarity first: on a phone the shelves scroll, and the two special kinds of
  // card should be visible without scrolling the row.
  { value: 'all', label: 'Everyone', count: shelfCount('all') },
  { value: 'icon', label: 'Icons', count: shelfCount('icon') },
  { value: 'hero', label: 'Heroes', count: shelfCount('hero') },
  // The snapshot's season, named: "this season" stops being true the day the
  // next one starts, and FutDuel has no way to know when that is.
  { value: 'current', label: `${DATASET_SEASON} squads`, count: shelfCount('current') },
  { value: 'legend', label: 'Historical', count: shelfCount('legend') },
];

/** The showcase hand: the best card of each kind, chosen from data, not by hand. */
const SHOWCASE = (() => {
  const best = (predicate: (p: Player) => boolean) =>
    [...PLAYERS].filter(predicate).sort((a, b) => b.rating - a.rating)[0];
  // Left, centre, right. The Hero sits on the right because a card's badge is
  // in its top-right corner, and the left card's corner is under the centre one.
  return [
    best((p) => p.era === 'current'),
    best((p) => p.cardType === 'icon'),
    best((p) => p.cardType === 'hero'),
  ].filter((p): p is Player => Boolean(p));
})();

function ClubGrid({ onPickClub }: { onPickClub: (clubId: string) => void }) {
  const rows = useMemo(
    () =>
      CLUBS.map((club) => {
        // The current squad only: a club card describes the club today.
        const squad = CURRENT_PLAYERS.filter((p) => p.clubId === club.id);
        const best = [...squad].sort((a, b) => b.rating - a.rating)[0];
        return { club, count: squad.length, best, strength: CLUB_STRENGTH.get(club.id) ?? 0 };
      }).sort((a, b) => b.strength - a.strength),
    [],
  );

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ club, count, best, strength }) => (
        <li key={club.id}>
          <button
            type="button"
            onClick={() => onPickClub(club.id)}
            className="group relative w-full cursor-pointer overflow-hidden rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)]"
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: club.color }} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[var(--color-ink)]">{club.name}</p>
                <p className="mt-1 truncate text-[12px] text-[var(--color-ink-muted)]">
                  {club.city} · est. {club.founded}
                </p>
              </div>
              <span className="tnum shrink-0 font-display text-xl leading-none text-[var(--color-ink-soft)]">
                {strength.toFixed(1)}
              </span>
            </div>
            <p className="mt-3 truncate text-[13px] text-[var(--color-ink-muted)]">
              <span className="tnum">{count}</span> in the {DATASET_SEASON} squad
              {best ? (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  best: {best.short}
                </>
              ) : null}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The shelves are the collection's first question: which kind of card. They
 * are a real radio group, and each shelf wears its own mark so Icons and Heroes
 * are findable without knowing what gold and silver stand for.
 */
function Shelves({ value, onChange }: { value: Shelf; onChange: (value: Shelf) => void }) {
  return (
    // One scrollable row on a phone, so the shelves never eat three rows of the
    // first screen; wrapping from the small breakpoint up.
    <div
      role="radiogroup"
      aria-label="Collection"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {SHELVES.map((shelf) => {
        const active = shelf.value === value;
        const Mark =
          shelf.value === 'icon' ? Crown : shelf.value === 'hero' ? Medal : shelf.value === 'legend' ? History : null;
        return (
          <label
            key={shelf.value}
            className={cn(
              'relative inline-flex h-11 shrink-0 cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-[4px] border px-3.5 text-[14px] font-semibold transition-[border-color,background-color,color] duration-200',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-home)]',
              active
                ? shelf.value === 'icon'
                  ? 'border-[var(--color-icon)] bg-[color-mix(in_oklab,var(--color-icon)_14%,transparent)] text-[var(--color-icon-bright)]'
                  : shelf.value === 'hero'
                    ? 'border-[var(--color-hero)] bg-[color-mix(in_oklab,var(--color-hero)_12%,transparent)] text-[var(--color-hero-bright)]'
                    : 'border-[var(--color-ink-soft)] bg-[var(--color-surface-3)] text-[var(--color-ink)]'
                : 'border-[var(--color-line-strong)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            <input
              type="radio"
              name="collection-shelf"
              value={shelf.value}
              checked={active}
              onChange={() => onChange(shelf.value)}
              className="sr-only"
            />
            {Mark ? <Mark className="size-4" aria-hidden="true" /> : null}
            {shelf.label}
            <span className="tnum text-[13px] font-medium text-[var(--color-ink-muted)]">{shelf.count}</span>
          </label>
        );
      })}
    </div>
  );
}

export function DiscoverExplorer() {
  const [tab, setTab] = useState<'players' | 'clubs'>('players');
  const [shelf, setShelf] = useState<Shelf>('all');
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<(typeof POSITIONS)[number]['value']>('ALL');
  const [league, setLeague] = useState<LeagueId | 'ALL'>('ALL');
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('rating');
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Player | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const focusIndex = useRef<number | null>(null);
  const cardRefs = useRef(new Map<number, HTMLButtonElement>());

  const deferredSearch = useDeferredValue(search);

  // Filter and sort every version, then keep one card per footballer: the best
  // version that matches, in the position its own values sort to.
  const results = useMemo(
    () =>
      onePerFootballer(
        queryPool(PLAYERS.filter(SHELF_FILTER[shelf]), { search: deferredSearch, position, league, sort }),
      ),
    [shelf, deferredSearch, position, league, sort],
  );

  const visible = results.slice(0, limit);
  const resetPage = () => setLimit(PAGE);
  const activeFilters = Number(position !== 'ALL') + Number(league !== 'ALL') + Number(sort !== 'rating');

  // "Show more" hands focus to the first new card, so a keyboard user lands on
  // what they asked for instead of staying on a button that moved.
  useEffect(() => {
    if (focusIndex.current === null) return;
    cardRefs.current.get(focusIndex.current)?.focus({ preventScroll: false });
    focusIndex.current = null;
  }, [limit]);

  const clearFilters = () => {
    setSearch('');
    setShelf('all');
    setPosition('ALL');
    setLeague('ALL');
    setSort('rating');
    resetPage();
  };

  return (
    <div>
      {/* Hero: the collection, shown as cards before it is described. */}
      <header className="relative grid items-center gap-8 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-12 lg:pb-12">
        <div className="min-w-0">
          <h1 className="text-[clamp(3rem,9vw,5.5rem)]">Discover</h1>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-soft)] sm:mt-4 sm:text-[16px]">
            <span className="tnum text-[var(--color-ink)]">{IDENTITIES.length}</span> footballers: {DATASET_SEASON}{' '}
            squads and <span className="tnum text-[var(--color-ink)]">{LEGEND_PLAYERS.length}</span> historical
            versions of the greats. One card per player here, every version one tap away.
          </p>
          <div className="mt-6">
            <Shelves
              value={shelf}
              onChange={(value) => {
                setShelf(value);
                setTab('players');
                resetPage();
              }}
            />
          </div>
        </div>

        <div
          className="relative mx-auto h-[12.5rem] w-full max-w-[27rem] sm:h-[20rem]"
          style={{ '--fan-w': 'clamp(7.25rem, 29vw, 12.25rem)' } as CSSProperties}
        >
          {SHOWCASE.map((player, index) => {
            const offset = index - 1;
            return (
              <div
                key={player.id}
                className="fd-fan__card"
                style={
                  {
                    '--fan-x': `calc(var(--fan-w) * ${offset * 0.62})`,
                    '--fan-y': offset === 0 ? '-0.9rem' : '0rem',
                    '--fan-r': `${offset * 9}deg`,
                    '--fan-delay': `${120 + Math.abs(offset) * 110}ms`,
                    zIndex: offset === 0 ? 2 : 1,
                  } as CSSProperties
                }
              >
                <CollectibleCard player={player} onSelect={setSelected} />
              </div>
            );
          })}
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Browse"
          options={[
            { value: 'players' as const, label: 'Cards' },
            { value: 'clubs' as const, label: 'Clubs' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'players' ? (
          <p className="tnum text-[14px] text-[var(--color-ink-soft)]" role="status" aria-live="polite">
            {results.length} {results.length === 1 ? 'footballer' : 'footballers'}
          </p>
        ) : null}
      </div>

      {tab === 'clubs' ? (
        <ClubGrid
          onPickClub={(clubId) => {
            setTab('players');
            setShelf('current');
            setSearch(CLUBS.find((c) => c.id === clubId)?.name ?? '');
            setPosition('ALL');
            setLeague('ALL');
            resetPage();
          }}
        />
      ) : (
        <>
          <div className="sticky top-16 z-30 -mx-4 mb-6 border-y border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-void)_90%,transparent)] px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-[4px] lg:border-x lg:px-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      resetPage();
                    }}
                    placeholder="Player, club or country"
                    aria-label="Search cards"
                    className="h-11 w-full rounded-[4px] border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] pl-10 pr-3 text-base text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-home)] lg:w-72"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  aria-controls="discover-filters"
                  icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
                >
                  Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
                </Button>
              </div>

              <div
                id="discover-filters"
                className={cn('flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex lg:flex-1 lg:items-center', filtersOpen ? 'flex' : 'hidden lg:flex')}
              >
                <Segmented
                  label="Position"
                  size="sm"
                  options={POSITIONS}
                  value={position}
                  onChange={(value) => {
                    setPosition(value);
                    resetPage();
                  }}
                />
                <Segmented
                  label="Sort by"
                  size="sm"
                  options={SORTS}
                  value={sort}
                  onChange={(value) => {
                    setSort(value);
                    resetPage();
                  }}
                  className="lg:ml-auto"
                />
              </div>
            </div>

            <div
              className={cn('mt-3 flex-wrap gap-x-1.5 gap-y-2', filtersOpen ? 'flex' : 'hidden lg:flex')}
              role="group"
              aria-label="Filter by league"
            >
              {[{ id: 'ALL' as const, name: 'All leagues' }, ...LEAGUES].map((item) => {
                const active = league === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setLeague(item.id as LeagueId | 'ALL');
                      resetPage();
                    }}
                    aria-pressed={active}
                    className={cn(
                      // 36px to look at, 44px to hit: the pseudo-element extends
                      // the target into the row gap instead of fattening the chip.
                      'relative h-9 cursor-pointer rounded-[4px] border px-3.5 text-[13px] font-semibold transition-colors',
                      "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
                      active
                        ? 'border-[var(--color-home)] bg-[color-mix(in_oklab,var(--color-home)_10%,transparent)] text-[var(--color-home)]'
                        : 'border-[var(--color-line-strong)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                    )}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>

          {results.length === 0 ? (
            <EmptyState
              title="No cards match"
              description="Nothing in the collection fits that combination. Try a broader search, another shelf, or clear the filters."
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <ul
                key={`${shelf}-${position}-${league}-${sort}`}
                className="grid grid-cols-2 gap-x-3 gap-y-6 pt-2 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5"
              >
                {visible.map((player, index) => (
                  <li
                    key={player.id}
                    className={index < PAGE ? 'fd-reveal' : 'fd-reveal-scroll'}
                    style={{ '--i': index } as CSSProperties}
                  >
                    <CollectibleCard
                      player={player}
                      onSelect={setSelected}
                      ref={(el) => {
                        if (el) cardRefs.current.set(index, el);
                        else cardRefs.current.delete(index);
                      }}
                    />
                  </li>
                ))}
              </ul>

              {results.length > visible.length ? (
                <div className="mt-10 flex flex-col items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      focusIndex.current = visible.length;
                      setLimit((n) => n + PAGE);
                    }}
                  >
                    Show {Math.min(PAGE, results.length - visible.length)} more
                  </Button>
                  <p className="tnum text-[13px] text-[var(--color-ink-muted)]">
                    {visible.length} of {results.length}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <PlayerDetail player={selected} onClose={() => setSelected(null)} onSelectVersion={setSelected} />
    </div>
  );
}
