import { describe, expect, it } from "vitest";
import { computeStandings } from "./standings";
import type { TeamScoreResult } from "./types";

function result(totalToPar: number, counted: number[]): TeamScoreResult {
  return {
    totalToPar,
    contributions: counted.map((toPar, i) => ({
      golferId: `g${i}`,
      toPar,
      counted: true,
    })),
  };
}

describe("computeStandings", () => {
  it("ranks by total toPar ascending", () => {
    const standings = computeStandings([
      { poolMemberId: "team-a", result: result(2, [2]) },
      { poolMemberId: "team-b", result: result(-4, [-4]) },
      { poolMemberId: "team-c", result: result(0, [0]) },
    ]);

    expect(standings.map((s) => s.poolMemberId)).toEqual(["team-b", "team-c", "team-a"]);
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it("breaks ties using the best single counted golfer", () => {
    const standings = computeStandings([
      { poolMemberId: "team-a", result: result(0, [5, -5]) }, // best single -5
      { poolMemberId: "team-b", result: result(0, [1, -1]) }, // best single -1
    ]);

    expect(standings[0].poolMemberId).toBe("team-a");
    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(2);
  });

  it("gives tied teams the same rank and skips the next rank", () => {
    const standings = computeStandings([
      { poolMemberId: "team-a", result: result(0, [0]) },
      { poolMemberId: "team-b", result: result(0, [0]) },
      { poolMemberId: "team-c", result: result(1, [1]) },
    ]);

    const ranks = Object.fromEntries(standings.map((s) => [s.poolMemberId, s.rank]));
    expect(ranks["team-a"]).toBe(1);
    expect(ranks["team-b"]).toBe(1);
    expect(ranks["team-c"]).toBe(3);
  });
});
