"use client";

import { useActionState } from "react";
import { updatePoolRulesAction } from "@/app/actions/pools";

interface PoolRules {
  name: string;
  scoringMode: string;
  countBestN: number;
  rosterSize: number;
  lockAt: string; // "YYYY-MM-DDTHH:mm", local time, for a datetime-local input
  buyIn: string | null;
  status: string;
}

export function EditRulesForm({ poolId, pool }: { poolId: string; pool: PoolRules }) {
  const action = updatePoolRulesAction.bind(null, poolId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">Pool settings</h2>

      <Field label="Pool name">
        <input name="name" type="text" defaultValue={pool.name} className={inputClasses} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Roster size">
          <input name="rosterSize" type="number" min={1} defaultValue={pool.rosterSize} className={inputClasses} />
        </Field>
        <Field label="Count best N">
          <input name="countBestN" type="number" min={1} defaultValue={pool.countBestN} className={inputClasses} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Scoring mode">
          <select name="scoringMode" defaultValue={pool.scoringMode} className={inputClasses}>
            <option value="STROKE_PLAY">Stroke play</option>
            <option value="STABLEFORD">Stableford</option>
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={pool.status} className={inputClasses}>
            <option value="DRAFT">Draft</option>
            <option value="OPEN">Open</option>
            <option value="LOCKED">Locked</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Picks lock at">
          <input name="lockAt" type="datetime-local" defaultValue={pool.lockAt} className={inputClasses} />
        </Field>
        <Field label="Buy-in ($)">
          <input
            name="buyIn"
            type="number"
            min={0}
            step="0.01"
            defaultValue={pool.buyIn ?? ""}
            className={inputClasses}
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}

const inputClasses =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
