"use client";

import { useActionState } from "react";
import { updateTeamNameAction } from "@/app/actions/pools";

export function TeamNameForm({ poolId, currentTeamName }: { poolId: string; currentTeamName: string }) {
  const action = updateTeamNameAction.bind(null, poolId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">Your team name</label>
        <input
          name="teamName"
          type="text"
          required
          defaultValue={currentTeamName}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {isPending ? "Saving..." : "Save"}
      </button>
      {error ? <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </form>
  );
}
