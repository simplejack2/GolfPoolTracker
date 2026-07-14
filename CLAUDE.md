# Golf Pool Tracker — spec

A golf pool where users draft/select a roster of golfers per team, a
subset of best scores count toward the team total, and standings update
live during tournaments.

## Stack

- Next.js (App Router), TypeScript, Tailwind CSS
- Prisma ORM against PostgreSQL (`prisma/schema.prisma`)
- Vitest for unit tests
- Auth is a placeholder dev-auth stub (`src/lib/auth/session.ts`), not real
  auth — see "Auth" below. Hosting isn't wired up yet (candidate: Vercel).

## Auth — `src/lib/auth`, `src/app/login`, `src/app/actions/auth.ts`

Email-only sign-in, no password: `devLogin` upserts a `User` by email and
stores the user id directly in an httpOnly cookie (`session.ts`). Good
enough to build and test pool membership against a real "current user."
Replace with Supabase Auth/Clerk by swapping `session.ts` and the login
page/action — nothing else reads the cookie directly, everything else
goes through `getCurrentUser()`/`getCurrentUserId()`.

## Local dev database

Postgres must be running locally (`pg_ctlcluster 16 main start` or your
platform's equivalent). Two databases: `golfpooltracker` (dev,
`DATABASE_URL`) and `golfpooltracker_test` (integration tests,
`TEST_DATABASE_URL`) — see `.env.example`. After schema changes:
`npx prisma migrate dev` (dev DB, generates a migration) then
`npx prisma migrate deploy` with `TEST_DATABASE_URL` set (test DB, no new
migration). `npx prisma db seed` upserts a mock tournament + golfers
(from `MockGolfDataProvider`) into whichever DB `DATABASE_URL` points at
— pools need a `tournamentId` to attach to, so run this before creating
pools locally.

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
implementation for development and tests. `RapidApiGolfProvider` is the
live provider — see below. `getDefaultGolfDataProvider()`
(`default-provider.ts`) is what consumers actually call: it returns
`RapidApiGolfProvider` when `RAPIDAPI_KEY` is set, else falls back to the
mock, so local dev/tests never need a key.

If integrating a *different* live provider later:

1. Implement `GolfDataProvider` in a new file in this directory.
2. Do not change the interface shape to fit one provider's quirks — map
   the provider's raw response onto the existing normalized types inside
   the new class.
3. Nothing outside `data-adapter` should import a specific provider
   directly; consumers depend on the `GolfDataProvider` interface (via
   `getDefaultGolfDataProvider()`) so the provider can be swapped without
   touching pool/scoring code.

### RapidApiGolfProvider (Slash Golf "Live Golf Data")

Targets `live-golf-data.p.rapidapi.com` — endpoints `/tournament` (field)
and `/leaderboard` (scores). Schema mapping was built from the
maintainer's own OpenAPI spec
(`github.com/slashgolf/slashgolf/blob/main/docs/openapi.yaml`), not
scraped docs; the spec is the ground truth if the two ever disagree with
what the live API actually returns.

Things worth knowing before touching this file:

- **Composite externalId.** This API needs both `tournId` and `year` to
  identify a tournament, but `GolfDataProvider.getField`/`getScores` take
  one externalId string (see convention #2 above — don't change the
  interface for this). So a `Tournament.externalId` for this provider is
  `"{year}:{tournId}"` (e.g. `"2025:006"`), parsed apart inside
  `parseExternalId()` and never exposed outside this file. The mock
  provider's externalId (`"mock-2026-classic"`) has no colon and is
  never routed through this class, so there's no collision.
- **`getScores` returns one row per golfer per call**, tagged with the
  leaderboard response's top-level `roundId` (the round currently being
  tracked) and `total` as the cumulative tournament-to-par — matching
  what `ingestScores`'s `(golferId, round)` upsert and the leaderboard's
  "latest round" lookup both expect. It does not walk each golfer's
  historical `rounds[]` into separate rows; that data exists in the raw
  response but nothing in this app uses per-round history yet.
- `total`/`scoreToPar` come back as strings ("E", "+3", "-5", or "--" for
  not-yet-started) — `parseToPar()` handles that; don't assume they're
  numeric.
- Provider status values (`active`/`complete`/`cut`/`wd`/`dq`) map to our
  `GolferStatus`; both `active` and `complete` (finished today's round,
  still competing) map to `ACTIVE` — `mapStatus()`.
- Rate limits (`429`) surface as a thrown error from `request()`, not a
  silent empty result — a poll iteration that fails logs and moves on
  (see the polling script) rather than crashing the process.

### Onboarding a real tournament

There's no schedule-browsing UI. `npx tsx scripts/add-tournament.ts <year>`
lists that season's tournaments (tournId + name + dates); re-run with a
`tournId` to upsert the `Tournament` row (externalId `"{year}:{tournId}"`)
and ingest its field in one step. Requires `RAPIDAPI_KEY`. Pick that
tournament in the pool-creation form afterward.

### Polling

`scripts/poll-live-scores.ts` is a long-running loop (`npm run poll`,
interval `POLL_INTERVAL_SECONDS`, default 90) that calls `ingestScores`
for every tournament backing a `LOCKED` or `LIVE` pool. It's a plain
script, not a platform cron job, because the deploy platform isn't
decided yet (build order milestone 1) — run it under whatever process
manager the eventual host uses. Without `RAPIDAPI_KEY` it polls the mock
provider harmlessly (nothing changes, since the mock's data is static).

## Field & score ingestion — `src/lib/tournaments`

`ingestField(tournamentId, provider, db)` pulls a tournament's field from a
`GolfDataProvider` and upserts `Golfer` rows keyed on
`(tournamentId, externalId)`. Idempotent — re-running updates name/worldRank
and adds newcomers, returning `{ created, updated, total }`. It's the single
place that turns provider field data into `Golfer` rows: `prisma/seed.ts`,
`scripts/add-tournament.ts`, and the commissioner "sync field" server action
(`syncFieldAction`) all go through it. The tournament must already exist and
have an `externalId`; ingestion throws rather than inventing one.
`syncFieldAction`/`syncScoresAction` both call `getDefaultGolfDataProvider()`
(see "Live score data" below) rather than a hard-coded provider.

`ingestScores(tournamentId, provider, db)` is the same pattern for scores:
upserts `GolferScore` rows keyed on `(golferId, round)` so re-syncing the
same round updates in place rather than duplicating. A provider row whose
golfer isn't in the field yet is skipped (not an error) — sync the field
first. `syncScoresAction` is the commissioner-only entry point; the polling
script (below) is the automated one.

## Rosters / picks — `src/lib/roster`

`getRoster`, `addPick`, `removePick` — same DI/integration-test pattern as
`src/lib/pools`. Currently **free pick only**: a member adds any golfer in the
tournament field up to `rosterSize`. Snake draft, salary cap, and tiered
selection from the build plan are deliberately not built — don't add them
until a milestone actually calls for one (the schema has no salary/tier
columns yet either).

Pick rules, all enforced server-side (not just in the UI, so a stale page
can't cheat):

- `isPicksLocked(pool)` is the lock gate: true if the pool status is
  `LOCKED`/`LIVE`/`COMPLETE`, or `lockAt` has passed. `addPick`/`removePick`
  both refuse once locked. This is exported and reused by the roster page to
  render read-only.
- A pick must be a golfer in the pool's own tournament (`ValidationError`
  otherwise), can't exceed `rosterSize` (`ConflictError`), and can't be a
  duplicate (unique `(poolMemberId, golferId)` → `ConflictError`).
- The roster page (`/pools/[poolId]/roster`) is member-only; non-members are
  redirected back to the pool page.

## Leaderboard — `src/lib/leaderboard`

`getLeaderboard(poolId, db)` is the join point between rosters, scores, and
the scoring engine: for each `PoolMember`, it takes each roster golfer's
*latest* `GolferScore` row (highest `round`; a golfer with no score yet
gets `toPar: null`, which the engine treats as even par) and runs the
result through `computeTeamScore`/`computeStandings` from `src/lib/scoring`,
using `pool.cutPenaltyMode`/`cutPenaltyValue` as the engine's `CutPenalty`.
Computed on every read, not cached — the `Standing` table in the schema
stays unused until read load actually justifies adding that cache; don't
wire it up speculatively.

One display nuance worth preserving if you touch this: under `DROP`
cut-penalty mode, `computeTeamScore` excludes a cut/WD/DQ golfer from
`result.contributions` entirely (that's how "drop" scoring works). But the
leaderboard's per-golfer breakdown is built from the member's full roster,
not from `contributions` alone — otherwise a dropped pick would silently
vanish from the UI instead of showing as crossed-out/uncounted with its
real (unpenalized) score. See `getLeaderboard`'s comment on
`contributionByGolferId` before changing this.

The leaderboard page (`/pools/[poolId]/leaderboard`) is member-only, same
gating as the roster page.

## Pool CRUD + membership — `src/lib/pools`

`pools.ts` (createPool, getPool, listPoolsForUser, updatePoolRules,
deletePool) and `membership.ts` (joinPool, leavePool, removeMember,
updateMemberTeamName, listPoolMembers) are Prisma-backed but
framework-agnostic — every function takes a `PrismaClient` as its last
param, defaulting to the shared singleton, so tests can pass
`createTestPrismaClient()` (`src/lib/db/test-client.ts`) instead. This is
also why they're integration-tested against a real local Postgres test DB
rather than unit-tested with a mock — Prisma's unique constraints,
cascades, and compound keys aren't worth re-implementing in a fake.

Rules worth knowing before changing this code:

- Creating a pool auto-joins the owner as a `PoolMember` (so the
  commissioner always has a team).
- `countBestN <= rosterSize` is enforced in `updatePoolRules` against the
  *merged* state (existing pool row + partial update), not just the
  fields present in a given update — a partial update that only touches
  `rosterSize` must still fail if it would leave the existing
  `countBestN` too high. Don't move this check back into the zod schema;
  a schema only sees the partial input, not the row it's merging into.
- `joinPool` requires `status === "OPEN"` and `lockAt` in the future;
  both are checked at join time, not just enforced by UI.
- The pool owner can't leave or be removed via `leavePool`/`removeMember`
  — only `deletePool` (which cascades members/rosters/standings via the
  schema's `onDelete: Cascade`) gets rid of an owner's pool.
- `cutPenaltyMode`/`cutPenaltyValue` feed the scoring engine's
  `CutPenalty` directly (see "Scoring engine" above). `FIXED` requires a
  value; that invariant is checked in `updatePoolRules` against the
  *merged* state, the same way as `countBestN <= rosterSize` — a partial
  update that only sends `cutPenaltyMode: "FIXED"` must still fail if the
  existing row has no `cutPenaltyValue`.

## Server Actions gotcha (Next.js 16 / Turbopack)

Do not mix a bare `<form action={someServerFunction}>` (a direct function
reference, no `useActionState`) with `useActionState`-driven forms in the
same layout tree. In this app, `SiteHeader`'s old plain `<form
action={logout}>` — rendered on every page since it's in the root layout
— caused a *different* form's `next-action` request header to resolve to
`logout`'s action id instead of its own, silently logging the user out
instead of running the intended mutation (e.g. `createPoolAction`). This
reproduced in a production build (`next build && next start`), not just
dev/HMR, so it isn't a Fast Refresh artifact. The fix: call the server
action directly from a client `onClick` handler (see
`src/app/logout-button.tsx`, `src/app/pools/[poolId]/confirm-button.tsx`)
instead of wiring it through a `<form action={...}>`. Keep all
non-trivial mutations going through `useActionState` forms (for pending
state and inline errors); for simple fire-and-confirm actions (delete,
leave, remove), call the bound server action from `onClick` rather than
adding another bare-reference `<form>`.

## Build order

Follow this sequence rather than jumping ahead — each milestone assumes
the previous one is real and tested, not stubbed:

1. Repo scaffold, DB schema, auth (dev-auth stub), deploy skeleton (deploy still pending)
2. Pool CRUD + membership + rules config (done)
3. Golfer field ingestion + roster/pick page with lock (done, free-pick only)
4. Scoring engine wired to a mock/static tournament end-to-end (done — see
   "Leaderboard" above)
5. Live data adapter (RapidAPI's Slash Golf "Live Golf Data") + polling
   script → real leaderboard (done — see "RapidApiGolfProvider", "Polling"
   above; no schedule-browsing UI, use `scripts/add-tournament.ts`)
6. Standings, tiebreakers, commissioner admin tools (tiebreaker — best
   single counted golfer — is already done in `computeStandings`; a
   dedicated commissioner admin view for score overrides is not built)
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
