"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Golfer {
  id: string;
  name: string;
  worldRank: number | null;
}

type PickResult = { error?: string; message?: string };

export function RosterBuilder({
  poolId,
  rosterSize,
  locked,
  picked,
  available,
  addAction,
  removeAction,
}: {
  poolId: string;
  rosterSize: number;
  locked: boolean;
  picked: Golfer[];
  available: Golfer[];
  addAction: (poolId: string, golferId: string) => Promise<PickResult>;
  removeAction: (poolId: string, golferId: string) => Promise<PickResult>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | undefined>();

  const rosterFull = picked.length >= rosterSize;

  function run(action: () => Promise<PickResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const filtered = available.filter((g) =>
    g.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Roster ({picked.length}/{rosterSize})
          </h2>
          {rosterFull ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Roster full
            </span>
          ) : null}
        </div>
        {picked.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No picks yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {picked.map((g) => (
              <li key={g.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>
                  {g.name}
                  {g.worldRank ? (
                    <span className="ml-2 text-zinc-400">#{g.worldRank}</span>
                  ) : null}
                </span>
                {!locked ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => removeAction(poolId, g.id))}
                    className="text-sm font-medium text-red-600 underline underline-offset-2 disabled:opacity-50 dark:text-red-400"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {!locked ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Available golfers</h2>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name..."
            className="mb-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No golfers match.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {filtered.map((g) => (
                <li key={g.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>
                    {g.name}
                    {g.worldRank ? (
                      <span className="ml-2 text-zinc-400">#{g.worldRank}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    disabled={isPending || rosterFull}
                    onClick={() => run(() => addAction(poolId, g.id))}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
