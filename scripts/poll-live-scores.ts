/**
 * Long-running score poller: every POLL_INTERVAL_SECONDS (default 90),
 * syncs scores for every tournament backing a LOCKED or LIVE pool.
 *
 * This is a plain script rather than a platform-specific cron job (Vercel
 * Cron, etc.) because the deploy platform isn't decided yet (see
 * CLAUDE.md build order, milestone 1) — run it with a process manager
 * (pm2, systemd, a Railway/Render worker) wherever the app ends up
 * deployed. Locally: `npm run poll`.
 *
 * Requires RAPIDAPI_KEY to actually pull live data — without it,
 * getDefaultGolfDataProvider() falls back to the mock provider, which is
 * harmless to poll but never changes.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getDefaultGolfDataProvider } from "../src/lib/data-adapter";
import { ingestScores } from "../src/lib/tournaments";

const POLL_INTERVAL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS ?? 90);

const prisma = new PrismaClient();

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function pollOnce(): Promise<void> {
  const pools = await prisma.pool.findMany({
    where: { status: { in: ["LOCKED", "LIVE"] } },
    select: { tournamentId: true },
    distinct: ["tournamentId"],
  });

  if (pools.length === 0) {
    log("No locked/live pools; nothing to poll.");
    return;
  }

  const provider = getDefaultGolfDataProvider();

  for (const { tournamentId } of pools) {
    try {
      const result = await ingestScores(tournamentId, provider, prisma);
      log(
        `Synced tournament ${tournamentId}: ${result.total} scores ` +
          `(${result.created} new, ${result.updated} updated, ${result.skipped} skipped)`,
      );
    } catch (error) {
      log(`Failed to sync tournament ${tournamentId}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function main() {
  log(`Polling every ${POLL_INTERVAL_SECONDS}s for LOCKED/LIVE pools' tournaments. Ctrl+C to stop.`);

  for (;;) {
    try {
      await pollOnce();
    } catch (error) {
      log(`Poll iteration failed: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(POLL_INTERVAL_SECONDS);
  }
}

main();
