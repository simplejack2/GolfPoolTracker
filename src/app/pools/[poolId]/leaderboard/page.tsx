import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPool } from "@/lib/pools";
import { getLeaderboard } from "@/lib/leaderboard";
import { NotFoundError } from "@/lib/errors";
import { LeaderboardTable } from "./leaderboard-table";

export default async function LeaderboardPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const pool = await getPool(poolId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const membership = pool.members.find((m) => m.userId === user.id);
  if (!membership) {
    // Non-members have no standing to look up; send them back to the pool
    // page where they can join if it's open.
    redirect(`/pools/${poolId}`);
  }

  const rows = await getLeaderboard(poolId);

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
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        {pool.tournament.name} &middot; best {pool.countBestN} of {pool.rosterSize}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No teams yet.</p>
      ) : (
        <LeaderboardTable rows={rows} currentMemberId={membership.id} />
      )}
    </div>
  );
}
