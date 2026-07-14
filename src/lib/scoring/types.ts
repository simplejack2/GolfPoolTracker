export type GolferStatus = "ACTIVE" | "CUT" | "WD" | "DQ";

export interface GolferRoundResult {
  golferId: string;
  /** Cumulative strokes relative to par. Null when the golfer hasn't teed off yet. */
  toPar: number | null;
  status: GolferStatus;
}

export type CutPenalty =
  // Golfer is removed from the team entirely once cut/WD/DQ; the best-N
  // pool is drawn only from remaining active golfers.
  | { mode: "DROP" }
  // Golfer stays eligible but a fixed number of strokes is added to their
  // toPar once cut/WD/DQ (e.g. +8 for a missed cut).
  | { mode: "FIXED"; value: number };

export interface ScoringRules {
  /** How many of the roster's scores count toward the team total. */
  countBestN: number;
  cutPenalty: CutPenalty;
}

export interface GolferContribution {
  golferId: string;
  /** Effective toPar after any cut penalty has been applied. */
  toPar: number;
  /** Whether this golfer's score is one of the best N counted for the team. */
  counted: boolean;
}

export interface TeamScoreResult {
  totalToPar: number;
  contributions: GolferContribution[];
}

export interface TeamStanding {
  poolMemberId: string;
  totalToPar: number;
  rank: number;
}
