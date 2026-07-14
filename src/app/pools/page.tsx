import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listPoolsForUser } from "@/lib/pools";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  OPEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  LOCKED: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  LIVE: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  COMPLETE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function PoolsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const pools = await listPoolsForUser(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your pools</h1>
        <Link
          href="/pools/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create a pool
        </Link>
      </div>

      {pools.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You haven&apos;t joined or created any pools yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {pools.map((pool) => (
            <li key={pool.id}>
              <Link
                href={`/pools/${pool.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <div>
                  <p className="font-medium">{pool.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {pool.tournament.name} &middot; {pool.members.length}{" "}
                    {pool.members.length === 1 ? "team" : "teams"} &middot; best {pool.countBestN} of{" "}
                    {pool.rosterSize}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[pool.status]}`}
                >
                  {pool.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
