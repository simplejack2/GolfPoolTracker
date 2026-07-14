# Golf Pool Tracker — spec

A golf pool where users draft/select a roster of golfers per team, a
subset of best scores count toward the team total, and standings update
live during tournaments.

## Stack

- Next.js (App Router), TypeScript, Tailwind CSS
- Prisma ORM against PostgreSQL (`prisma/schema.prisma`)
- Vitest for unit tests
- Auth and hosting are not wired up yet (candidates: Supabase Auth/Clerk;
  Vercel) — decide when building the auth/deploy milestone, not before.

## Data model (`prisma/schema.prisma`)

`User` → `Pool` (owned) / `PoolMember` (joined pools) → `Roster` (picks) and
`Standing` (cached rank). `Tournament` → `Golfer` → `GolferScore` (one row
per golfer per round). See the schema file for exact fields; keep it as
the source of truth rather than duplicating field lists here.

## Scoring engine — `src/lib/scoring`

Pure, dependency-free functions. No DB or network access in this
directory — that's what makes it unit-testable in isolation and is the
most important invariant to preserve as it grows.

- `computeTeamScore(roster, rules)` — reduces a roster's per-golfer
  `toPar` results to a team total. `rules.countBestN` controls how many of
  the roster's scores count (best N, ascending toPar). `rules.cutPenalty`
  controls what happens to CUT/WD/DQ golfers: `{ mode: "DROP" }` removes
  them from consideration entirely; `{ mode: "FIXED", value }` adds a
  fixed number of strokes to their toPar but keeps them eligible. A golfer
  with `toPar: null` (hasn't teed off) is treated as even par.
- `computeStandings(teams)` — ranks teams by total toPar ascending,
  breaking ties by each team's best single counted golfer, using standard
  competition ranking (ties share a rank; the next rank skips, e.g.
  1, 1, 3).
- Stableford/match-play scoring is not implemented — `ScoringMode` exists
  as an enum for forward compatibility but only `STROKE_PLAY` has an
  engine today. Don't build the other modes speculatively; wait until a
  pool actually needs one.

When changing scoring rules, add/update tests in
`team-score.test.ts` / `standings.test.ts` first — this is the one part of
the app where a subtle bug silently produces wrong money-affecting
standings.

## Live score data — `src/lib/data-adapter`

`GolfDataProvider` is the interface (`getField`, `getScores`) every score
source must implement, returning data normalized to `TournamentField` /
`LiveRoundScore`. `MockGolfDataProvider` is a static in-memory
implementation for development and tests before a real provider is
chosen. When integrating a live provider (RapidAPI or similar):

1. Implement `GolfDataProvider` in a new file in this directory.
2. Do not change the interface shape to fit one provider's quirks — map
   the provider's raw response onto the existing normalized types inside
   the new class.
3. Nothing outside `data-adapter` should import a specific provider
   directly; consumers depend on the `GolfDataProvider` interface so the
   provider can be swapped later without touching pool/scoring code.

Poll live provider on a timer (60-120s during live rounds) rather than
per-request; cache aggressively. This isn't built yet.

## Build order

Follow this sequence rather than jumping ahead — each milestone assumes
the previous one is real and tested, not stubbed:

1. Repo scaffold, DB schema, auth, deploy skeleton (in progress)
2. Pool CRUD + membership + rules config
3. Golfer field ingestion + roster/pick page with lock
4. Scoring engine (done) wired to a mock/static tournament end-to-end
5. Live data adapter (real provider) + polling → real leaderboard
6. Standings, tiebreakers, commissioner admin tools
7. Polish: notifications, mobile layout, payments (optional)

## Conventions

- Keep `src/lib/scoring` and `src/lib/data-adapter` free of Next.js/React
  imports — they should be usable from a script, a cron job, or a test
  with no framework in the loop.
- Prefer adding a unit test over adding a comment when the scoring/data
  logic changes — tests document behavior more durably than prose.
- Don't add Stableford/match-play, salary-cap drafts, payments, or other
  build-order-later features until the milestone before them is actually
  done.
