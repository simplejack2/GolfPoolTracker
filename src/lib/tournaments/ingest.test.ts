import { beforeEach, describe, expect, it } from "vitest";
import { createTestPrismaClient, resetDb } from "@/lib/db/test-client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { GolfDataProvider, LiveRoundScore, TournamentField } from "@/lib/data-adapter";
import { ingestField, ingestScores } from "./ingest";

const db = createTestPrismaClient();

const EXTERNAL_ID = "ext-tourney-1";

// A stub provider whose field/scores we can mutate between calls to
// simulate a live tournament changing (golfer added, score updated).
class StubProvider implements GolfDataProvider {
  field: TournamentField;
  scores: LiveRoundScore[];
  constructor(field: TournamentField, scores: LiveRoundScore[] = []) {
    this.field = field;
    this.scores = scores;
  }
  async getField(): Promise<TournamentField> {
    return this.field;
  }
  async getScores(): Promise<LiveRoundScore[]> {
    return this.scores;
  }
}

function makeField(golfers: TournamentField["golfers"]): TournamentField {
  return {
    externalId: EXTERNAL_ID,
    name: "Stub Open",
    startDate: "2026-09-01",
    endDate: "2026-09-04",
    golfers,
  };
}

beforeEach(async () => {
  await resetDb(db);
});

async function makeTournament(externalId: string | null = EXTERNAL_ID) {
  return db.tournament.create({
    data: {
      externalId,
      name: "Stub Open",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-04"),
    },
  });
}

describe("ingestField", () => {
  it("creates golfer rows on first ingest", async () => {
    const tournament = await makeTournament();
    const provider = new StubProvider(
      makeField([
        { externalId: "g1", name: "Player One", worldRank: 1 },
        { externalId: "g2", name: "Player Two", worldRank: 2 },
      ]),
    );

    const result = await ingestField(tournament.id, provider, db);

    expect(result).toEqual({ created: 2, updated: 0, total: 2 });
    const golfers = await db.golfer.findMany({ where: { tournamentId: tournament.id } });
    expect(golfers).toHaveLength(2);
  });

  it("is idempotent: a second ingest updates rather than duplicates", async () => {
    const tournament = await makeTournament();
    const provider = new StubProvider(
      makeField([{ externalId: "g1", name: "Player One", worldRank: 10 }]),
    );

    await ingestField(tournament.id, provider, db);

    // Same golfer, new world rank; plus a newcomer.
    provider.field = makeField([
      { externalId: "g1", name: "Player One", worldRank: 5 },
      { externalId: "g2", name: "Player Two", worldRank: 20 },
    ]);

    const result = await ingestField(tournament.id, provider, db);

    expect(result).toEqual({ created: 1, updated: 1, total: 2 });
    const g1 = await db.golfer.findUnique({
      where: { tournamentId_externalId: { tournamentId: tournament.id, externalId: "g1" } },
    });
    expect(g1?.worldRank).toBe(5);
    const all = await db.golfer.findMany({ where: { tournamentId: tournament.id } });
    expect(all).toHaveLength(2);
  });

  it("throws NotFoundError for a missing tournament", async () => {
    const provider = new StubProvider(makeField([]));
    await expect(ingestField("nope", provider, db)).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when the tournament has no externalId", async () => {
    const tournament = await makeTournament(null);
    const provider = new StubProvider(makeField([]));
    await expect(ingestField(tournament.id, provider, db)).rejects.toThrow(ValidationError);
  });
});

describe("ingestScores", () => {
  async function setupWithField() {
    const tournament = await makeTournament();
    const provider = new StubProvider(
      makeField([
        { externalId: "g1", name: "Player One" },
        { externalId: "g2", name: "Player Two" },
      ]),
    );
    await ingestField(tournament.id, provider, db);
    return { tournament, provider };
  }

  it("creates GolferScore rows for golfers already in the field", async () => {
    const { tournament, provider } = await setupWithField();
    provider.scores = [
      { externalGolferId: "g1", round: 1, strokes: 68, toPar: -4, thru: 18, position: "1", status: "ACTIVE" },
      { externalGolferId: "g2", round: 1, strokes: 72, toPar: 0, thru: 18, position: "2", status: "ACTIVE" },
    ];

    const result = await ingestScores(tournament.id, provider, db);

    expect(result).toEqual({ created: 2, updated: 0, skipped: 0, total: 2 });
    const scores = await db.golferScore.findMany({ where: { tournamentId: tournament.id } });
    expect(scores).toHaveLength(2);
  });

  it("is idempotent per (golferId, round): a re-sync updates rather than duplicates", async () => {
    const { tournament, provider } = await setupWithField();
    provider.scores = [
      { externalGolferId: "g1", round: 1, strokes: 68, toPar: -4, thru: 18, position: "1", status: "ACTIVE" },
    ];
    await ingestScores(tournament.id, provider, db);

    provider.scores = [
      { externalGolferId: "g1", round: 1, strokes: 66, toPar: -6, thru: 18, position: "1", status: "ACTIVE" },
    ];
    const result = await ingestScores(tournament.id, provider, db);

    expect(result).toEqual({ created: 0, updated: 1, skipped: 0, total: 1 });
    const scores = await db.golferScore.findMany({ where: { tournamentId: tournament.id } });
    expect(scores).toHaveLength(1);
    expect(scores[0].toPar).toBe(-6);
  });

  it("adds a new round as a separate row rather than overwriting the previous one", async () => {
    const { tournament, provider } = await setupWithField();
    provider.scores = [
      { externalGolferId: "g1", round: 1, strokes: 68, toPar: -4, thru: 18, position: "1", status: "ACTIVE" },
    ];
    await ingestScores(tournament.id, provider, db);

    provider.scores = [
      { externalGolferId: "g1", round: 2, strokes: 70, toPar: -6, thru: 18, position: "1", status: "ACTIVE" },
    ];
    const result = await ingestScores(tournament.id, provider, db);

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0, total: 1 });
    const scores = await db.golferScore.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { round: "asc" },
    });
    expect(scores.map((s) => s.round)).toEqual([1, 2]);
  });

  it("skips scores for a golfer not yet in the field instead of failing", async () => {
    const { tournament, provider } = await setupWithField();
    provider.scores = [
      { externalGolferId: "g1", round: 1, strokes: 68, toPar: -4, thru: 18, position: "1", status: "ACTIVE" },
      { externalGolferId: "ghost", round: 1, strokes: 70, toPar: -2, thru: 18, position: "2", status: "ACTIVE" },
    ];

    const result = await ingestScores(tournament.id, provider, db);

    expect(result).toEqual({ created: 1, updated: 0, skipped: 1, total: 2 });
  });

  it("throws NotFoundError for a missing tournament", async () => {
    const provider = new StubProvider(makeField([]));
    await expect(ingestScores("nope", provider, db)).rejects.toThrow(NotFoundError);
  });
});
