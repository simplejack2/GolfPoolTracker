import { describe, expect, it, vi } from "vitest";
import { parseToPar, RapidApiGolfProvider } from "./rapidapi-provider";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("parseToPar", () => {
  it("parses even par", () => {
    expect(parseToPar("E")).toBe(0);
    expect(parseToPar("e")).toBe(0);
  });
  it("parses under and over par", () => {
    expect(parseToPar("-5")).toBe(-5);
    expect(parseToPar("+3")).toBe(3);
  });
  it("treats missing/placeholder values as null", () => {
    expect(parseToPar(null)).toBeNull();
    expect(parseToPar(undefined)).toBeNull();
    expect(parseToPar("")).toBeNull();
    expect(parseToPar("--")).toBeNull();
  });
});

describe("RapidApiGolfProvider", () => {
  it("throws when constructed without an API key", () => {
    expect(() => new RapidApiGolfProvider("")).toThrow();
  });

  it("rejects an externalId not in the {year}:{tournId} composite format", async () => {
    const provider = new RapidApiGolfProvider("key", { fetchImpl: vi.fn() });
    await expect(provider.getField("just-an-id")).rejects.toThrow(/year.*tournId/i);
  });

  it("maps a /tournament response to TournamentField", async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit): Promise<Response> => {
      void init;
      expect(String(url)).toContain("/tournament");
      expect(String(url)).toContain("tournId=006");
      expect(String(url)).toContain("year=2025");
      return jsonResponse({
        tournId: "006",
        name: "Sample Open",
        date: { start: "2025-02-06T08:00:00Z", end: "2025-02-09T23:00:00Z" },
        players: [
          { player: { playerId: "1", firstName: "Collin", lastName: "Morikawa", status: "active" } },
          { player: { playerId: "2", firstName: "Will", lastName: "Zalatoris", status: "active" } },
        ],
      });
    });
    const provider = new RapidApiGolfProvider("key", { fetchImpl: fetchImpl as unknown as typeof fetch });

    const field = await provider.getField("2025:006");

    expect(field.externalId).toBe("2025:006");
    expect(field.name).toBe("Sample Open");
    expect(field.startDate).toBe("2025-02-06T08:00:00Z");
    expect(field.golfers).toEqual([
      { externalId: "1", name: "Collin Morikawa" },
      { externalId: "2", name: "Will Zalatoris" },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-rapidapi-key"]).toBe("key");
    expect(headers["x-rapidapi-host"]).toBe("live-golf-data.p.rapidapi.com");
  });

  it("maps a /leaderboard response to LiveRoundScore[], using the round matching roundId for strokes", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        tournId: "006",
        roundId: 2,
        roundStatus: "In Progress",
        leaderboardRows: [
          {
            playerId: "1",
            status: "active",
            total: "-4",
            position: "T1",
            currentHole: 14,
            roundComplete: false,
            rounds: [
              { roundId: 1, strokes: 68, scoreToPar: "-4" },
              { roundId: 2, strokes: 70, scoreToPar: "0" },
            ],
          },
          {
            playerId: "2",
            status: "cut",
            total: "+6",
            position: "70",
            roundComplete: true,
            rounds: [{ roundId: 1, strokes: 78, scoreToPar: "+6" }],
          },
          {
            playerId: "3",
            status: "wd",
            total: "--",
            position: "WD",
          },
        ],
      }),
    );
    const provider = new RapidApiGolfProvider("key", { fetchImpl: fetchImpl as unknown as typeof fetch });

    const scores = await provider.getScores("2025:006");

    expect(scores).toEqual([
      {
        externalGolferId: "1",
        round: 2,
        strokes: 70,
        toPar: -4,
        thru: 14,
        position: "T1",
        status: "ACTIVE",
      },
      {
        externalGolferId: "2",
        round: 2,
        strokes: null, // no rounds[] entry for roundId 2
        toPar: 6,
        thru: 18, // roundComplete
        position: "70",
        status: "CUT",
      },
      {
        externalGolferId: "3",
        round: 2,
        strokes: null,
        toPar: null,
        thru: null,
        position: "WD",
        status: "WD",
      },
    ]);
  });

  it("throws with the status code when the API responds with an error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "nope" }, 429));
    const provider = new RapidApiGolfProvider("key", { fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(provider.getScores("2025:006")).rejects.toThrow(/429/);
  });
});
