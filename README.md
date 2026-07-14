# Golf Pool Tracker

A golf pool app: users draft a roster of golfers per team, a subset of
best scores count toward the team total, and standings update live during
a tournament.

See [`CLAUDE.md`](./CLAUDE.md) for the full product/architecture spec.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma ORM (PostgreSQL)
- Vitest for unit tests

## Getting started

Requires a local PostgreSQL server with two databases: one for the app,
one for integration tests.

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and TEST_DATABASE_URL
npx prisma migrate dev              # creates/updates the dev DB schema
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy  # test DB schema
npx prisma db seed                  # adds a mock tournament + golfers
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on
`/login`. Sign-in is a dev-only stub: any email works, no password (see
"Auth" in `CLAUDE.md`).

To use real tournament data instead of the mock, add `RAPIDAPI_KEY` (a
[Live Golf Data](https://rapidapi.com/slashgolf/api/live-golf-data) key)
to `.env`, then `npm run tournament:add -- <year>` to list that season's
tournaments and `npm run tournament:add -- <year> <tournId>` to add one.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Run the unit + integration test suite (Vitest) |
| `npx prisma studio` | Browse the database |
| `npx prisma migrate dev` | Apply schema changes to your dev database |
| `npx prisma db seed` | Seed a mock tournament + golfers |
| `npm run tournament:add -- <year> [tournId]` | List a season's schedule, or add a real tournament |
| `npm run poll` | Long-running loop syncing scores for LOCKED/LIVE pools |

## Project layout

```
src/
  app/                  # Next.js routes, server actions, and UI
    actions/            # Server actions (auth, pools, roster)
    login/, pools/       # Pages (incl. pools/[poolId]/roster pick page)
  lib/
    auth/               # Dev-auth session cookie helpers
    db/                 # Prisma client singletons (app + test)
    scoring/            # Pure, unit-tested scoring engine (countBestN, cut handling, standings)
    data-adapter/        # Provider-agnostic live-score interface + mock provider
    tournaments/        # Field + score ingestion (provider data -> Golfer/GolferScore rows)
    pools/              # Pool CRUD + membership service layer (integration-tested)
    roster/             # Roster/pick service (free pick, lock + rosterSize enforcement)
    leaderboard/        # Joins rosters + scores, runs the scoring engine, ranks teams
prisma/
  schema.prisma         # Data model
  seed.ts               # Seeds a mock tournament + golfers for local dev
scripts/
  add-tournament.ts     # Onboards a real tournament (no schedule-browsing UI yet)
  poll-live-scores.ts   # Long-running score poller for LOCKED/LIVE pools
```

## Scoring engine

`src/lib/scoring` has no I/O — it's plain functions over plain data, so it's
fully covered by unit tests (`npm run test`) independent of any database or
live-score provider. `computeTeamScore` reduces a roster's per-golfer
results to a team total under a pool's `countBestN` and cut-penalty rules;
`computeStandings` ranks teams and breaks ties by best single counted
golfer.

## Rosters & the tournament field

A pool is attached to a tournament; the commissioner syncs its field
(`Sync tournament field` on the pool page → `ingestField`, which upserts
`Golfer` rows from the data provider). Members then draft golfers on the
pick page (`/pools/[poolId]/roster`) up to the pool's roster size — free
pick, no draft order. Picks lock once the deadline passes or the pool
moves past its pre-tournament phase, enforced in the service layer, not
just the UI.

## Leaderboard

The commissioner clicks "Sync scores" on the pool page (or the poller
below does it automatically) to pull current scores from the data
provider (`ingestScores`) into `GolferScore` rows. The leaderboard page
(`/pools/[poolId]/leaderboard`) then joins each team's roster with their
golfers' latest scores, runs it through the scoring engine, and shows a
ranked table with an expandable per-golfer breakdown — cut/WD/DQ golfers
show their real score struck through and excluded (or penalized, under
`FIXED` mode) rather than disappearing. The leaderboard page itself
doesn't auto-refresh in the browser; reload to see a newer sync.

## Live score data

`src/lib/data-adapter` defines the `GolfDataProvider` interface every
provider must implement (`getField`, `getScores`), plus:

- `MockGolfDataProvider` — static fixture data, used when `RAPIDAPI_KEY`
  isn't set (local dev, tests).
- `RapidApiGolfProvider` — the live provider, targeting RapidAPI's
  ["Live Golf Data"](https://rapidapi.com/slashgolf/api/live-golf-data)
  (Slash Golf) API. Since that API needs both a `tournId` and a `year` to
  identify a tournament, a `Tournament.externalId` for this provider is
  the composite `"{year}:{tournId}"` (e.g. `"2025:006"`) — see
  `scripts/add-tournament.ts` for onboarding one.

`getDefaultGolfDataProvider()` picks between them based on whether
`RAPIDAPI_KEY` is set; sync actions and the polling script call that
rather than hard-coding a provider, so swapping providers later means
writing one new class — pool/scoring logic never changes.

`npm run poll` runs `scripts/poll-live-scores.ts`, a long-running loop
(interval `POLL_INTERVAL_SECONDS`, default 90s) that syncs scores for
every tournament backing a `LOCKED` or `LIVE` pool. It's a plain script
rather than a platform cron job since hosting isn't decided yet — run it
under whatever process manager the eventual deploy target uses.
