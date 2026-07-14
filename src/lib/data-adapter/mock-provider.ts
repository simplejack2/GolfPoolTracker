import type { GolfDataProvider, LiveRoundScore, TournamentField } from "./types";

const MOCK_TOURNAMENT_ID = "mock-2026-classic";

const MOCK_FIELD: TournamentField = {
  externalId: MOCK_TOURNAMENT_ID,
  name: "Mock Classic",
  startDate: "2026-07-16",
  endDate: "2026-07-19",
  golfers: [
    { externalId: "g1", name: "Alex Rivera", worldRank: 3 },
    { externalId: "g2", name: "Sam Okafor", worldRank: 12 },
    { externalId: "g3", name: "Jamie Whitfield", worldRank: 27 },
    { externalId: "g4", name: "Priya Nadeem", worldRank: 41 },
    { externalId: "g5", name: "Chris Delgado", worldRank: 58 },
    { externalId: "g6", name: "Morgan Blake", worldRank: 76 },
    { externalId: "g7", name: "Taylor Voss", worldRank: 94 },
    { externalId: "g8", name: "Devon Ashworth", worldRank: 110 },
  ],
};

const MOCK_SCORES: LiveRoundScore[] = [
  { externalGolferId: "g1", round: 1, strokes: 67, toPar: -5, thru: 18, position: "1", status: "ACTIVE" },
  { externalGolferId: "g2", round: 1, strokes: 69, toPar: -3, thru: 18, position: "2", status: "ACTIVE" },
  { externalGolferId: "g3", round: 1, strokes: 70, toPar: -2, thru: 18, position: "3", status: "ACTIVE" },
  { externalGolferId: "g4", round: 1, strokes: 71, toPar: -1, thru: 18, position: "T4", status: "ACTIVE" },
  { externalGolferId: "g5", round: 1, strokes: 72, toPar: 0, thru: 18, position: "T4", status: "ACTIVE" },
  { externalGolferId: "g6", round: 1, strokes: 75, toPar: 3, thru: 18, position: "6", status: "ACTIVE" },
  { externalGolferId: "g7", round: 1, strokes: 78, toPar: 6, thru: 18, position: "7", status: "CUT" },
  { externalGolferId: "g8", round: 1, strokes: null, toPar: null, thru: null, position: null, status: "WD" },
];

/**
 * Static in-memory provider used for local development and tests before a
 * live golf data API is wired up (build plan milestone 4/5). Implements
 * the same GolfDataProvider interface a real provider would, so the
 * scoring engine and UI can be built against it and later pointed at a
 * live provider with no other changes.
 */
export class MockGolfDataProvider implements GolfDataProvider {
  async getField(externalTournamentId: string): Promise<TournamentField> {
    if (externalTournamentId !== MOCK_TOURNAMENT_ID) {
      throw new Error(`MockGolfDataProvider has no field for "${externalTournamentId}"`);
    }
    return MOCK_FIELD;
  }

  async getScores(externalTournamentId: string): Promise<LiveRoundScore[]> {
    if (externalTournamentId !== MOCK_TOURNAMENT_ID) {
      throw new Error(`MockGolfDataProvider has no scores for "${externalTournamentId}"`);
    }
    return MOCK_SCORES;
  }
}

export { MOCK_TOURNAMENT_ID };
