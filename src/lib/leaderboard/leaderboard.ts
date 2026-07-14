import type { GolferStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { NotFoundError } from "@/lib/errors";
import { computeStandings, computeTeamScore } from "@/lib/scoring";
import type { GolferRoundResult, ScoringRules } from "@/lib/scoring";

export interface LeaderboardGolferRow {
  golferId: string;
  name: string;
  /** Effective toPar (after any FIXED cut penalty). Unpenalized last-known toPar if dropped. */
  toPar: number;
  /** Whether this golfer's score is one of the team's best-N counted scores. */
  counted: boolean;
  status: GolferStatus;
  /** False if the golfer hasn't been scored yet (toPar is a 0 placeholder, not a real even-par round). */
  hasScore: boolean;
}

export interface LeaderboardTeamRow {
  poolMemberId: string;
  teamName: string;
  userName: string;
  rank: number;
  totalToPar: number;
  golfers: LeaderboardGolferRow[];
}

/**
 * Joins roster picks with each golfer's latest score and runs them through
 * the scoring engine (src/lib/scoring) to produce a ranked leaderboard.
 * Computed on read, not cached — the `Standing` table stays unused until
 * read load actually calls for it (see CLAUDE.md).
 */
export async function getLeaderboard(
  poolId: string,
  db: PrismaClient = prisma,
): Promise<LeaderboardTeamRow[]> {
  const pool = await db.pool.findUnique({ where: { id: poolId } });
  if (!pool) {
    throw new NotFoundError(`Pool "${poolId}" not found`);
  }

  const members = await db.poolMember.findMany({
    where: { poolId },
    include: {
      user: true,
      roster: { include: { golfer: true } },
    },
  });

  const golferIds = Array.from(new Set(members.flatMap((m) => m.roster.map((r) => r.golferId))));

  const scores = golferIds.length
    ? await db.golferScore.findMany({
        where: { golferId: { in: golferIds } },
        orderBy: { round: "desc" },
      })
    : [];

  // Scores are ordered round-desc, so the first hit per golfer is their
  // latest (current) score.
  const latestScoreByGolferId = new Map<string, (typeof scores)[number]>();
  for (const score of scores) {
    if (!latestScoreByGolferId.has(score.golferId)) {
      latestScoreByGolferId.set(score.golferId, score);
    }
  }

  const rules: ScoringRules = {
    countBestN: pool.countBestN,
    cutPenalty:
      pool.cutPenaltyMode === "FIXED"
        ? { mode: "FIXED", value: pool.cutPenaltyValue ?? 0 }
        : { mode: "DROP" },
  };

  const teamData = members.map((member) => {
    const golferResults: GolferRoundResult[] = member.roster.map((pick) => {
      const latest = latestScoreByGolferId.get(pick.golferId);
      return {
        golferId: pick.golferId,
        toPar: latest?.toPar ?? null,
        status: latest?.status ?? "ACTIVE",
      };
    });
    return { member, result: computeTeamScore(golferResults, rules) };
  });

  const standings = computeStandings(
    teamData.map((t) => ({ poolMemberId: t.member.id, result: t.result })),
  );
  const rankByMemberId = new Map(standings.map((s) => [s.poolMemberId, s.rank]));

  const rows: LeaderboardTeamRow[] = teamData.map(({ member, result }) => {
    // Build the display list from the full roster, not just
    // result.contributions — under DROP cut-penalty mode, a cut/WD/DQ
    // golfer is excluded from contributions entirely, but the UI still
    // needs to show the pick with a "dropped" status rather than making
    // it silently vanish.
    const contributionByGolferId = new Map(result.contributions.map((c) => [c.golferId, c]));

    const golfers: LeaderboardGolferRow[] = member.roster.map((pick) => {
      const latest = latestScoreByGolferId.get(pick.golferId);
      const contribution = contributionByGolferId.get(pick.golferId);
      return {
        golferId: pick.golferId,
        name: pick.golfer.name,
        toPar: contribution?.toPar ?? latest?.toPar ?? 0,
        counted: contribution?.counted ?? false,
        status: latest?.status ?? "ACTIVE",
        hasScore: latest !== undefined,
      };
    });

    return {
      poolMemberId: member.id,
      teamName: member.teamName,
      userName: member.user.name ?? member.user.email,
      rank: rankByMemberId.get(member.id) ?? 0,
      totalToPar: result.totalToPar,
      golfers,
    };
  });

  return rows.sort((a, b) => a.rank - b.rank);
}
