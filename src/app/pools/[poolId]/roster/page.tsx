import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { NotFoundError } from "@/lib/errors";
import { getPool } from "@/lib/pools";
import { getRoster, isPicksLocked } from "@/lib/roster";
import { addPickAction, removePickAction } from "@/app/actions/roster";
import { RosterBuilder } from "./roster-builder";

export default async function RosterPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const pool = await getPool(poolId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const isMember = pool.members.some((m) => m.userId === user.id);
  if (!isMember) {
    // Non-members have no roster to manage; send them back to the pool page
    // where they can join if it's open.
    redirect(`/pools/${poolId}`);
  }

  const [roster, field] = await Promise.all([
    getRoster(poolId, user.id),
    prisma.golfer.findMany({
      where: { tournamentId: pool.tournamentId },
      orderBy: [{ worldRank: "asc" }, { name: "asc" }],
    }),
  ]);

  const locked = isPicksLocked(pool);
  const pickedIds = new Set(roster.map((r) => r.golferId));

  const picked = roster.map((r) => ({
    id: r.golfer.id,
    name: r.golfer.name,
    worldRank: r.golfer.worldRank,
  }));
  const available = field
    .filter((g) => !pickedIds.has(g.id))
    .map((g) => ({ id: g.id, name: g.name, worldRank: g.worldRank }));

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="mb-2">
        <Link
          href={`/pools/${poolId}`}
          className="text-sm text-zinc-500 underline underline-offset-2 dark:text-zinc-400"
        >
          &larr; {pool.name}
        </Link>
      </div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Your picks</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        {pool.tournament.name} &middot; pick {pool.rosterSize} golfers
      </p>

      {locked ? (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Picks are locked. {pool.status === "DRAFT" || pool.status === "OPEN"
            ? `The deadline (${pool.lockAt.toLocaleString()}) has passed.`
            : `This pool is ${pool.status}.`}
        </div>
      ) : (
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Picks lock at {pool.lockAt.toLocaleString()}.
        </p>
      )}

      {field.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No golfers in the field yet. The commissioner needs to sync the tournament field from
          the pool page.
        </p>
      ) : (
        <RosterBuilder
          poolId={poolId}
          rosterSize={pool.rosterSize}
          locked={locked}
          picked={picked}
          available={available}
          addAction={addPickAction}
          removeAction={removePickAction}
        />
      )}
    </div>
  );
}
