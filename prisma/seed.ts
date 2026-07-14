import { PrismaClient } from "@prisma/client";
import { MockGolfDataProvider, MOCK_TOURNAMENT_ID } from "../src/lib/data-adapter";

const prisma = new PrismaClient();

async function main() {
  const provider = new MockGolfDataProvider();
  const field = await provider.getField(MOCK_TOURNAMENT_ID);

  const tournament = await prisma.tournament.upsert({
    where: { externalId: field.externalId },
    update: {
      name: field.name,
      startDate: new Date(field.startDate),
      endDate: new Date(field.endDate),
    },
    create: {
      externalId: field.externalId,
      name: field.name,
      startDate: new Date(field.startDate),
      endDate: new Date(field.endDate),
    },
  });

  for (const golfer of field.golfers) {
    await prisma.golfer.upsert({
      where: { tournamentId_externalId: { tournamentId: tournament.id, externalId: golfer.externalId } },
      update: { name: golfer.name, worldRank: golfer.worldRank },
      create: {
        tournamentId: tournament.id,
        externalId: golfer.externalId,
        name: golfer.name,
        worldRank: golfer.worldRank,
      },
    });
  }

  console.log(`Seeded tournament "${tournament.name}" with ${field.golfers.length} golfers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
