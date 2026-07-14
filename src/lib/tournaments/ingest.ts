import type { PrismaClient, Tournament } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { GolfDataProvider } from "@/lib/data-adapter";

export interface IngestResult {
  created: number;
  updated: number;
  total: number;
}

export interface IngestScoresResult extends IngestResult {
  /** Provider rows whose golfer isn't in this tournament's field yet (sync the field first). */
  skipped: number;
}

async function requireTournamentWithExternalId(
  tournamentId: string,
  db: PrismaClient,
): Promise<Tournament & { externalId: string }> {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new NotFoundError(`Tournament "${tournamentId}" not found`);
  }
  if (!tournament.externalId) {
    throw new ValidationError(
      "Tournament has no externalId; cannot fetch data from a provider",
    );
  }
  return tournament as Tournament & { externalId: string };
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
  const tournament = await requireTournamentWithExternalId(tournamentId, db);
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

/**
 * Pulls current scores from a data provider and upserts GolferScore rows,
 * keyed on (golferId, round) — re-syncing the same round updates it in
 * place rather than creating a duplicate. Rows for a golfer not yet in
 * this tournament's field are skipped (sync the field first) rather than
 * failing the whole batch.
 */
export async function ingestScores(
  tournamentId: string,
  provider: GolfDataProvider,
  db: PrismaClient = prisma,
): Promise<IngestScoresResult> {
  const tournament = await requireTournamentWithExternalId(tournamentId, db);
  const scores = await provider.getScores(tournament.externalId);

  const golfers = await db.golfer.findMany({
    where: { tournamentId },
    select: { id: true, externalId: true },
  });
  const golferIdByExternalId = new Map(
    golfers.filter((g) => g.externalId !== null).map((g) => [g.externalId as string, g.id]),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const score of scores) {
    const golferId = golferIdByExternalId.get(score.externalGolferId);
    if (!golferId) {
      skipped += 1;
      continue;
    }

    const existing = await db.golferScore.findUnique({
      where: { golferId_round: { golferId, round: score.round } },
      select: { id: true },
    });

    await db.golferScore.upsert({
      where: { golferId_round: { golferId, round: score.round } },
      update: {
        tournamentId,
        strokes: score.strokes,
        toPar: score.toPar,
        thru: score.thru,
        position: score.position,
        status: score.status,
      },
      create: {
        golferId,
        tournamentId,
        round: score.round,
        strokes: score.strokes,
        toPar: score.toPar,
        thru: score.thru,
        position: score.position,
        status: score.status,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated, skipped, total: scores.length };
}
