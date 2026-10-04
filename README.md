# FutDuel

**Spin a category. Build the best eleven you can under it. Settle it over ninety simulated minutes.**

Two managers each spin a wheel for a football category — a league, a continent, an age bracket, a
budget cap. The category decides who you are allowed to pick *and* quietly bends the match engine
in its own direction. Then both elevens are simulated minute by minute from a shared seed, so the
same duel replays identically on any device.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No account, no API key, no database required. Real fixtures and
Fantasy need a live data provider; see [Live football data](#live-football-data-optional).

---

## What's in it

| Area | What it does |
|------|--------------|
| **Duel** | The flagship loop: spin → build → duel. Solo against AI managers, pass-and-play on one device, or a friend duel over a shareable link. |
| **Fantasy** | *Only with a live data provider.* Pick an eleven from the real current squads of one competition, with a captain and vice-captain, and score FutDuel points from real match statistics. Switched off, and out of the navigation, without one. |
| **Discover** | Search, filter and sort every footballer in the database: one card per player (their highest-rated version), with every other version one tap away. |
| **Challenges** | Four fixed briefs a week with a guaranteed-strong AI opponent behind each one. |
| **Ranks** | Elo-based ladder across six tiers, from Sunday League to Legend. |
| **Profile** | Rating, record, fourteen achievements, and your last fifty duels. |

---

## Architecture

```
app/                    Next.js App Router pages (mostly server components)
  api/football/         The browser's only door to live football data
components/
  duel/                 The flagship experience — wheel, pitch, broadcast, result
  fantasy/ players/     Feature components
  layout/ ui/           Shell and design-system primitives
lib/
  domain/types.ts       One vocabulary shared by engine, UI and storage
  data/                 Curated card dataset: players, historical versions, shirt numbers, clubs, categories
  engine/               Pure game logic — no React, no DOM, fully testable
  football/             Live football data: provider client, normaliser, cache, fantasy round (server-only)
  store/profile.ts      Local-first persistence (IndexedDB)
scripts/verify-data.ts  Data and engine integrity check
```

The rule that keeps this maintainable: **`lib/engine` is pure.** It imports no React and touches no
browser API, so the whole game can be exercised from Node — which is exactly what `npm run verify`
does.

### The engine

- **`rng.ts`** — seeded PRNG. Every duel is reproducible from its seed, which is what makes a shared
  challenge link trustworthy: both players see the same ninety minutes, goal for goal.
- **`filters.ts`** — resolves a declarative category filter into an eligible player pool, and grades
  how well a player fits a formation slot.
- **`rating.ts`** — turns an eleven into attack / midfield / defence / chemistry. Chemistry rewards
  squads that could plausibly have played together; playing people out of position costs you.
- **`simulate.ts`** — possession from midfield control, shot volume from attack against defence,
  then per-shot expected goals with a heavily skewed chance-quality distribution. Category modifiers
  scale each phase and a "chaos" weight controls how often the improbable happens.
- **`ai-manager.ts`** — drafts the spine first, then the flair. Difficulty controls how far down its
  own shortlist it will reach and how much it values chemistry.
- **`share.ts`** — compact, checksummed challenge codes. Decoding treats every field as hostile.

### Data

`lib/data/players.ts` ships a curated **2025/26** snapshot of Europe's top five leagues as compact
pipe-delimited rows, expanded at import time. Historical versions live in `lib/data/legends.ts`,
also in the five leagues — except for Icons whose peak was played elsewhere, such as Garrincha at
Botafogo. Those sit in an **Other leagues** bucket with calendar-year seasons (`1962`): it is not a
league filter in Discover, no league category draws from it, and it gives no league chemistry.
Three layers are kept strictly apart, and the player detail panel spells the split out:

| Layer | Source |
|-------|--------|
| **Identity** | Real world — name, club, league, nationality, position, age |
| **Attributes** | FutDuel editorial. Authored for balance, *not* measured from matches |
| **Rating** | Derived from the attributes by the model in `lib/engine/player-rating.ts` |

**There is no rating column in the dataset.** No free provider publishes player ratings, so rather
than inventing numbers and calling them real, ratings are computed: weight the six attributes by
position to get a *core* score, then map that onto the rating scale with a per-position linear
calibration. Positions are calibrated separately because their attribute mixes sit on different
natural scales — a single shared curve rated every goalkeeper several points above an equivalent
outfielder. Change an attribute and the rating moves; nothing is hand-typed.

Goalkeepers reuse the six attribute slots as reflexes / handling / kicking / speed / positioning /
aerial, and the UI relabels them accordingly.

**Known limit:** the roster reflects the 2025 transfer windows. Moves completed after that — the
2026 summer window included — are not represented, and the UI says "Squads as of the 2025/26
season" rather than implying the data is live.

**Versions and shirt numbers.** A footballer can have several cards (a current-squad card and
historical seasons). Every version stays in the database and in the duel pools; Discover groups them
by `identityId` and shows the highest-rated one (ties: Icon over Hero over standard, then the newer
season, then id), and the player detail lists them all. The big number on a card is the shirt number
worn in that version, from `lib/data/shirt-numbers.ts`, only where it could be verified. Anything
uncertain is `null` and the shirt is left blank rather than guessed.

### Live football data (optional)

The card game never needs live data. Real-world fixtures and Fantasy do, and FutDuel will not stand
in for them with generated, projected or old information.

| | Without a provider | With a provider |
|---|---|---|
| Home "Next up" | Section left out | Real fixtures for the next seven days, live scores while matches are on |
| Fantasy | "Fantasy is switched off", no data, removed from the navigation | Current season, round, deadline, fixtures, squads, injuries, points |

The provider is the [Sportmonks Football API v3](https://docs.sportmonks.com/football). Add a token
(see `.env.example` for every variable):

```bash
cp .env.example .env.local
# SPORTMONKS_API_TOKEN=your_token
# SPORTMONKS_LEAGUE_IDS=8          # Premier League; your plan must cover the ids
# SPORTMONKS_FANTASY_LEAGUE_ID=8
```

On Vercel: `vercel env add SPORTMONKS_API_TOKEN` for each environment, then redeploy. The variables
must be present at build time, because the navigation is rendered then.

**Flow.** Browser → `app/api/football` (two fixed resources, `fixtures` and `fantasy`; no pass-through
of paths or parameters) → `lib/football/provider.ts` → Sportmonks → `lib/football/normalize.ts` →
FutDuel's own types. Pages render the first response on the server; client components only ever
call FutDuel's route. The token is read server-side only (`server-only` modules) and never serialised.

**Endpoints used.** `fixtures/between/{from}/{to}` (with `participants;scores;state;league` and, for
fantasy rounds, `lineups.details`), `leagues/{id}?include=currentSeason`, `rounds/seasons/{id}`,
`teams/seasons/{id}?include=players.player;sidelined`, `standings/seasons/{id}?include=participant`.
The season and round are detected from the provider every time; nothing is hardcoded.

**Caching** (in memory, per server instance, `lib/football/cache.ts`):

| Data | Fresh for |
|------|-----------|
| Upcoming fixtures | 30 s while a match is live or about to start, 5 min otherwise |
| Round fixtures and player statistics | 1 min while live, 10 min otherwise, 6 h once the round is settled |
| Standings | 10 min |
| Rounds | 30 min |
| Current season, squads and injuries | 6 h |

Concurrent requests share one upstream call, and failures back off (2 min after a 429).

**Data states.** Every response is a feed in exactly one state:

- **Live**: fetched inside its freshness window. Shown with its age and the attribution.
- **Stale**: the provider is failing, so the last good response is shown, labelled "Not current",
  with when it was fetched and why, for a bounded time only.
- **Unavailable**: nothing true to show. The UI says so and shows no data.

The browser re-judges a live feed against its age, so a cached page cannot present an old response
as current.

**Fantasy scoring.** The statistics are the provider's; the points are FutDuel's own rules, documented
in `lib/engine/fantasy-scoring.ts` and on the Fantasy page, and are not any official fantasy game's.
The provider's player rating is never used as a score. There are no prices, budget or transfers.
Picks are stored in the browser and lock 90 minutes before a round's first kickoff.

**Local testing without a quota.** `node scripts/mock-sportmonks.mjs` serves clearly synthetic data
in the provider's response shape. With `SPORTMONKS_BASE_URL=http://127.0.0.1:4010/v3/football` under
`npm run dev` (the override is ignored in production), FutDuel exercises the live path; the mock's
`/__mode/error`, `/__mode/ratelimit` and `/__mode/unauthorised` switches exercise the failure states.

### Persistence

Everything personal lives in the player's own browser via IndexedDB, read only after mount so the
server-rendered markup and the first client render always agree. There is no account and nothing is
uploaded.

---

## Design

Black, white and one blue-violet, in a light mode and a dark mode. **The home side carries the
violet and the away side is neutral ink**, on the pitch, in the scoreline, in the stat bars — the
opponent is the opponent, not a second brand colour.

The home page leads with the photographs in `Football/` (copied into `public/image-stream/`): a
corridor of them rushing out of the wheel's centre, with the statement above and the draw beneath.
The wheel is still the game — the corridor is the room it is played in.

- **Type** — Geist for UI, Geist Mono for codes and timers, Noto Serif Georgian for the home
  standfirst, and Anton and Barlow Condensed for the broadcast display and label roles. Every number
  that can change is set in tabular figures so nothing jitters.
- **Tokens** — the semantic theme lives in `:root` and `.dark` in `app/globals.css` and reaches
  Tailwind through one `@theme inline` block. FutDuel's own names (ink, surface, line, home, away)
  are *derived* from it rather than holding colours of their own, so there is one source of truth.
  Components reference semantic tokens, never raw hex.
- **Modes** — the mode is set on `<html>` before the first paint and follows the system until the
  header's toggle stores a choice. Physical objects — the wheel, the collectible cards, the pitch —
  stay dark in both modes, the way a printed card is the same card on a white desk.
- **Icons** — one family (Lucide), consistent stroke weight, no emoji.
- **Motion** — purposeful and interruptible. The wheel's landing position is computed by the engine
  and the animation is told where to stop, never the other way around.

### Accessibility

- Every interactive target clears 44px, including the small button size.
- Visible focus rings everywhere; the skip link is the first tab stop.
- The modal moves focus in, traps Tab, restores focus on close, and always accepts Escape.
- Colour is never the only signal — goals carry a text label, live fixtures say "Live", stale data
  says "Not current", out-of-position warnings carry an icon and a sentence.
- **Entrance animations are never load-bearing.** Under reduced motion, reveals render at rest
  rather than animating a shorter fade, so content can never be stranded at `opacity: 0` by an
  animation that does not run.

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run verify` | Data and engine integrity check |
| `npm run typecheck` | `tsc --noEmit` |

`npm run verify` is the interesting one. Categories are checked, not trusted: every category must
field a **legal eleven** — eleven different footballers, a keeper in goal, every slot a natural or
adjacent fit in some formation — found by an exact matching rather than a greedy draft, and
re-checked from first principles. A category that fails is kept out of the wheel, challenges,
challenge codes and listings (`lib/engine/category-pool.ts`) and fails the build. Age categories
must admit current-season cards only (`currentEraOnly`), so a historical card can never qualify
through the age it had in a past season. The old Iron Wall, Ball Winners and Back Line rules, and
unwrapped age rules, are rebuilt as fixtures and must be refused.

It also drafts an eleven for every category at every difficulty, checks that Guided and Manual
build assistance find exactly the same eligible players, samples the simulator's scoreline
distribution, asserts that a seed replays identically, and round-trips challenge codes including
malformed input.

```
Simulator (200 duels between evenly matched pro squads)
  goals per match 2.55  draws 23%  home wins 45%  busiest 7 goals
```

The home/away split in that sample is draft variance across 200 fixed seeds, not a
thumb on the scale: run the same two elevens against each other 4,000 times and the
engine splits 36.0% / 37.0% / 27.0%.

---

## Security notes

- Content Security Policy, `nosniff`, `frame-ancestors 'none'` and a restrictive permissions policy
  are set in `next.config.mjs`.
- The provider token is read only in `server-only` modules and never serialised into a payload.
  Upstream error bodies are never forwarded; logs carry only the path and status code.
- `/api/football` accepts two fixed resource names and nothing else, rate-limits per IP, and sends
  `Cache-Control: no-store`. The dev-only base-URL override accepts loopback addresses only.
- Challenge codes are untrusted input: indices are range-checked against the local dataset, the
  squad must match its formation exactly, duplicate players are rejected, and manager names are
  length-capped and stripped of control characters and bidi overrides before rendering.
- A dataset fingerprint is embedded in each code, so a code built on a different player database
  is refused with a clear explanation instead of silently loading the wrong eleven.

---

## Licence and attribution

Card ratings, values and attributes are FutDuel's own editorial work on the 2025/26 squads and on
past seasons. This project is not affiliated with, endorsed by, or sourced from any club, league, or
licensed football game. Club names are used descriptively; no club crests or trademarks are bundled.
Live fixtures, squads and match statistics, when configured, come from Sportmonks.
