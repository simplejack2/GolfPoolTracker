import { beforeEach, describe, expect, it } from "vitest";
import { createTestPrismaClient, resetDb } from "@/lib/db/test-client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  joinPool,
  leavePool,
  listPoolMembers,
  removeMember,
  updateMemberTeamName,
} from "./membership";
import { updatePoolRules } from "./pools";
import { makePool, makeTournament, makeUser } from "./test-helpers";

const db = createTestPrismaClient();

beforeEach(async () => {
  await resetDb(db);
});

async function openPool(overrides: Parameters<typeof makePool>[3] = {}) {
  const owner = await makeUser(db, "owner@example.com");
  const tournament = await makeTournament(db);
  const pool = await makePool(db, owner.id, tournament.id, overrides);
  await updatePoolRules(pool.id, owner.id, { status: "OPEN" }, db);
  return { owner, pool };
}

describe("joinPool", () => {
  it("adds a new member to an open pool", async () => {
    const { pool } = await openPool();
    const golfer = await makeUser(db, "golfer@example.com");

    const member = await joinPool(pool.id, golfer.id, { teamName: "Golfer Team" }, db);

    expect(member.userId).toBe(golfer.id);
    const members = await listPoolMembers(pool.id, db);
    expect(members).toHaveLength(2); // owner + new member
  });

  it("rejects joining a pool that isn't OPEN", async () => {
    const owner = await makeUser(db, "owner2@example.com");
    const tournament = await makeTournament(db);
    const pool = await makePool(db, owner.id, tournament.id); // stays DRAFT
    const golfer = await makeUser(db, "golfer2@example.com");

    await expect(joinPool(pool.id, golfer.id, { teamName: "Team" }, db)).rejects.toThrow(ConflictError);
  });

  it("rejects joining a pool past its lockAt", async () => {
    const { pool } = await openPool({ lockAt: new Date("2020-01-01T00:00:00Z") });
    const golfer = await makeUser(db, "golfer3@example.com");

    await expect(joinPool(pool.id, golfer.id, { teamName: "Team" }, db)).rejects.toThrow(ConflictError);
  });

  it("rejects a duplicate join", async () => {
    const { pool } = await openPool();
    const golfer = await makeUser(db, "golfer4@example.com");

    await joinPool(pool.id, golfer.id, { teamName: "Team A" }, db);
    await expect(joinPool(pool.id, golfer.id, { teamName: "Team B" }, db)).rejects.toThrow(ConflictError);
  });

  it("rejects an empty team name", async () => {
    const { pool } = await openPool();
    const golfer = await makeUser(db, "golfer5@example.com");

    await expect(joinPool(pool.id, golfer.id, { teamName: "" }, db)).rejects.toThrow(ValidationError);
  });
});

describe("leavePool", () => {
  it("removes a member's own membership", async () => {
    const { pool } = await openPool();
    const golfer = await makeUser(db, "golfer6@example.com");
    await joinPool(pool.id, golfer.id, { teamName: "Team" }, db);

    await leavePool(pool.id, golfer.id, db);

    const members = await listPoolMembers(pool.id, db);
    expect(members.map((m) => m.userId)).not.toContain(golfer.id);
  });

  it("prevents the owner from leaving", async () => {
    const { pool, owner } = await openPool();
    await expect(leavePool(pool.id, owner.id, db)).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError if the user isn't a member", async () => {
    const { pool } = await openPool();
    const stranger = await makeUser(db, "stranger@example.com");
    await expect(leavePool(pool.id, stranger.id, db)).rejects.toThrow(NotFoundError);
  });
});

describe("removeMember", () => {
  it("lets the owner remove another member", async () => {
    const { pool, owner } = await openPool();
    const golfer = await makeUser(db, "golfer7@example.com");
    const member = await joinPool(pool.id, golfer.id, { teamName: "Team" }, db);

    await removeMember(pool.id, owner.id, member.id, db);

    const members = await listPoolMembers(pool.id, db);
    expect(members.map((m) => m.userId)).not.toContain(golfer.id);
  });

  it("rejects removal by a non-owner", async () => {
    const { pool } = await openPool();
    const golfer = await makeUser(db, "golfer8@example.com");
    const intruder = await makeUser(db, "intruder@example.com");
    const member = await joinPool(pool.id, golfer.id, { teamName: "Team" }, db);

    await expect(removeMember(pool.id, intruder.id, member.id, db)).rejects.toThrow(ForbiddenError);
  });
});

describe("updateMemberTeamName", () => {
  it("updates the caller's own team name", async () => {
    const { pool } = await openPool();
    const golfer = await makeUser(db, "golfer9@example.com");
    await joinPool(pool.id, golfer.id, { teamName: "Old Name" }, db);

    const updated = await updateMemberTeamName(pool.id, golfer.id, { teamName: "New Name" }, db);

    expect(updated.teamName).toBe("New Name");
  });

  it("throws NotFoundError for a non-member", async () => {
    const { pool } = await openPool();
    const stranger = await makeUser(db, "stranger2@example.com");

    await expect(updateMemberTeamName(pool.id, stranger.id, { teamName: "New" }, db)).rejects.toThrow(
      NotFoundError,
    );
  });
});
