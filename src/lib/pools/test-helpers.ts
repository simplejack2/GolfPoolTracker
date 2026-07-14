import type { PrismaClient } from "@prisma/client";
import { createPool } from "./pools";
import type { CreatePoolInput } from "./schemas";

export function makeUser(db: PrismaClient, email: string) {
  return db.user.create({ data: { email } });
}

export function makeTournament(db: PrismaClient, name = "Test Open") {
  return db.tournament.create({
    data: { name, startDate: new Date("2026-08-01"), endDate: new Date("2026-08-04") },
  });
}

export function makePool(
  db: PrismaClient,
  ownerId: string,
  tournamentId: string,
  overrides: Partial<Omit<CreatePoolInput, "tournamentId">> = {},
) {
  return createPool(
    ownerId,
    {
      name: "Test Pool",
      tournamentId,
      countBestN: 2,
      rosterSize: 4,
      lockAt: new Date("2026-08-01T12:00:00Z"),
      ownerTeamName: "Owner",
      ...overrides,
    },
    db,
  );
}
