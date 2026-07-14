import type { GolferStatus } from "@/lib/scoring";

export interface FieldGolfer {
  externalId: string;
  name: string;
  worldRank?: number;
}

export interface TournamentField {
  externalId: string;
  name: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  golfers: FieldGolfer[];
}

export interface LiveRoundScore {
  externalGolferId: string;
  round: number;
  strokes: number | null;
  toPar: number | null;
  thru: number | null;
  position: string | null;
  status: GolferStatus;
}

/**
 * Normalized interface every live-score provider must implement. The
 * scoring engine and the rest of the app only ever talk to this shape, so
 * swapping providers (or falling back to the mock provider during
 * development) never touches pool/scoring logic.
 */
export interface GolfDataProvider {
  getField(externalTournamentId: string): Promise<TournamentField>;
  getScores(externalTournamentId: string): Promise<LiveRoundScore[]>;
}
