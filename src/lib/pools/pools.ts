import type { Pool, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createPoolSchema, updatePoolRulesSchema } from "./schemas";

const poolWithRelations = {
  include: {
    owner: true,
    tournament: true,
    members: { include: { user: true } },
  },
} as const;

export type PoolWithRelations = NonNullable<
  Awaited<ReturnType<typeof getPool>>
>;

export async function createPool(
  ownerId: string,
  input: unknown,
  db: PrismaClient = prisma,
) {
  const parsed = createPoolSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid pool input");
  }
  const { ownerTeamName, ...poolFields } = parsed.data;

  return db.pool.create({
    data: {
      ...poolFields,
      ownerId,
      members: {
        create: { userId: ownerId, teamName: ownerTeamName },
      },
    },
    ...poolWithRelations,
  });
}

export async function getPool(poolId: string, db: PrismaClient = prisma) {
  const pool = await db.pool.findUnique({ where: { id: poolId }, ...poolWithRelations });
  if (!pool) {
    throw new NotFoundError(`Pool "${poolId}" not found`);
  }
  return pool;
}

export async function listPoolsForUser(userId: string, db: PrismaClient = prisma) {
  return db.pool.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: "desc" },
    ...poolWithRelations,
  });
}

export async function updatePoolRules(
  poolId: string,
  ownerId: string,
  input: unknown,
  db: PrismaClient = prisma,
): Promise<Pool> {
  const pool = await db.pool.findUnique({ where: { id: poolId } });
  if (!pool) {
    throw new NotFoundError(`Pool "${poolId}" not found`);
  }
  if (pool.ownerId !== ownerId) {
    throw new ForbiddenError("Only the pool owner can update its rules");
  }

  const parsed = updatePoolRulesSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid pool input");
  }

  const effectiveCountBestN = parsed.data.countBestN ?? pool.countBestN;
  const effectiveRosterSize = parsed.data.rosterSize ?? pool.rosterSize;
  if (effectiveCountBestN > effectiveRosterSize) {
    throw new ValidationError("countBestN cannot exceed rosterSize");
  }

  const effectiveCutPenaltyMode = parsed.data.cutPenaltyMode ?? pool.cutPenaltyMode;
  const effectiveCutPenaltyValue = parsed.data.cutPenaltyValue ?? pool.cutPenaltyValue;
  if (effectiveCutPenaltyMode === "FIXED" && effectiveCutPenaltyValue === null) {
    throw new ValidationError("cutPenaltyValue is required when cutPenaltyMode is FIXED");
  }

  return db.pool.update({ where: { id: poolId }, data: parsed.data });
}

export async function deletePool(poolId: string, ownerId: string, db: PrismaClient = prisma): Promise<void> {
  const pool = await db.pool.findUnique({ where: { id: poolId } });
  if (!pool) {
    throw new NotFoundError(`Pool "${poolId}" not found`);
  }
  if (pool.ownerId !== ownerId) {
    throw new ForbiddenError("Only the pool owner can delete this pool");
  }

  await db.pool.delete({ where: { id: poolId } });
}
