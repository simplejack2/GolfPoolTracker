import type { TeamScoreResult, TeamStanding } from "./types";

export interface TeamResult {
  poolMemberId: string;
  result: TeamScoreResult;
}

/**
 * Ranks teams by total toPar (lower is better), breaking ties by each
 * team's best single counted golfer. Uses standard competition ranking
 * (equal scores share a rank; the next rank skips accordingly, e.g. 1,1,3).
 */
export function computeStandings(teams: TeamResult[]): TeamStanding[] {
  const withTiebreak = teams.map((team) => {
    const countedToPars = team.result.contributions
      .filter((c) => c.counted)
      .map((c) => c.toPar)
      .sort((a, b) => a - b);
    const bestSingle = countedToPars.length > 0 ? countedToPars[0] : Infinity;
    return { ...team, bestSingle };
  });

  const sorted = [...withTiebreak].sort((a, b) => {
    if (a.result.totalToPar !== b.result.totalToPar) {
      return a.result.totalToPar - b.result.totalToPar;
    }
    return a.bestSingle - b.bestSingle;
  });

  const standings: TeamStanding[] = [];
  let prevTotal: number | null = null;
  let prevBestSingle: number | null = null;
  let prevRank = 0;

  sorted.forEach((team, index) => {
    const tiedWithPrevious =
      prevTotal === team.result.totalToPar && prevBestSingle === team.bestSingle;
    const rank = tiedWithPrevious ? prevRank : index + 1;

    standings.push({
      poolMemberId: team.poolMemberId,
      totalToPar: team.result.totalToPar,
      rank,
    });

    prevTotal = team.result.totalToPar;
    prevBestSingle = team.bestSingle;
    prevRank = rank;
  });

  return standings;
}
