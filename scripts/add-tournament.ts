/**
 * Onboards a real tournament into the local DB from the Slash Golf
 * ("Live Golf Data" on RapidAPI) schedule. There's no schedule-browsing UI
 * yet — Tournament rows otherwise only come from prisma/seed.ts's mock
 * tournament — so this is how a commissioner gets a real tournId+year into
 * the app to attach a pool to.
 *
 * Usage:
 *   npx tsx scripts/add-tournament.ts <year>              # lists that year's schedule
 *   npx tsx scripts/add-tournament.ts <year> <tournId>    # creates/updates the Tournament + its field
 *
 * Requires RAPIDAPI_KEY in the environment (see .env.example).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { RapidApiGolfProvider } from "../src/lib/data-adapter";
import { ingestField } from "../src/lib/tournaments";

const BASE_URL = "https://live-golf-data.p.rapidapi.com";

const prisma = new PrismaClient();

interface ScheduleEntry {
  tournId: string;
  name: string;
  date: { start: string; end: string };
}

async function listSchedule(year: string, apiKey: string): Promise<void> {
  const url = new URL("/schedule", BASE_URL);
  url.searchParams.set("year", year);

  const response = await fetch(url, {
    headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": "live-golf-data.p.rapidapi.com" },
  });
  if (!response.ok) {
    throw new Error(`/schedule failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { schedule: ScheduleEntry[] };

  console.log(`Schedule for ${year}:\n`);
  for (const tournament of data.schedule) {
    const start = tournament.date.start.slice(0, 10);
    const end = tournament.date.end.slice(0, 10);
    console.log(`  ${tournament.tournId}  ${tournament.name}  (${start} - ${end})`);
  }
  console.log(`\nRe-run with a tournId: npx tsx scripts/add-tournament.ts ${year} <tournId>`);
}

async function addTournament(year: string, tournId: string, apiKey: string): Promise<void> {
  const externalId = `${year}:${tournId}`;
  const provider = new RapidApiGolfProvider(apiKey);
  const field = await provider.getField(externalId);

  const tournament = await prisma.tournament.upsert({
    where: { externalId },
    update: {
      name: field.name,
      startDate: new Date(field.startDate),
      endDate: new Date(field.endDate),
    },
    create: {
      externalId,
      name: field.name,
      startDate: new Date(field.startDate),
      endDate: new Date(field.endDate),
    },
  });

  const result = await ingestField(tournament.id, provider, prisma);
  console.log(
    `Added "${tournament.name}" (${externalId}) with ${result.total} golfers ` +
      `(${result.created} new, ${result.updated} updated).`,
  );
  console.log("Use this tournament when creating a pool.");
}

async function main() {
  const [year, tournId] = process.argv.slice(2);
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!year) {
    console.error("Usage: npx tsx scripts/add-tournament.ts <year> [tournId]");
    process.exitCode = 1;
    return;
  }
  if (!apiKey) {
    console.error("RAPIDAPI_KEY is not set. Add it to .env first.");
    process.exitCode = 1;
    return;
  }

  if (tournId) {
    await addTournament(year, tournId, apiKey);
  } else {
    await listSchedule(year, apiKey);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
