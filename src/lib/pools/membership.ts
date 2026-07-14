import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { joinPoolSchema, updateMemberTeamNameSchema } from "./schemas";

export async function listPoolMembers(poolId: string, db: PrismaClient = prisma) {
  return db.poolMember.findMany({
    where: { poolId },
    include: { user: true },
    orderBy: { teamName: "asc" },
  });
}

export async function joinPool(poolId: string, userId: string, input: unknown, db: PrismaClient = prisma) {
  const parsed = joinPoolSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid team name");
  }

  const pool = await db.pool.findUnique({ where: { id: poolId } });
  if (!pool) {
    throw new NotFoundError(`Pool "${poolId}" not found`);
  }
  if (pool.status !== "OPEN") {
    throw new ConflictError("This pool is not open for new members");
  }
  if (pool.lockAt <= new Date()) {
    throw new ConflictError("This pool has already locked");
  }

  try {
    return await db.poolMember.create({
      data: { poolId, userId, teamName: parsed.data.teamName },
      include: { user: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("You have already joined this pool");
    }
    throw error;
  }
}

export async function leavePool(poolId: string, userId: string, db: PrismaClient = prisma): Promise<void> {
  const pool = await db.pool.findUnique({ where: { id: poolId } });
  if (!pool) {
    throw new NotFoundError(`Pool "${poolId}" not found`);
  }
  if (pool.ownerId === userId) {
    throw new ForbiddenError("The pool owner cannot leave; delete the pool instead");
  }

  const member = await db.poolMember.findUnique({ where: { poolId_userId: { poolId, userId } } });
  if (!member) {
    throw new NotFoundError("You are not a member of this pool");
  }

  await db.poolMember.delete({ where: { id: member.id } });
}

export async function removeMember(
  poolId: string,
  ownerId: string,
  memberId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const pool = await db.pool.findUnique({ where: { id: poolId } });
  if (!pool) {
    throw new NotFoundError(`Pool "${poolId}" not found`);
  }
  if (pool.ownerId !== ownerId) {
    throw new ForbiddenError("Only the pool owner can remove members");
  }

  const member = await db.poolMember.findUnique({ where: { id: memberId } });
  if (!member || member.poolId !== poolId) {
    throw new NotFoundError(`Member "${memberId}" not found in this pool`);
  }
  if (member.userId === ownerId) {
    throw new ForbiddenError("The pool owner cannot be removed; delete the pool instead");
  }

  await db.poolMember.delete({ where: { id: memberId } });
}

export async function updateMemberTeamName(
  poolId: string,
  userId: string,
  input: unknown,
  db: PrismaClient = prisma,
) {
  const parsed = updateMemberTeamNameSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid team name");
  }

  const member = await db.poolMember.findUnique({ where: { poolId_userId: { poolId, userId } } });
  if (!member) {
    throw new NotFoundError("You are not a member of this pool");
  }

  return db.poolMember.update({
    where: { id: member.id },
    data: { teamName: parsed.data.teamName },
    include: { user: true },
  });
}
