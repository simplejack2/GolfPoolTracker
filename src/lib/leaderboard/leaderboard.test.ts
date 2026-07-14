import { beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestPrismaClient, resetDb } from "@/lib/db/test-client";
import { NotFoundError } from "@/lib/errors";
import { makePool, makeTournament, makeUser } from "@/lib/pools/test-helpers";
import { getLeaderboard } from "./leaderboard";

const db = createTestPrismaClient();

beforeEach(async () => {
  await resetDb(db);
});

function makeGolfer(database: PrismaClient, tournamentId: string, externalId: string, name: string) {
  return database.golfer.create({ data: { tournamentId, externalId, name } });
}

function scoreGolfer(
  database: PrismaClient,
  golferId: string,
  tournamentId: string,
  toPar: number,
  status: "ACTIVE" | "CUT" | "WD" | "DQ" = "ACTIVE",
  round = 1,
) {
  return database.golferScore.create({
    data: { golferId, tournamentId, round, toPar, strokes: 72 + toPar, thru: 18, status },
  });
}

async function joinAsMember(database: PrismaClient, poolId: string, userEmail: string, teamName: string) {
  const user = await makeUser(database, userEmail);
  const member = await database.poolMember.create({ data: { poolId, userId: user.id, teamName } });
  return { user, member };
}

describe("getLeaderboard", () => {
  it("throws NotFoundError for a missing pool", async () => {
    await expect(getLeaderboard("nope", db)).rejects.toThrow(NotFoundError);
  });

  it("ranks teams by best-N total and includes a per-golfer breakdown", async () => {
    const owner = await makeUser(db, "owner@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id, { countBestN: 2, rosterSize: 2 });
    const ownerMember = await db.poolMember.findFirstOrThrow({ where: { poolId: pool.id, userId: owner.id } });

    const g1 = await makeGolfer(db, tournament.id, "g1", "Golfer One");
    const g2 = await makeGolfer(db, tournament.id, "g2", "Golfer Two");
    await scoreGolfer(db, g1.id, tournament.id, -5);
    await scoreGolfer(db, g2.id, tournament.id, -2);
    await db.roster.createMany({
      data: [
        { poolMemberId: ownerMember.id, golferId: g1.id },
        { poolMemberId: ownerMember.id, golferId: g2.id },
      ],
    });

    const { member: rivalMember } = await joinAsMember(db, pool.id, "rival@example.com", "Rivals");
    const g3 = await makeGolfer(db, tournament.id, "g3", "Golfer Three");
    await scoreGolfer(db, g3.id, tournament.id, 4);
    await db.roster.create({ data: { poolMemberId: rivalMember.id, golferId: g3.id } });

    const board = await getLeaderboard(pool.id, db);

    expect(board).toHaveLength(2);
    expect(board[0].poolMemberId).toBe(ownerMember.id);
    expect(board[0].rank).toBe(1);
    expect(board[0].totalToPar).toBe(-7);
    expect(board[0].golfers.map((g) => g.name).sort()).toEqual(["Golfer One", "Golfer Two"]);
    expect(board[1].poolMemberId).toBe(rivalMember.id);
    expect(board[1].rank).toBe(2);
    expect(board[1].totalToPar).toBe(4);
  });

  it("shows an untallied score as toPar 0 with hasScore false", async () => {
    const owner = await makeUser(db, "owner2@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id, { countBestN: 1, rosterSize: 1 });
    const ownerMember = await db.poolMember.findFirstOrThrow({ where: { poolId: pool.id, userId: owner.id } });
    const g1 = await makeGolfer(db, tournament.id, "g1", "Not Teed Off Yet");
    await db.roster.create({ data: { poolMemberId: ownerMember.id, golferId: g1.id } });

    const board = await getLeaderboard(pool.id, db);

    expect(board[0].golfers[0].hasScore).toBe(false);
    expect(board[0].golfers[0].toPar).toBe(0);
    expect(board[0].golfers[0].counted).toBe(true);
  });

  it("under DROP cut penalty, still lists a cut golfer but marks it uncounted", async () => {
    const owner = await makeUser(db, "owner3@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id, {
      countBestN: 1,
      rosterSize: 2,
      cutPenaltyMode: "DROP",
    });
    const ownerMember = await db.poolMember.findFirstOrThrow({ where: { poolId: pool.id, userId: owner.id } });

    const cutGolfer = await makeGolfer(db, tournament.id, "cut1", "Missed Cut");
    await scoreGolfer(db, cutGolfer.id, tournament.id, -10, "CUT"); // would be best score if counted
    const activeGolfer = await makeGolfer(db, tournament.id, "active1", "Made Cut");
    await scoreGolfer(db, activeGolfer.id, tournament.id, 1, "ACTIVE");
    await db.roster.createMany({
      data: [
        { poolMemberId: ownerMember.id, golferId: cutGolfer.id },
        { poolMemberId: ownerMember.id, golferId: activeGolfer.id },
      ],
    });

    const board = await getLeaderboard(pool.id, db);

    expect(board[0].totalToPar).toBe(1); // only the active golfer counts
    const cutRow = board[0].golfers.find((g) => g.golferId === cutGolfer.id);
    expect(cutRow?.counted).toBe(false);
    expect(cutRow?.status).toBe("CUT");
    expect(cutRow?.toPar).toBe(-10); // unpenalized display value
  });

  it("under FIXED cut penalty, applies the penalty and keeps the golfer eligible", async () => {
    const owner = await makeUser(db, "owner4@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id, {
      countBestN: 1,
      rosterSize: 1,
      cutPenaltyMode: "FIXED",
      cutPenaltyValue: 8,
    });
    const ownerMember = await db.poolMember.findFirstOrThrow({ where: { poolId: pool.id, userId: owner.id } });

    const cutGolfer = await makeGolfer(db, tournament.id, "cut1", "Missed Cut");
    await scoreGolfer(db, cutGolfer.id, tournament.id, 2, "CUT");
    await db.roster.create({ data: { poolMemberId: ownerMember.id, golferId: cutGolfer.id } });

    const board = await getLeaderboard(pool.id, db);

    expect(board[0].totalToPar).toBe(10); // 2 + 8 penalty
    expect(board[0].golfers[0].toPar).toBe(10);
    expect(board[0].golfers[0].counted).toBe(true);
  });
});
