"use client";

import { useActionState } from "react";
import { joinPoolAction } from "@/app/actions/pools";

export function JoinForm({ poolId, defaultTeamName }: { poolId: string; defaultTeamName: string }) {
  const action = joinPoolAction.bind(null, poolId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">Team name</label>
        <input
          name="teamName"
          type="text"
          required
          defaultValue={defaultTeamName}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Joining..." : "Join pool"}
      </button>
      {error ? <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </form>
  );
}
