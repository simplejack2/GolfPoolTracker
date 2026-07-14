import { beforeEach, describe, expect, it } from "vitest";
import { createTestPrismaClient, resetDb } from "@/lib/db/test-client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createPool, deletePool, getPool, listPoolsForUser, updatePoolRules } from "./pools";
import { makePool, makeTournament, makeUser } from "./test-helpers";

const db = createTestPrismaClient();

beforeEach(async () => {
  await resetDb(db);
});

describe("createPool", () => {
  it("creates a pool and auto-joins the owner", async () => {
    const owner = await makeUser(db, "owner@example.com");
    const tournament = await makeTournament(db);

    const pool = await makePool(db, owner.id, tournament.id, { ownerTeamName: "Owner Team" });

    expect(pool.ownerId).toBe(owner.id);
    expect(pool.members).toHaveLength(1);
    expect(pool.members[0].userId).toBe(owner.id);
    expect(pool.members[0].teamName).toBe("Owner Team");
    expect(pool.cutPenaltyMode).toBe("DROP");
  });

  it("creates a pool with a FIXED cut penalty when a value is given", async () => {
    const owner = await makeUser(db, "owner1b@example.com");
    const tournament = await makeTournament(db);

    const pool = await makePool(db, owner.id, tournament.id, {
      cutPenaltyMode: "FIXED",
      cutPenaltyValue: 8,
    });

    expect(pool.cutPenaltyMode).toBe("FIXED");
    expect(pool.cutPenaltyValue).toBe(8);
  });

  it("rejects a FIXED cut penalty with no value", async () => {
    const owner = await makeUser(db, "owner1c@example.com");
    const tournament = await makeTournament(db);

    await expect(
      createPool(
        owner.id,
        {
          name: "Bad Penalty Pool",
          tournamentId: tournament.id,
          countBestN: 2,
          rosterSize: 4,
          cutPenaltyMode: "FIXED",
          lockAt: new Date("2026-08-01T12:00:00Z"),
          ownerTeamName: "Owner",
        },
        db,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects countBestN greater than rosterSize", async () => {
    const owner = await makeUser(db, "owner2@example.com");
    const tournament = await makeTournament(db);

    await expect(
      createPool(
        owner.id,
        {
          name: "Bad Pool",
          tournamentId: tournament.id,
          countBestN: 10,
          rosterSize: 4,
          lockAt: new Date("2026-08-01T12:00:00Z"),
          ownerTeamName: "Owner",
        },
        db,
      ),
    ).rejects.toThrow(ValidationError);
  });
});

describe("getPool / listPoolsForUser", () => {
  it("throws NotFoundError for a missing pool", async () => {
    await expect(getPool("missing-id", db)).rejects.toThrow(NotFoundError);
  });

  it("lists pools where the user is owner or member", async () => {
    const owner = await makeUser(db, "owner3@example.com");
    const other = await makeUser(db, "other@example.com");
    const tournament = await makeTournament(db);

    const pool = await makePool(db, owner.id, tournament.id);
    await db.poolMember.create({ data: { poolId: pool.id, userId: other.id, teamName: "Other Team" } });

    const ownerPools = await listPoolsForUser(owner.id, db);
    const otherPools = await listPoolsForUser(other.id, db);

    expect(ownerPools.map((p) => p.id)).toContain(pool.id);
    expect(otherPools.map((p) => p.id)).toContain(pool.id);
  });
});

describe("updatePoolRules", () => {
  it("allows the owner to update rules", async () => {
    const owner = await makeUser(db, "owner4@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id);

    const updated = await updatePoolRules(pool.id, owner.id, { countBestN: 3, status: "OPEN" }, db);

    expect(updated.countBestN).toBe(3);
    expect(updated.status).toBe("OPEN");
  });

  it("rejects updates from a non-owner", async () => {
    const owner = await makeUser(db, "owner5@example.com");
    const intruder = await makeUser(db, "intruder@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id);

    await expect(updatePoolRules(pool.id, intruder.id, { countBestN: 1 }, db)).rejects.toThrow(ForbiddenError);
  });

  it("rejects a countBestN/rosterSize combination that breaks the invariant", async () => {
    const owner = await makeUser(db, "owner5b@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id, { countBestN: 2, rosterSize: 4 });

    await expect(updatePoolRules(pool.id, owner.id, { rosterSize: 1 }, db)).rejects.toThrow(ValidationError);
  });

  it("rejects switching to FIXED cut penalty without a value", async () => {
    const owner = await makeUser(db, "owner5c@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id); // defaults to DROP

    await expect(
      updatePoolRules(pool.id, owner.id, { cutPenaltyMode: "FIXED" }, db),
    ).rejects.toThrow(ValidationError);
  });

  it("allows switching to FIXED cut penalty with a value", async () => {
    const owner = await makeUser(db, "owner5d@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id);

    const updated = await updatePoolRules(
      pool.id,
      owner.id,
      { cutPenaltyMode: "FIXED", cutPenaltyValue: 8 },
      db,
    );

    expect(updated.cutPenaltyMode).toBe("FIXED");
    expect(updated.cutPenaltyValue).toBe(8);
  });
});

describe("deletePool", () => {
  it("deletes the pool and cascades members", async () => {
    const owner = await makeUser(db, "owner6@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id);

    await deletePool(pool.id, owner.id, db);

    await expect(getPool(pool.id, db)).rejects.toThrow(NotFoundError);
    const remainingMembers = await db.poolMember.findMany({ where: { poolId: pool.id } });
    expect(remainingMembers).toHaveLength(0);
  });

  it("rejects deletion from a non-owner", async () => {
    const owner = await makeUser(db, "owner7@example.com");
    const intruder = await makeUser(db, "intruder2@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id);

    await expect(deletePool(pool.id, intruder.id, db)).rejects.toThrow(ForbiddenError);
  });
});
