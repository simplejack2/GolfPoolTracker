import { Prisma, type Pool, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Picks are locked once the pool's lock deadline passes OR the pool has
 * moved past the pre-tournament phase. Both are checked here rather than
 * relying on the UI so a stale page can't sneak in a late pick.
 */
export function isPicksLocked(pool: Pick<Pool, "status" | "lockAt">, now: Date = new Date()): boolean {
  if (pool.status === "LOCKED" || pool.status === "LIVE" || pool.status === "COMPLETE") {
    return true;
  }
  return pool.lockAt <= now;
}

async function resolveMember(poolId: string, userId: string, db: PrismaClient) {
  const pool = await db.pool.findUnique({ where: { id: poolId } });
  if (!pool) {
    throw new NotFoundError(`Pool "${poolId}" not found`);
  }
  const member = await db.poolMember.findUnique({
    where: { poolId_userId: { poolId, userId } },
  });
  if (!member) {
    throw new NotFoundError("You are not a member of this pool");
  }
  return { pool, member };
}

export async function getRoster(poolId: string, userId: string, db: PrismaClient = prisma) {
  const { member } = await resolveMember(poolId, userId, db);
  return db.roster.findMany({
    where: { poolMemberId: member.id },
    include: { golfer: true },
    orderBy: { pickedAt: "asc" },
  });
}

export async function addPick(
  poolId: string,
  userId: string,
  golferId: string,
  db: PrismaClient = prisma,
) {
  if (!golferId) {
    throw new ValidationError("A golfer must be selected");
  }

  const { pool, member } = await resolveMember(poolId, userId, db);

  if (isPicksLocked(pool)) {
    throw new ConflictError("Picks are locked for this pool");
  }

  const golfer = await db.golfer.findUnique({ where: { id: golferId } });
  if (!golfer || golfer.tournamentId !== pool.tournamentId) {
    throw new ValidationError("That golfer is not in this pool's tournament field");
  }

  const currentCount = await db.roster.count({ where: { poolMemberId: member.id } });
  if (currentCount >= pool.rosterSize) {
    throw new ConflictError(`Roster is full (${pool.rosterSize} picks)`);
  }

  try {
    return await db.roster.create({
      data: { poolMemberId: member.id, golferId },
      include: { golfer: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("You have already picked that golfer");
    }
    throw error;
  }
}

export async function removePick(
  poolId: string,
  userId: string,
  golferId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const { pool, member } = await resolveMember(poolId, userId, db);

  if (isPicksLocked(pool)) {
    throw new ConflictError("Picks are locked for this pool");
  }

  const pick = await db.roster.findUnique({
    where: { poolMemberId_golferId: { poolMemberId: member.id, golferId } },
  });
  if (!pick) {
    throw new NotFoundError("That golfer is not on your roster");
  }

  await db.roster.delete({ where: { id: pick.id } });
}
