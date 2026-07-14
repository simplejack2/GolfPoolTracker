import { PrismaClient } from "@prisma/client";
import { MockGolfDataProvider, MOCK_TOURNAMENT_ID } from "../src/lib/data-adapter";
import { ingestField } from "../src/lib/tournaments";

const prisma = new PrismaClient();

async function main() {
  const provider = new MockGolfDataProvider();
  const field = await provider.getField(MOCK_TOURNAMENT_ID);

  // Create/refresh the tournament from the field metadata, then let the
  // shared ingestion service upsert the golfers so the seed and the
  // commissioner "sync field" action stay in lockstep.
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

  const result = await ingestField(tournament.id, provider, prisma);

  console.log(`Seeded tournament "${tournament.name}" with ${result.total} golfers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
