"use client";

import { useActionState, useState } from "react";
import { createPoolAction } from "@/app/actions/pools";

interface Tournament {
  id: string;
  name: string;
}

export function CreatePoolForm({ tournaments, defaultTeamName }: { tournaments: Tournament[]; defaultTeamName: string }) {
  const [error, formAction, isPending] = useActionState(createPoolAction, undefined);
  const [cutPenaltyMode, setCutPenaltyMode] = useState<"DROP" | "FIXED">("DROP");

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Pool name">
        <input
          name="name"
          type="text"
          required
          placeholder="Office Pool 2026"
          className={inputClasses}
        />
      </Field>

      <Field label="Tournament">
        <select name="tournamentId" required className={inputClasses} defaultValue={tournaments[0]?.id ?? ""}>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Roster size">
          <input name="rosterSize" type="number" min={1} required defaultValue={8} className={inputClasses} />
        </Field>
        <Field label="Count best N">
          <input name="countBestN" type="number" min={1} required defaultValue={4} className={inputClasses} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Scoring mode">
          <select name="scoringMode" defaultValue="STROKE_PLAY" className={inputClasses}>
            <option value="STROKE_PLAY">Stroke play</option>
            <option value="STABLEFORD">Stableford</option>
          </select>
        </Field>
        <Field label="Buy-in ($, optional)">
          <input name="buyIn" type="number" min={0} step="0.01" className={inputClasses} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Cut/WD penalty">
          <select
            name="cutPenaltyMode"
            value={cutPenaltyMode}
            onChange={(e) => setCutPenaltyMode(e.target.value as "DROP" | "FIXED")}
            className={inputClasses}
          >
            <option value="DROP">Drop from scoring</option>
            <option value="FIXED">Add fixed penalty strokes</option>
          </select>
        </Field>
        {cutPenaltyMode === "FIXED" ? (
          <Field label="Penalty strokes">
            <input
              name="cutPenaltyValue"
              type="number"
              min={0}
              required
              defaultValue={8}
              className={inputClasses}
            />
          </Field>
        ) : null}
      </div>

      <Field label="Picks lock at">
        <input name="lockAt" type="datetime-local" required className={inputClasses} />
      </Field>

      <Field label="Your team name">
        <input
          name="ownerTeamName"
          type="text"
          required
          defaultValue={defaultTeamName}
          className={inputClasses}
        />
      </Field>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Creating..." : "Create pool"}
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
