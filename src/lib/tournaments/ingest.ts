import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { GolfDataProvider } from "@/lib/data-adapter";

export interface IngestResult {
  created: number;
  updated: number;
  total: number;
}

/**
 * Pulls a tournament's field from a data provider and upserts Golfer rows.
 * Idempotent: re-running updates existing golfers (name/worldRank) and adds
 * any new ones, keyed on (tournamentId, externalId). This is the single
 * source of truth for turning provider field data into Golfer rows — the
 * seed script and any commissioner "sync field" action both go through it,
 * so the mapping lives in one place.
 */
export async function ingestField(
  tournamentId: string,
  provider: GolfDataProvider,
  db: PrismaClient = prisma,
): Promise<IngestResult> {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new NotFoundError(`Tournament "${tournamentId}" not found`);
  }
  if (!tournament.externalId) {
    throw new ValidationError(
      "Tournament has no externalId; cannot fetch its field from a provider",
    );
  }

  const field = await provider.getField(tournament.externalId);

  let created = 0;
  let updated = 0;

  for (const golfer of field.golfers) {
    const existing = await db.golfer.findUnique({
      where: {
        tournamentId_externalId: { tournamentId, externalId: golfer.externalId },
      },
      select: { id: true },
    });

    await db.golfer.upsert({
      where: {
        tournamentId_externalId: { tournamentId, externalId: golfer.externalId },
      },
      update: { name: golfer.name, worldRank: golfer.worldRank ?? null },
      create: {
        tournamentId,
        externalId: golfer.externalId,
        name: golfer.name,
        worldRank: golfer.worldRank ?? null,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated, total: field.golfers.length };
}
