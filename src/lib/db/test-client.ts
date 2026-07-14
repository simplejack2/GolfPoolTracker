import { PrismaClient } from "@prisma/client";

/**
 * A PrismaClient pointed at TEST_DATABASE_URL, for integration tests that
 * exercise real Prisma queries (unique constraints, cascades) without
 * touching the dev database. Migrations must already be applied to the
 * test database (`npx prisma migrate deploy` with TEST_DATABASE_URL) —
 * this client does not run migrations itself.
 */
export function createTestPrismaClient(): PrismaClient {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set — see .env.example");
  }
  return new PrismaClient({ datasourceUrl: url });
}

/** Deletes all rows from every app table, in FK-safe order. */
export async function resetDb(db: PrismaClient): Promise<void> {
  await db.standing.deleteMany();
  await db.roster.deleteMany();
  await db.poolMember.deleteMany();
  await db.pool.deleteMany();
  await db.golferScore.deleteMany();
  await db.golfer.deleteMany();
  await db.tournament.deleteMany();
  await db.user.deleteMany();
}
