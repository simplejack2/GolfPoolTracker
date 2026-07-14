import { describe, expect, it } from "vitest";
import { computeTeamScore } from "./team-score";
import type { GolferRoundResult } from "./types";

function golfer(golferId: string, toPar: number | null, status: GolferRoundResult["status"] = "ACTIVE"): GolferRoundResult {
  return { golferId, toPar, status };
}

describe("computeTeamScore", () => {
  it("sums only the best N scores", () => {
    const roster = [
      golfer("a", -5),
      golfer("b", -2),
      golfer("c", 1),
      golfer("d", 4),
    ];

    const result = computeTeamScore(roster, {
      countBestN: 2,
      cutPenalty: { mode: "DROP" },
    });

    expect(result.totalToPar).toBe(-7); // -5 + -2
    expect(result.contributions.filter((c) => c.counted).map((c) => c.golferId)).toEqual(["a", "b"]);
  });

  it("drops cut/WD golfers entirely under DROP mode", () => {
    const roster = [
      golfer("a", -5),
      golfer("b", -10, "CUT"), // would be best score, but dropped
      golfer("c", 1),
    ];

    const result = computeTeamScore(roster, {
      countBestN: 2,
      cutPenalty: { mode: "DROP" },
    });

    expect(result.contributions.some((c) => c.golferId === "b")).toBe(false);
    expect(result.totalToPar).toBe(-4); // -5 + 1
  });

  it("applies a fixed penalty to cut/WD golfers but keeps them eligible", () => {
    const roster = [
      golfer("a", -5),
      golfer("b", 2, "CUT"),
      golfer("c", 6),
    ];

    const result = computeTeamScore(roster, {
      countBestN: 2,
      cutPenalty: { mode: "FIXED", value: 8 },
    });

    // b's effective score becomes 2 + 8 = 10, worse than both a (-5) and c (6)
    expect(result.totalToPar).toBe(1); // -5 + 6
    expect(result.contributions.find((c) => c.golferId === "b")?.toPar).toBe(10);
    expect(result.contributions.find((c) => c.golferId === "b")?.counted).toBe(false);
  });

  it("treats a golfer with no score yet as even par", () => {
    const roster = [golfer("a", null), golfer("b", 3)];

    const result = computeTeamScore(roster, {
      countBestN: 1,
      cutPenalty: { mode: "DROP" },
    });

    expect(result.totalToPar).toBe(0);
    expect(result.contributions.find((c) => c.golferId === "a")?.counted).toBe(true);
  });

  it("counts every golfer when countBestN meets or exceeds roster size", () => {
    const roster = [golfer("a", 1), golfer("b", -1)];

    const result = computeTeamScore(roster, {
      countBestN: 8,
      cutPenalty: { mode: "DROP" },
    });

    expect(result.totalToPar).toBe(0);
    expect(result.contributions.every((c) => c.counted)).toBe(true);
  });
});
