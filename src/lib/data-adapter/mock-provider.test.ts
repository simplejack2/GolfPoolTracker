import { describe, expect, it } from "vitest";
import { MOCK_TOURNAMENT_ID, MockGolfDataProvider } from "./mock-provider";

describe("MockGolfDataProvider", () => {
  const provider = new MockGolfDataProvider();

  it("returns a field of golfers", async () => {
    const field = await provider.getField(MOCK_TOURNAMENT_ID);
    expect(field.golfers.length).toBeGreaterThan(0);
  });

  it("returns a score for every golfer in the field", async () => {
    const field = await provider.getField(MOCK_TOURNAMENT_ID);
    const scores = await provider.getScores(MOCK_TOURNAMENT_ID);
    const scoredIds = new Set(scores.map((s) => s.externalGolferId));
    for (const golfer of field.golfers) {
      expect(scoredIds.has(golfer.externalId)).toBe(true);
    }
  });

  it("rejects an unknown tournament id", async () => {
    await expect(provider.getField("unknown")).rejects.toThrow();
    await expect(provider.getScores("unknown")).rejects.toThrow();
  });
});
