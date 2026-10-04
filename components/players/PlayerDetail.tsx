'use client';

import { useEffect, useId, useRef } from 'react';
import { ChevronDown, Crown, History, Medal } from 'lucide-react';
import type { Attributes, Player } from '@/lib/domain/types';
import { Modal } from '@/components/ui/Modal';
import { CLUB_BY_ID, LEAGUE_BY_ID } from '@/lib/data/clubs';
import { DATASET_AS_OF, SINCE_SNAPSHOT, versionsOf } from '@/lib/data/players';
import { DATA_PROVENANCE, RATING_WEIGHT_LABEL, coreScore } from '@/lib/engine/player-rating';
import { formatMoney } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { CardArt } from './CardArt';
import { ClubMark } from './ClubMark';
import { CardTypeTag, CollectibleCard, NationChip } from './PlayerCard';
import { CARD_TYPE_LABEL, CARD_TYPE_TOKEN, attributeLabels, attributeTone } from './player-visuals';
import { compareVersions } from '@/lib/engine/versions';

const KEYS: (keyof Attributes)[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];

const POSITION_NAME: Record<Player['position'], string> = {
  GK: 'goalkeeper',
  DEF: 'defender',
  MID: 'midfielder',
  FWD: 'forward',
};

/**
 * Opening a card.
 *
 * The card itself leads, large and lit in its club's colour, and the page
 * reads down from it in the order a collector asks: who, which kind of card,
 * which season, for whom, how good, what they do well, and why the card exists.
 * How the rating is computed is kept, but folded away at the end, where it
 * answers a question instead of ending the moment on a disclaimer.
 */
export function PlayerDetail({
  player,
  onClose,
  onSelectVersion,
}: {
  player: Player | null;
  onClose: () => void;
  /** Switch the open card to another version of the same footballer. */
  onSelectVersion?: (player: Player) => void;
}) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownId = useRef<string | null>(null);

  // Switching to another version replaces the whole dialog body, so focus is
  // placed on the new card's name, which announces the version just opened.
  // Opening the dialog itself is left to Modal's own focus handling.
  useEffect(() => {
    const id = player?.id ?? null;
    if (id && shownId.current && shownId.current !== id) headingRef.current?.focus();
    shownId.current = id;
  }, [player?.id]);

  if (!player) return null;

  const labels = attributeLabels(player);
  const club = CLUB_BY_ID.get(player.clubId);
  const league = LEAGUE_BY_ID.get(player.league);
  // Best version first, the same order that picks Discover's representative.
  const versions = [...versionsOf(player.identityId)].sort(compareVersions);
  const legend = player.era === 'legend';
  const accent = CARD_TYPE_TOKEN[player.cardType];
  const glow = club?.color ?? '#3a4a44';

  return (
    <Modal
      open={Boolean(player)}
      onClose={onClose}
      title={legend ? `${player.name}, ${player.season}` : player.name}
      size="xl"
      labelledBy={headingId}
    >
      <div className="relative" data-type={player.cardType}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 -top-10 h-[26rem] w-[26rem] max-w-full"
          style={{ background: `radial-gradient(closest-side, color-mix(in oklab, ${glow} 30%, transparent), transparent)` }}
        />

        <div className="relative grid gap-7 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-x-10 md:gap-y-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          {/* The card. */}
          <div className="order-0 md:col-start-1 md:row-start-1">
            <div className="fd-detail-card mx-auto w-[min(15rem,64vw)] md:w-full">
              <CollectibleCard key={player.id} player={player} />
            </div>
          </div>

          {/* Who, which version, how good. On a phone this wrapper dissolves
              (display: contents) so the honours and other versions can sit
              between the facts and the attributes instead of below everything. */}
          <div className="contents md:col-start-2 md:row-span-2 md:row-start-1 md:block md:min-w-0">
           <div className="order-1 min-w-0">
            <h2
              id={headingId}
              ref={headingRef}
              tabIndex={-1}
              className="pr-12 text-[clamp(2.4rem,6vw,3.75rem)] leading-[0.88] outline-none [text-wrap:balance]"
            >
              {player.name}
              <span className="sr-only">
                {legend ? `, ${player.season} ${player.club}` : `, ${player.club}, ${player.season} squad`}
              </span>
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CardTypeTag type={player.cardType} size="detail" showStandard />
              <span
                className={cn(
                  'meta inline-flex h-7 items-center gap-1.5 rounded-[3px] border px-2.5 text-[13px] font-bold leading-none',
                  legend
                    ? 'border-[color-mix(in_oklab,var(--color-archive)_60%,transparent)] text-[var(--color-ink)]'
                    : 'border-[var(--color-line-strong)] text-[var(--color-ink-soft)]',
                )}
              >
                {legend ? <History className="size-3.5" aria-hidden="true" /> : null}
                <span className="tnum">{player.season}</span>
                <span className="font-semibold text-[var(--color-ink-soft)]">
                  {legend ? 'Historical version' : 'Squad snapshot'}
                </span>
              </span>
              {player.prime ? (
                <span className="meta inline-flex h-7 items-center rounded-[3px] border border-[var(--color-line-strong)] px-2.5 text-[13px] font-bold leading-none text-[var(--color-ink-soft)]">
                  Prime years
                </span>
              ) : null}
            </div>

            <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[15px] text-[var(--color-ink-soft)]">
              <span aria-hidden="true" className="contents">
                <ClubMark clubId={player.clubId} size="sm" />
              </span>
              <span className="font-semibold text-[var(--color-ink)]">{club?.name ?? player.club}</span>
              <span aria-hidden="true" className="text-[var(--color-ink-muted)]">/</span>
              <span>{league?.name}</span>
              <span aria-hidden="true" className="text-[var(--color-ink-muted)]">/</span>
              <span className="inline-flex items-center gap-1.5">
                <NationChip code={player.nationCode} nation={player.nation} />
                {player.nation}
              </span>
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
              <div className="bg-[var(--color-surface)] px-4 py-3">
                <dt className="meta text-[12px] text-[var(--color-ink-muted)]">FutDuel rating</dt>
                <dd className="stat-figure mt-1.5 text-[2.6rem]" style={{ color: player.cardType === 'standard' ? 'var(--color-ink)' : accent }}>
                  {player.rating}
                </dd>
              </div>
              <div className="bg-[var(--color-surface)] px-4 py-3">
                <dt className="meta text-[12px] text-[var(--color-ink-muted)]">Plays</dt>
                <dd className="mt-2 font-[family-name:var(--font-condensed)] text-[1.35rem] font-bold leading-tight tracking-[0.02em]">
                  {player.roles.join(' · ')}
                </dd>
              </div>
              <div className="bg-[var(--color-surface)] px-4 py-3">
                <dt className="meta text-[12px] text-[var(--color-ink-muted)]">{legend ? `Age in ${player.season}` : 'Age'}</dt>
                <dd className="tnum mt-2 font-[family-name:var(--font-condensed)] text-[1.35rem] font-bold leading-tight">
                  {player.age}
                  <span className="ml-2 text-[14px] font-semibold text-[var(--color-ink-soft)]">
                    {player.foot === 'L' ? 'Left foot' : 'Right foot'}
                  </span>
                </dd>
              </div>
              <div className="bg-[var(--color-surface)] px-4 py-3">
                <dt className="meta text-[12px] text-[var(--color-ink-muted)]">Market value</dt>
                <dd className="tnum mt-2 font-[family-name:var(--font-condensed)] text-[1.35rem] font-bold leading-tight">
                  {player.value === null ? (
                    <span className="text-[15px] font-semibold text-[var(--color-ink-soft)]">Not valued</span>
                  ) : (
                    formatMoney(player.value)
                  )}
                </dd>
              </div>
            </dl>

           </div>

            <section aria-labelledby={`${headingId}-attributes`} className="order-3 min-w-0 md:mt-7">
              <h3
                id={`${headingId}-attributes`}
                className="font-[family-name:var(--font-condensed)] text-[15px] font-bold tracking-[0.08em] text-[var(--color-ink)]"
              >
                {player.position === 'GK' ? 'Goalkeeping' : 'Attributes'}
              </h3>
              <ul className="mt-3 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                {KEYS.map((key) => {
                  const value = player.attributes[key];
                  return (
                    <li key={key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[14px] text-[var(--color-ink-soft)]">
                          {labels.full[key]}
                          <span className="meta ml-2 text-[12px] text-[var(--color-ink-muted)]" aria-hidden="true">
                            {labels.short[key]}
                          </span>
                        </span>
                        <span
                          className="tnum font-[family-name:var(--font-condensed)] text-[20px] font-bold leading-none"
                          style={{ color: attributeTone(value) }}
                        >
                          {value}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-[1px] bg-[var(--color-surface-3)]" aria-hidden="true">
                        <div
                          className="h-full origin-left rounded-[1px]"
                          style={{
                            width: `${Math.max(4, value)}%`,
                            background:
                              player.cardType === 'standard'
                                ? 'linear-gradient(90deg, var(--color-ink-muted), var(--color-ink-soft))'
                                : `linear-gradient(90deg, color-mix(in oklab, ${accent} 45%, transparent), ${accent})`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <details className="group order-4 min-w-0 rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface-2)] md:mt-7">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[14px] font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
                How FutDuel rates this card
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-[var(--color-line)] px-4 py-3.5">
                <dl className="grid gap-2.5 text-[13px] leading-snug">
                  {(['identity', 'attributes', 'rating'] as const).map((key) => (
                    <div key={key} className="grid grid-cols-[5.5rem_1fr] gap-3">
                      <dt className="font-semibold text-[var(--color-ink-soft)]">{DATA_PROVENANCE[key].label}</dt>
                      <dd className="text-[var(--color-ink-muted)]">{DATA_PROVENANCE[key].detail}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 max-w-[68ch] border-t border-[var(--color-line)] pt-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                  Weighting for a {POSITION_NAME[player.position]}: {RATING_WEIGHT_LABEL[player.position]}. That
                  gives a weighted score of{' '}
                  <span className="tnum text-[var(--color-ink-soft)]">
                    {coreScore(player.position, player.attributes).toFixed(1)}
                  </span>
                  , calibrated to a rating of <span className="tnum text-[var(--color-ink-soft)]">{player.rating}</span>.{' '}
                  {legend
                    ? `This historical version describes the ${player.season} season.`
                    : SINCE_SNAPSHOT[player.id]
                      ? `This card describes the ${player.season} season. ${SINCE_SNAPSHOT[player.id]!.source}`
                      : `${DATASET_AS_OF}.`}
                </p>
              </div>
            </details>
          </div>

          {/* Why the card exists, and its other versions. */}
          <div className="order-2 grid min-w-0 content-start gap-5 md:order-none md:col-start-1 md:row-start-2">
            {player.cardReason ? (
              <figure
                className="relative overflow-hidden rounded-[4px] border px-4 py-4"
                style={{
                  borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`,
                  background: `linear-gradient(160deg, color-mix(in oklab, ${accent} 10%, var(--color-surface)), var(--color-surface) 70%)`,
                }}
              >
                <figcaption
                  className="meta flex items-center gap-2 text-[13px] font-bold"
                  style={{ color: accent }}
                >
                  {player.cardType === 'icon' ? (
                    <Crown className="size-4" aria-hidden="true" />
                  ) : (
                    <Medal className="size-4" aria-hidden="true" />
                  )}
                  {/* Icon status belongs to the footballer, so its honours span the career, not this season. */}
                  {player.cardType === 'icon' ? 'Icon · career honours' : `${league?.name ?? 'League'} Hero`}
                </figcaption>
                <p className="mt-2 text-[15px] leading-snug text-[var(--color-ink)]">{player.cardReason}</p>
              </figure>
            ) : legend ? (
              <p className="rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-[14px] leading-snug text-[var(--color-ink-soft)]">
                A historical version. Club, age and attributes describe {player.name.split(' ').slice(-1)[0]} in{' '}
                {player.season}.
              </p>
            ) : null}

            {versions.length > 1 ? (
              <section aria-labelledby={`${headingId}-versions`}>
                <h3
                  id={`${headingId}-versions`}
                  className="font-[family-name:var(--font-condensed)] text-[15px] font-bold tracking-[0.08em] text-[var(--color-ink)]"
                >
                  Every version <span className="tnum text-[var(--color-ink-muted)]">{versions.length}</span>
                </h3>
                <ul className="mt-2.5 grid gap-2">
                  {versions.map((version) => {
                    const current = version.id === player.id;
                    const inner = (
                      <>
                        <span
                          className="relative block h-12 w-9 shrink-0 overflow-hidden rounded-[2px] border border-[var(--color-line-strong)]"
                          data-era={version.era}
                        >
                          <CardArt
                            player={version}
                            showNumber={false}
                            className={cn('absolute inset-0 size-full', version.era === 'legend' && 'saturate-[0.7] sepia-[0.2]')}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="tnum font-[family-name:var(--font-condensed)] text-[16px] font-bold leading-none">
                              {version.era === 'legend' ? version.season : `${version.season} squad`}
                            </span>
                            <CardTypeTag type={version.cardType} size="row" />
                          </span>
                          <span className="mt-1 block truncate text-[13px] text-[var(--color-ink-soft)]">{version.club}</span>
                        </span>
                        <span className="stat-figure shrink-0 text-[22px]">{version.rating}</span>
                      </>
                    );
                    return (
                      <li key={version.id}>
                        {onSelectVersion && !current ? (
                          <button
                            type="button"
                            onClick={() => onSelectVersion(version)}
                            aria-label={`${version.era === 'legend' ? version.season : `${version.season} squad,`} ${version.club}${version.cardType === 'standard' ? '' : `, ${CARD_TYPE_LABEL[version.cardType]} card`}, rated ${version.rating}. Open this version.`}
                            className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1.5 text-left transition-colors hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-2)]"
                          >
                            {inner}
                          </button>
                        ) : (
                          <div
                            aria-current={current || undefined}
                            className={cn(
                              'flex min-h-14 items-center gap-3 rounded-[4px] border px-2.5 py-1.5',
                              current
                                ? 'border-[var(--color-ink-soft)] bg-[var(--color-surface-2)]'
                                : 'border-[var(--color-line)] bg-[var(--color-surface)]',
                            )}
                          >
                            {inner}
                            {current ? <span className="sr-only">Showing this version</span> : null}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
