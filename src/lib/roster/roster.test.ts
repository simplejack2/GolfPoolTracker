import { beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestPrismaClient, resetDb } from "@/lib/db/test-client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { makePool, makeTournament, makeUser } from "@/lib/pools/test-helpers";
import { addPick, getRoster, isPicksLocked, removePick } from "./roster";

const db = createTestPrismaClient();

function makeGolfers(database: PrismaClient, tournamentId: string, count: number) {
  return Promise.all(
    Array.from({ length: count }, (_, i) =>
      database.golfer.create({
        data: { tournamentId, externalId: `g${i}`, name: `Golfer ${i}`, worldRank: i + 1 },
      }),
    ),
  );
}

beforeEach(async () => {
  await resetDb(db);
});

async function setup(overrides: Parameters<typeof makePool>[3] = {}) {
  const owner = await makeUser(db, "owner@example.com");
  const tournament = await makeTournament(db);
  const golfers = await makeGolfers(db, tournament.id, 5);
  const pool = await makePool(db, owner.id, tournament.id, { rosterSize: 3, ...overrides });
  return { owner, tournament, golfers, pool };
}

describe("isPicksLocked", () => {
  it("is unlocked for a future lockAt in DRAFT/OPEN", () => {
    expect(isPicksLocked({ status: "OPEN", lockAt: new Date(Date.now() + 60_000) })).toBe(false);
  });
  it("is locked once lockAt has passed", () => {
    expect(isPicksLocked({ status: "OPEN", lockAt: new Date(Date.now() - 60_000) })).toBe(true);
  });
  it("is locked for LOCKED/LIVE/COMPLETE regardless of lockAt", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isPicksLocked({ status: "LOCKED", lockAt: future })).toBe(true);
    expect(isPicksLocked({ status: "LIVE", lockAt: future })).toBe(true);
    expect(isPicksLocked({ status: "COMPLETE", lockAt: future })).toBe(true);
  });
});

describe("addPick", () => {
  it("adds a golfer to the caller's roster", async () => {
    const { owner, golfers, pool } = await setup();

    const pick = await addPick(pool.id, owner.id, golfers[0].id, db);

    expect(pick.golferId).toBe(golfers[0].id);
    const roster = await getRoster(pool.id, owner.id, db);
    expect(roster).toHaveLength(1);
  });

  it("rejects a golfer not in the pool's tournament", async () => {
    const { owner, pool } = await setup();
    const otherTournament = await makeTournament(db, "Other Open");
    const [stray] = await makeGolfers(db, otherTournament.id, 1);

    await expect(addPick(pool.id, owner.id, stray.id, db)).rejects.toThrow(ValidationError);
  });

  it("rejects picks beyond rosterSize", async () => {
    const { owner, golfers, pool } = await setup({ rosterSize: 2 });

    await addPick(pool.id, owner.id, golfers[0].id, db);
    await addPick(pool.id, owner.id, golfers[1].id, db);

    await expect(addPick(pool.id, owner.id, golfers[2].id, db)).rejects.toThrow(ConflictError);
  });

  it("rejects a duplicate pick", async () => {
    const { owner, golfers, pool } = await setup();

    await addPick(pool.id, owner.id, golfers[0].id, db);
    await expect(addPick(pool.id, owner.id, golfers[0].id, db)).rejects.toThrow(ConflictError);
  });

  it("rejects picks once the pool is locked by time", async () => {
    const { owner, golfers, pool } = await setup({ lockAt: new Date("2020-01-01T00:00:00Z") });

    await expect(addPick(pool.id, owner.id, golfers[0].id, db)).rejects.toThrow(ConflictError);
  });

  it("rejects picks once the pool status is LOCKED", async () => {
    const { owner, golfers, pool } = await setup();
    await db.pool.update({ where: { id: pool.id }, data: { status: "LOCKED" } });

    await expect(addPick(pool.id, owner.id, golfers[0].id, db)).rejects.toThrow(ConflictError);
  });

  it("rejects a non-member", async () => {
    const { golfers, pool } = await setup();
    const stranger = await makeUser(db, "stranger@example.com");

    await expect(addPick(pool.id, stranger.id, golfers[0].id, db)).rejects.toThrow(NotFoundError);
  });
});

describe("removePick", () => {
  it("removes a golfer from the roster", async () => {
    const { owner, golfers, pool } = await setup();
    await addPick(pool.id, owner.id, golfers[0].id, db);

    await removePick(pool.id, owner.id, golfers[0].id, db);

    const roster = await getRoster(pool.id, owner.id, db);
    expect(roster).toHaveLength(0);
  });

  it("throws NotFoundError removing a golfer that isn't on the roster", async () => {
    const { owner, golfers, pool } = await setup();
    await expect(removePick(pool.id, owner.id, golfers[0].id, db)).rejects.toThrow(NotFoundError);
  });

  it("rejects removal once picks are locked", async () => {
    const { owner, golfers, pool } = await setup();
    await addPick(pool.id, owner.id, golfers[0].id, db);
    await db.pool.update({ where: { id: pool.id }, data: { status: "LOCKED" } });

    await expect(removePick(pool.id, owner.id, golfers[0].id, db)).rejects.toThrow(ConflictError);
  });
});
