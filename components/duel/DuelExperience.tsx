'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AIDifficulty, Category, MatchResult, Squad } from '@/lib/domain/types';
import { requireCategory } from '@/lib/data/categories';
import { parseChallengeId } from '@/lib/data/challenges';
import { openingDraw, spin as spinWheel } from '@/lib/engine/wheel';
import { emptySquad, rateSquad } from '@/lib/engine/rating';
import { draftSquad, draftSquadAtLeast, pickOpponent } from '@/lib/engine/ai-manager';
import { simulateMatch } from '@/lib/engine/simulate';
import { isSeed, makeSeed } from '@/lib/engine/rng';
import type { BuildAssistance } from '@/lib/engine/picker';
import { ratingDelta } from '@/lib/engine/progression';
import {
  DECODE_MESSAGES,
  challengeUrl,
  decodeChallenge,
  decodeDuel,
  encodeChallenge,
  encodeDuel,
} from '@/lib/engine/share';
import { HISTORY_KEPT, REPLAY_PROBLEM_TEXT, historyKey, openReplay, replayProblem } from '@/lib/engine/history';
import { lineupsVisible } from '@/lib/engine/lineups';
import { useProfileStore } from '@/lib/store/profile';
import { ModeSelect, type CategoryPick, type DuelMode } from './stages/ModeSelect';
import { SpinStage } from './stages/SpinStage';
import { CategoryChooser } from './stages/CategoryChooser';
import { LineupsButton, type LineupSide } from './LineupsDialog';
import { BuildStage } from './stages/BuildStage';
import { HandoffStage } from './stages/HandoffStage';
import { ShareStage } from './stages/ShareStage';
import { KickoffStage } from './stages/KickoffStage';
import { MatchBroadcast } from './MatchBroadcast';
import { ResultPanel } from './ResultPanel';
import { DuelStepper } from './DuelStepper';
import { ErrorState } from '@/components/ui/primitives';
import { Button, ButtonLink } from '@/components/ui/Button';

type Phase =
  | 'mode'
  | 'spin-home'
  | 'spin-away'
  | 'choose-home'
  | 'choose-away'
  | 'build-home'
  | 'handoff'
  | 'build-away'
  | 'share'
  | 'kickoff'
  | 'broadcast'
  | 'result';

const STEP_FOR_PHASE: Record<Phase, 0 | 1 | 2> = {
  mode: 0,
  'spin-home': 0,
  'spin-away': 0,
  'choose-home': 0,
  'choose-away': 0,
  'build-home': 1,
  handoff: 1,
  'build-away': 1,
  share: 1,
  kickoff: 2,
  broadcast: 2,
  result: 2,
};

interface MatchSetup {
  seed: string;
  home: { name: string; squad: Squad; category: Category };
  away: { name: string; squad: Squad; category: Category };
}

const DIFFICULTY_NAME: Record<AIDifficulty, string> = { amateur: 'Amateur', pro: 'Pro', elite: 'Elite' };

/** A friend's squad is worth roughly this on the ladder when we have no record of them. */
function inferredRating(overall: number): number {
  return Math.round(900 + (overall - 70) * 22);
}

export function DuelExperience() {
  const params = useSearchParams();

  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);
  const registerSpin = useProfileStore((s) => s.registerSpin);
  const recordDuel = useProfileStore((s) => s.recordDuel);
  const completeChallenge = useProfileStore((s) => s.completeChallenge);

  const [phase, setPhase] = useState<Phase>('mode');
  const [mode, setMode] = useState<DuelMode>('solo');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('pro');
  const [homeName, setHomeName] = useState('You');
  const [awayName, setAwayName] = useState('Manager 2');
  const [userSide, setUserSide] = useState<'home' | 'away' | null>('home');

  const [seed, setSeed] = useState(() => makeSeed());
  const [homeCategory, setHomeCategory] = useState<Category | null>(null);
  const [awayCategory, setAwayCategory] = useState<Category | null>(null);
  const [homeSquad, setHomeSquad] = useState<Squad>(() => emptySquad('4-3-3'));
  const [awaySquad, setAwaySquad] = useState<Squad>(() => emptySquad('4-3-3'));
  const [result, setResult] = useState<MatchResult | null>(null);
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const [delta, setDelta] = useState<number | undefined>(undefined);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; floor: number } | null>(null);
  // Build assistance lasts for this visit to the arena: it carries across both
  // managers' builds and a fresh duel, and resets when the page is left. It is
  // a way of playing, not a profile setting.
  const [assistance, setAssistance] = useState<BuildAssistance>('guided');
  /** How the local manager's category was decided, kept on the history record. */
  const [categorySource, setCategorySource] = useState<CategoryPick | 'challenge'>('wheel');
  /** A history record waiting for the profile to load, from a `?history=` link. */
  const [pendingHistory, setPendingHistory] = useState<string | null>(null);
  /** Set while watching a duel from this browser's history rather than playing one. */
  const [replayOf, setReplayOf] = useState<string | null>(null);

  const recordedRef = useRef<string | null>(null);
  const importedRef = useRef(false);
  /** Set when a draw from the home page wheel opened this duel; the local manager's name follows once it loads. */
  const nameFromProfileRef = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // The manager name is NOT synced from the profile here. Doing so raced with
  // the URL import below: if the profile finished loading in the same tick, it
  // would overwrite the challenger's name with the local player's own. The
  // mode form owns that default instead.

  /* ------------------------------------------------------------- simulation */

  /**
   * Everything the match needs is passed in rather than read from state.
   * Several callers kick off a duel in the same tick that they set the names
   * and squads, and a closure over state would still be holding the previous
   * values at that point.
   */
  const runMatch = useCallback((input: MatchSetup) => {
    const outcome = simulateMatch({
      seed: input.seed,
      decisive: false,
      home: { ...input.home, rating: rateSquad(input.home.squad) },
      away: { ...input.away, rating: rateSquad(input.away.squad) },
    });
    setResult(outcome);
    setSetup(input);
    // The tie is fully simulated here. The kickoff screen and the broadcast
    // only ever replay this outcome — neither invents a single event.
    setPhase('kickoff');
  }, []);

  /* ---------------------------------------------------------------- imports */


  useEffect(() => {
    if (importedRef.current) return;
    const join = params.get('join');
    const watch = params.get('watch');
    const challengeParam = params.get('challenge');
    const draw = params.get('draw');
    const historyParam = params.get('history');
    if (!join && !watch && !challengeParam && !draw && !historyParam) return;
    importedRef.current = true;

    // A duel from this browser's own history. The record lives in the saved
    // profile, which loads a moment after mount, so it opens once that has.
    if (historyParam) {
      setPendingHistory(historyParam);
      return;
    }

    // A category drawn on the home page wheel. Only the seed travels; both
    // categories are drawn again here by the same engine call the arena makes,
    // so the builder always opens on exactly the category that was shown.
    if (draw) {
      if (!isSeed(draw)) {
        setLinkError('That draw link is not valid. Spin the wheel again for a fresh category.');
        return;
      }
      const opening = openingDraw(draw);
      setMode('solo');
      setUserSide('home');
      setDifficulty('pro');
      setSeed(draw);
      setHomeCategory(opening.home.category);
      setAwayCategory(opening.away.category);
      setAwayName(pickOpponent('pro', draw).name);
      setChallenge(null);
      setCategorySource('wheel');
      nameFromProfileRef.current = true;
      setPhase('build-home');
      return;
    }

    if (challengeParam) {
      const parsed = parseChallengeId(challengeParam);
      if (!parsed) {
        setLinkError('That challenge is no longer available. Pick another from the board.');
        return;
      }
      const challengeSeed = makeSeed();
      const opponentCategory = spinWheel(`${challengeSeed}:challenge`, { exclude: [parsed.categoryId] }).category;
      setMode('solo');
      setUserSide('home');
      setDifficulty(parsed.difficulty);
      setSeed(challengeSeed);
      setHomeCategory(requireCategory(parsed.categoryId));
      setAwayCategory(opponentCategory);
      setAwayName(pickOpponent(parsed.difficulty, challengeSeed).name);
      setChallenge({
        id: challengeParam,
        floor: parsed.difficulty === 'elite' ? 82 : parsed.difficulty === 'pro' ? 76 : 0,
      });
      setCategorySource('challenge');
      setPhase('build-home');
      return;
    }

    if (watch) {
      const decoded = decodeDuel(watch);
      if (!decoded.ok) {
        setLinkError(DECODE_MESSAGES[decoded.reason]);
        return;
      }
      setMode('friend');
      setUserSide(null);
      setSeed(decoded.payload.seed);
      setHomeName(decoded.payload.home.managerName);
      setAwayName(decoded.payload.away.managerName);
      setHomeCategory(requireCategory(decoded.payload.home.categoryId));
      setAwayCategory(requireCategory(decoded.payload.away.categoryId));
      setHomeSquad(decoded.payload.home.squad);
      setAwaySquad(decoded.payload.away.squad);
      runMatch({
        seed: decoded.payload.seed,
        home: {
          name: decoded.payload.home.managerName,
          squad: decoded.payload.home.squad,
          category: requireCategory(decoded.payload.home.categoryId),
        },
        away: {
          name: decoded.payload.away.managerName,
          squad: decoded.payload.away.squad,
          category: requireCategory(decoded.payload.away.categoryId),
        },
      });
      return;
    }

    const decoded = decodeChallenge(join!);
    if (!decoded.ok) {
      setLinkError(DECODE_MESSAGES[decoded.reason]);
      return;
    }
    setMode('friend');
    setUserSide('away');
    setSeed(decoded.payload.seed);
    setHomeName(decoded.payload.managerName);
    setHomeCategory(requireCategory(decoded.payload.categoryId));
    setHomeSquad(decoded.payload.squad);
    setPhase('spin-away');
  }, [params, runMatch]);

  // Open a duel from history. It shows the result that was saved when it was
  // played, never a fresh simulation, so a later data change cannot rewrite a
  // match that already happened. Nothing is recorded and no rating moves.
  useEffect(() => {
    if (!pendingHistory || !hydrated) return;
    setPendingHistory(null);
    const record = profile.history.find((entry) => historyKey(entry) === pendingHistory);
    if (!record) {
      setLinkError(`That duel is no longer in this browser’s history. The last ${HISTORY_KEPT} duels are kept.`);
      return;
    }
    const opened = openReplay(record);
    if (!opened) {
      setLinkError(REPLAY_PROBLEM_TEXT[replayProblem(record) ?? 'no-replay']);
      return;
    }
    const { replay, homeCategory: home, awayCategory: away } = opened;
    setMode(record.mode);
    setDifficulty(record.difficulty ?? 'pro');
    setUserSide(null);
    setReplayOf(pendingHistory);
    setSeed(replay.seed);
    setHomeName(replay.home.name);
    setAwayName(replay.away.name);
    setHomeCategory(home);
    setAwayCategory(away);
    setHomeSquad(replay.home.squad);
    setAwaySquad(replay.away.squad);
    setChallenge(null);
    setDelta(undefined);
    setResult(replay.result);
    setSetup({
      seed: replay.seed,
      home: { name: replay.home.name, squad: replay.home.squad, category: home },
      away: { name: replay.away.name, squad: replay.away.squad, category: away },
    });
    setPhase('kickoff');
  }, [pendingHistory, hydrated, profile.history]);

  useEffect(() => {
    if (phase === 'spin-away' && userSide === 'away' && hydrated) {
      setAwayName(profile.managerName);
    }
  }, [phase, userSide, hydrated, profile.managerName]);

  // The home page draw carries no name, and the one playing it is the local
  // manager — so, unlike a challenger's link, it takes the profile's name.
  useEffect(() => {
    if (!nameFromProfileRef.current || !hydrated) return;
    nameFromProfileRef.current = false;
    setHomeName(profile.managerName);
  }, [hydrated, phase, profile.managerName]);

  /* ------------------------------------------------------------ transitions */

  const startDuel = (config: {
    mode: DuelMode;
    difficulty: AIDifficulty;
    homeName: string;
    awayName: string;
    categorySource: CategoryPick;
  }) => {
    const nextSeed = makeSeed();
    setSeed(nextSeed);
    setMode(config.mode);
    setCategorySource(config.categorySource);
    setReplayOf(null);
    setDifficulty(config.difficulty);
    setHomeName(config.homeName);
    setUserSide(config.mode === 'local' ? null : 'home');
    setHomeCategory(null);
    setAwayCategory(null);
    setHomeSquad(emptySquad('4-3-3'));
    setAwaySquad(emptySquad('4-3-3'));
    setResult(null);
    setDelta(undefined);
    setChallenge(null);
    recordedRef.current = null;

    if (config.mode === 'solo') {
      setAwayName(pickOpponent(config.difficulty, nextSeed).name);
    } else if (config.mode === 'local') {
      setAwayName(config.awayName);
    } else {
      setAwayName('Your challenger');
    }
    setPhase(config.categorySource === 'chosen' ? 'choose-home' : 'spin-home');
  };

  const afterHomeSpin = () => {
    if (mode === 'friend' && userSide === 'home') {
      setPhase('build-home');
      return;
    }
    // Pass and play in choose mode: the second manager chooses too. An AI
    // opponent always spins for its category, whichever way you got yours.
    if (mode === 'local' && categorySource === 'chosen') {
      setPhase('choose-away');
      return;
    }
    setPhase('spin-away');
  };

  const afterAwaySpin = () => {
    if (userSide === 'away') {
      setPhase('build-away');
      return;
    }
    setPhase('build-home');
  };

  const confirmHomeSquad = () => {
    if (!homeCategory) return;

    if (mode === 'friend') {
      setPhase('share');
      return;
    }
    if (mode === 'local') {
      setPhase('handoff');
      return;
    }
    // Solo: the AI drafts against its own category, then we kick off.
    if (!awayCategory) return;
    const drafted = challenge
      ? draftSquadAtLeast(awayCategory, difficulty, seed, challenge.floor)
      : draftSquad(awayCategory, difficulty, seed);
    setAwaySquad(drafted);
    runMatch({
      seed,
      home: { name: homeName, squad: homeSquad, category: homeCategory },
      away: { name: awayName, squad: drafted, category: awayCategory },
    });
  };

  const confirmAwaySquad = () => {
    if (!homeCategory || !awayCategory) return;
    runMatch({
      seed,
      home: { name: homeName, squad: homeSquad, category: homeCategory },
      away: { name: awayName, squad: awaySquad, category: awayCategory },
    });
  };

  /* ------------------------------------------------------- result recording */

  const finishBroadcast = useCallback(() => {
    setPhase('result');
    if (!result || !homeCategory || !awayCategory) return;
    if (userSide === null) return; // pass-and-play does not move anyone's rating
    if (recordedRef.current === result.seed) return;
    recordedRef.current = result.seed;

    const homeRating = rateSquad(homeSquad);
    const awayRating = rateSquad(awaySquad);
    const own = userSide === 'home' ? homeRating : awayRating;
    const opponent = userSide === 'home' ? awayRating : homeRating;
    const ownGoals = userSide === 'home' ? result.homeGoals : result.awayGoals;
    const oppGoals = userSide === 'home' ? result.awayGoals : result.homeGoals;
    const outcome = result.winner === 'draw' ? 'draw' : result.winner === userSide ? 'win' : 'loss';

    const opponentLadder =
      mode === 'solo'
        ? pickOpponent(difficulty, seed).rating
        : inferredRating(opponent.overall);

    const change = ratingDelta(
      profile.rating,
      opponentLadder,
      outcome,
      ownGoals - oppGoals,
      profile.stats.played,
    );
    setDelta(change);

    const ownCategory = userSide === 'home' ? homeCategory : awayCategory;

    if (challenge && outcome === 'win') completeChallenge(challenge.id);

    recordDuel(
      {
        id: result.seed,
        playedAt: Date.now(),
        mode: mode === 'friend' ? 'friend' : mode === 'solo' ? 'solo' : 'local',
        home: {
          name: userSide === 'home' ? homeName : awayName,
          categoryName: ownCategory.name,
          goals: ownGoals,
          overall: own.overall,
        },
        away: {
          name: userSide === 'home' ? awayName : homeName,
          categoryName: (userSide === 'home' ? awayCategory : homeCategory).name,
          goals: oppGoals,
          overall: opponent.overall,
        },
        result: outcome,
        ratingDelta: change,
        difficulty: mode === 'solo' ? difficulty : undefined,
        categorySource,
        // Enough to show this duel again exactly as it was: both elevens as
        // they were locked, and the result as it was simulated.
        replay: setup
          ? {
              seed: setup.seed,
              home: { name: setup.home.name, categoryId: setup.home.category.id, squad: setup.home.squad },
              away: { name: setup.away.name, categoryId: setup.away.category.id, squad: setup.away.squad },
              result,
            }
          : undefined,
      },
      {
        cleanSheet: oppGoals === 0,
        goalsScored: ownGoals,
        wonOnPenalties: Boolean(result.shootout) && outcome === 'win',
        legendaryCategory: ownCategory.rarity === 'legendary',
        chemistry: own.chemistry,
        opponentOverall: opponent.overall,
        ownOverall: own.overall,
      },
    );
  }, [
    result, homeCategory, awayCategory, userSide, homeSquad, awaySquad, mode, difficulty, seed,
    profile.rating, profile.stats.played, recordDuel, homeName, awayName, challenge,
    completeChallenge, categorySource, setup,
  ]);

  /* ------------------------------------------------------------------ share */

  const challengeCode = useMemo(() => {
    if (!homeCategory) return '';
    try {
      return encodeChallenge({
        seed,
        categoryId: homeCategory.id,
        squad: homeSquad,
        managerName: homeName,
      });
    } catch {
      return '';
    }
  }, [homeCategory, homeSquad, homeName, seed]);

  const replyCode = useMemo(() => {
    if (!homeCategory || !awayCategory || userSide !== 'away') return '';
    try {
      return encodeDuel({
        seed,
        home: { seed, categoryId: homeCategory.id, squad: homeSquad, managerName: homeName },
        away: { seed, categoryId: awayCategory.id, squad: awaySquad, managerName: awayName },
      });
    } catch {
      return '';
    }
  }, [homeCategory, awayCategory, homeSquad, awaySquad, homeName, awayName, seed, userSide]);

  const handleWatchReply = (raw: string): string | null => {
    const code = raw.includes('watch=') ? decodeURIComponent(raw.split('watch=')[1] ?? '') : raw;
    const decoded = decodeDuel(code);
    if (!decoded.ok) return DECODE_MESSAGES[decoded.reason];
    setSeed(decoded.payload.seed);
    setAwayName(decoded.payload.away.managerName);
    setAwayCategory(requireCategory(decoded.payload.away.categoryId));
    setAwaySquad(decoded.payload.away.squad);
    setHomeSquad(decoded.payload.home.squad);
    setHomeCategory(requireCategory(decoded.payload.home.categoryId));
    setUserSide('home');
    const homeCat = requireCategory(decoded.payload.home.categoryId);
    const awayCat = requireCategory(decoded.payload.away.categoryId);
    runMatch({
      seed: decoded.payload.seed,
      home: { name: decoded.payload.home.managerName, squad: decoded.payload.home.squad, category: homeCat },
      away: { name: decoded.payload.away.managerName, squad: decoded.payload.away.squad, category: awayCat },
    });
    return null;
  };

  const rematch = () => {
    if (!homeCategory || !awayCategory) return;
    const nextSeed = makeSeed();
    setSeed(nextSeed);
    recordedRef.current = null;
    if (mode === 'solo') {
      const drafted = draftSquad(awayCategory, difficulty, nextSeed);
      setAwaySquad(drafted);
      runMatch({
        seed: nextSeed,
        home: { name: homeName, squad: homeSquad, category: homeCategory },
        away: { name: awayName, squad: drafted, category: awayCategory },
      });
    } else {
      runMatch({
        seed: nextSeed,
        home: { name: homeName, squad: homeSquad, category: homeCategory },
        away: { name: awayName, squad: awaySquad, category: awayCategory },
      });
    }
  };

  const resetToMode = () => {
    importedRef.current = true; // do not re-import from the URL after a reset
    setPhase('mode');
    setResult(null);
    setDelta(undefined);
    setHomeCategory(null);
    setAwayCategory(null);
    setUserSide('home');
    setChallenge(null);
    setReplayOf(null);
    recordedRef.current = null;
  };

  /* ---------------------------------------------------------------- lineups */

  // Both elevens are shown only once both are locked: `setup` exists from
  // kickoff on, and never while either manager is still building.
  const lineupRole = (side: 'home' | 'away'): string | undefined => {
    if (mode === 'solo') return side === 'home' ? 'You' : `AI manager, ${DIFFICULTY_NAME[difficulty]}`;
    if (mode === 'local') return side === 'home' ? 'Manager 1' : 'Manager 2';
    if (userSide === null) return undefined;
    return side === userSide ? 'You' : 'Your friend';
  };
  const lineups: { home: LineupSide; away: LineupSide } | null =
    setup && lineupsVisible(phase, true)
      ? {
          home: { ...setup.home, role: lineupRole('home') },
          away: { ...setup.away, role: lineupRole('away') },
        }
      : null;

  /* ------------------------------------------------------------------ views */

  if (linkError) {
    return (
      <ErrorState
        title="That link did not open"
        description={linkError}
        action={
          <Button onClick={() => { setLinkError(null); resetToMode(); }}>Start a fresh duel</Button>
        }
      />
    );
  }

  if (pendingHistory) {
    return (
      <p role="status" className="py-16 text-center text-sm text-[var(--color-ink-muted)]">
        Opening the duel from your history…
      </p>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <DuelStepper current={STEP_FOR_PHASE[phase]} />
        {phase !== 'mode' ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {lineups ? <LineupsButton home={lineups.home} away={lineups.away} /> : null}
            {replayOf ? (
              <ButtonLink variant="ghost" size="sm" href="/profile#history">
                Back to history
              </ButtonLink>
            ) : (
              <Button variant="ghost" size="sm" onClick={resetToMode}>
                Start over
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* Each stage is keyed so it remounts and replays its entrance. The
          animation is CSS, so a browser that never runs it still shows the
          stage at rest rather than leaving it at opacity zero. */}
      <div key={phase} className="stage-enter">
          {phase === 'mode' ? (
            <ModeSelect defaultName={hydrated ? profile.managerName : 'You'} onStart={startDuel} />
          ) : null}

          {phase === 'spin-home' ? (
            <SpinStage
              side="home"
              managerName={homeName}
              seed={seed}
              onResult={(category) => {
                setHomeCategory(category);
                registerSpin(category.id);
              }}
              onContinue={afterHomeSpin}
              continueLabel={mode === 'friend' ? 'Build your eleven' : 'Next spin'}
            />
          ) : null}

          {phase === 'spin-away' ? (
            <SpinStage
              side="away"
              managerName={awayName}
              seed={seed}
              exclude={homeCategory ? [homeCategory.id] : undefined}
              autoSpin={mode === 'solo'}
              onResult={(category) => {
                setAwayCategory(category);
                if (userSide === 'away') registerSpin(category.id);
              }}
              onContinue={afterAwaySpin}
              continueLabel={userSide === 'away' ? 'Build your eleven' : 'Start building'}
            />
          ) : null}

          {phase === 'choose-home' ? (
            <CategoryChooser
              side="home"
              managerName={homeName}
              opponentNote={
                mode === 'solo'
                  ? `${awayName} spins for theirs once you have chosen.`
                  : mode === 'friend'
                    ? 'Your friend spins for theirs when they open your link.'
                    : `${awayName} chooses next.`
              }
              continueLabel={mode === 'friend' ? 'Build your eleven' : 'Lock in my category'}
              onChoose={(category) => {
                setHomeCategory(category);
                afterHomeSpin();
              }}
            />
          ) : null}

          {phase === 'choose-away' ? (
            <CategoryChooser
              side="away"
              managerName={awayName}
              exclude={homeCategory ? [homeCategory.id] : []}
              excludedNote={`${homeName} has this one`}
              continueLabel="Start building"
              onChoose={(category) => {
                setAwayCategory(category);
                afterAwaySpin();
              }}
            />
          ) : null}

          {phase === 'build-home' && homeCategory ? (
            <BuildStage
              side="home"
              managerName={homeName}
              category={homeCategory}
              squad={homeSquad}
              onChange={setHomeSquad}
              onConfirm={confirmHomeSquad}
              seed={seed}
              assistance={assistance}
              onAssistanceChange={setAssistance}
              confirmLabel={
                mode === 'friend' ? 'Lock it in and get my link' : mode === 'local' ? 'Lock it in' : 'Kick off'
              }
            />
          ) : null}

          {phase === 'handoff' ? (
            <HandoffStage nextManager={awayName} onContinue={() => setPhase('build-away')} />
          ) : null}

          {phase === 'build-away' && awayCategory ? (
            <BuildStage
              side="away"
              managerName={awayName}
              category={awayCategory}
              squad={awaySquad}
              onChange={setAwaySquad}
              onConfirm={confirmAwaySquad}
              seed={seed}
              assistance={assistance}
              onAssistanceChange={setAssistance}
              confirmLabel="Kick off"
            />
          ) : null}

          {phase === 'share' ? (
            <ShareStage
              title="Send it to your friend"
              description={`Your eleven is locked under ${homeCategory?.name}. They will spin their own category and answer it on the same seed.`}
              url={challengeUrl(challengeCode, origin || 'https://futduel.app')}
              onWatchReply={handleWatchReply}
            />
          ) : null}

          {phase === 'kickoff' && setup ? (
            <KickoffStage
              isReplay={userSide === null}
              home={{
                name: setup.home.name,
                category: setup.home.category,
                squad: setup.home.squad,
                rating: rateSquad(setup.home.squad),
              }}
              away={{
                name: setup.away.name,
                category: setup.away.category,
                squad: setup.away.squad,
                rating: rateSquad(setup.away.squad),
              }}
              onWatch={() => setPhase('broadcast')}
              onSkip={finishBroadcast}
            />
          ) : null}

          {phase === 'broadcast' && result ? (
            <MatchBroadcast
              result={result}
              homeName={homeName}
              awayName={awayName}
              onComplete={finishBroadcast}
            />
          ) : null}

          {phase === 'result' && result && homeCategory && awayCategory ? (
            <div className="grid gap-6">
              <ResultPanel
                result={result}
                homeName={homeName}
                awayName={awayName}
                homeCategory={homeCategory}
                awayCategory={awayCategory}
                homeRating={setup ? rateSquad(setup.home.squad) : undefined}
                awayRating={setup ? rateSquad(setup.away.squad) : undefined}
                ratingDelta={delta}
                onRematch={replayOf ? undefined : rematch}
                onNewDuel={resetToMode}
                newDuelLabel={replayOf ? 'Start a new duel' : categorySource === 'chosen' ? 'Choose again' : 'Spin again'}
                onRewatch={setup ? () => setPhase('kickoff') : undefined}
              />

              {userSide === 'away' && replyCode ? (
                <ShareStage
                  title="Send the result back"
                  description="This link replays the identical match for whoever challenged you — same seed, same ninety minutes."
                  url={`${origin || 'https://futduel.app'}/duel?watch=${encodeURIComponent(replyCode)}`}
                />
              ) : null}
            </div>
          ) : null}
      </div>
    </div>
  );
}
