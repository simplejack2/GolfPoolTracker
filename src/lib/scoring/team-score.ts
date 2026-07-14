import type {
  GolferContribution,
  GolferRoundResult,
  ScoringRules,
  TeamScoreResult,
} from "./types";

/**
 * Reduces a roster's per-golfer results to a team total under the pool's
 * countBestN and cut-penalty rules. Pure function: no DB/network access,
 * so it can be unit tested against fixture data independent of any live
 * score provider.
 */
export function computeTeamScore(
  roster: GolferRoundResult[],
  rules: ScoringRules,
): TeamScoreResult {
  const eligible = roster.filter(
    (g) => !(rules.cutPenalty.mode === "DROP" && g.status !== "ACTIVE"),
  );

  const effective = eligible.map((g) => {
    // A golfer who hasn't teed off yet has no score to penalize or count
    // beyond even par.
    const base = g.toPar ?? 0;
    const toPar =
      g.status !== "ACTIVE" && rules.cutPenalty.mode === "FIXED"
        ? base + rules.cutPenalty.value
        : base;
    return { golferId: g.golferId, toPar };
  });

  const sorted = [...effective].sort((a, b) => a.toPar - b.toPar);

  const contributions: GolferContribution[] = sorted.map((g, index) => ({
    golferId: g.golferId,
    toPar: g.toPar,
    counted: index < rules.countBestN,
  }));

  const totalToPar = contributions
    .filter((c) => c.counted)
    .reduce((sum, c) => sum + c.toPar, 0);

  return { totalToPar, contributions };
}
