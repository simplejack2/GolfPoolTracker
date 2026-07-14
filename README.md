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

## Project layout

```
src/
  app/                  # Next.js routes, server actions, and UI
    actions/            # Server actions (auth, pools)
    login/, pools/       # Pages
  lib/
    auth/               # Dev-auth session cookie helpers
    db/                 # Prisma client singletons (app + test)
    scoring/            # Pure, unit-tested scoring engine (countBestN, cut handling, standings)
    data-adapter/        # Provider-agnostic live-score interface + mock provider
    pools/              # Pool CRUD + membership service layer (integration-tested)
prisma/
  schema.prisma         # Data model
  seed.ts               # Seeds a mock tournament + golfers for local dev
```

## Scoring engine

`src/lib/scoring` has no I/O — it's plain functions over plain data, so it's
fully covered by unit tests (`npm run test`) independent of any database or
live-score provider. `computeTeamScore` reduces a roster's per-golfer
results to a team total under a pool's `countBestN` and cut-penalty rules;
`computeStandings` ranks teams and breaks ties by best single counted
golfer.

## Live score data

No live provider is wired up yet. `src/lib/data-adapter` defines the
`GolfDataProvider` interface every provider (RapidAPI, etc.) must
implement, plus a `MockGolfDataProvider` with static fixture data so the
rest of the app can be built and tested before a provider is chosen.
Swapping providers later means writing one new class against that
interface — pool/scoring logic never changes.
