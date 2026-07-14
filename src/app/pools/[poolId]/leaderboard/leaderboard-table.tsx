"use client";

import { useState } from "react";
import { formatToPar } from "@/lib/scoring";
import type { LeaderboardTeamRow } from "@/lib/leaderboard";

export function LeaderboardTable({
  rows,
  currentMemberId,
}: {
  rows: LeaderboardTeamRow[];
  currentMemberId?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {rows.map((row) => {
        const isExpanded = expanded.has(row.poolMemberId);
        const isMe = row.poolMemberId === currentMemberId;
        return (
          <div key={row.poolMemberId}>
            <button
              type="button"
              onClick={() => toggle(row.poolMemberId)}
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                isMe ? "bg-zinc-50 dark:bg-zinc-900/50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-zinc-400">{row.rank}</span>
                <div>
                  <p className="font-medium">{row.teamName}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">{row.userName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold">{formatToPar(row.totalToPar)}</span>
                <span className="text-zinc-400">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </button>
            {isExpanded ? (
              <ul className="divide-y divide-zinc-100 border-t border-zinc-200 bg-zinc-50/50 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/30">
                {row.golfers.map((g) => (
                  <li key={g.golferId} className="flex items-center justify-between py-2 pl-12 pr-4 text-sm">
                    <span className={g.counted ? "" : "text-zinc-400 line-through"}>
                      {g.name}
                      {g.status !== "ACTIVE" ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {g.status}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono">{g.hasScore ? formatToPar(g.toPar) : "—"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
