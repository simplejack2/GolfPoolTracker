import type { GolferStatus } from "@/lib/scoring";
import type { GolfDataProvider, LiveRoundScore, TournamentField } from "./types";

const BASE_URL = "https://live-golf-data.p.rapidapi.com";
const HOST = "live-golf-data.p.rapidapi.com";

// Raw shapes from the Slash Golf ("Live Golf Data") OpenAPI spec
// (github.com/slashgolf/slashgolf/blob/main/docs/openapi.yaml). Only the
// fields we actually consume are declared.
interface RawTournamentResponse {
  tournId: string;
  name: string;
  date: { start: string; end: string };
  players: Array<{
    player: {
      playerId: string;
      firstName: string;
      lastName: string;
      status?: string;
    };
  }>;
}

interface RawLeaderboardRow {
  playerId: string;
  status?: string;
  total?: string;
  position?: string;
  currentHole?: number;
  roundComplete?: boolean;
  rounds?: Array<{ roundId: number; strokes: number; scoreToPar: string }>;
}

interface RawLeaderboardResponse {
  roundId: number;
  leaderboardRows: RawLeaderboardRow[];
}

/** "E" -> 0, "+3" -> 3, "-5" -> -5, missing/"--"/unparseable -> null. */
export function parseToPar(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "--") return null;
  if (trimmed.toUpperCase() === "E") return 0;
  const parsed = Number(trimmed.replace(/^\+/, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

function mapStatus(raw: string | undefined): GolferStatus {
  switch (raw) {
    case "cut":
      return "CUT";
    case "wd":
      return "WD";
    case "dq":
      return "DQ";
    default:
      // "active" and "complete" (finished today's round, still competing)
      // both mean the golfer is still in the tournament.
      return "ACTIVE";
  }
}

/**
 * This API identifies a tournament by (tournId, year) together, but
 * GolfDataProvider takes a single externalId string. Rather than change
 * the interface for one provider's quirk, a Tournament's externalId is a
 * composite "{year}:{tournId}" string for this provider (e.g. "2025:006"
 * — see the tournId/year examples in the OpenAPI spec) — parsed back
 * apart here, never exposed outside this file.
 */
function parseExternalId(externalId: string): { year: string; tournId: string } {
  const [year, tournId] = externalId.split(":");
  if (!year || !tournId) {
    throw new Error(
      `RapidApiGolfProvider: externalId "${externalId}" must be formatted "{year}:{tournId}" (e.g. "2025:006")`,
    );
  }
  return { year, tournId };
}

export interface RapidApiGolfProviderOptions {
  /** "1" (PGA Tour, default) or "2" per the API's orgId enum. */
  orgId?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export class RapidApiGolfProvider implements GolfDataProvider {
  private readonly apiKey: string;
  private readonly orgId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, options: RapidApiGolfProviderOptions = {}) {
    if (!apiKey) {
      throw new Error("RapidApiGolfProvider requires a RapidAPI key");
    }
    this.apiKey = apiKey;
    this.orgId = options.orgId ?? "1";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(url, {
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": HOST,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`RapidApiGolfProvider: ${path} failed (${response.status}): ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async getField(externalTournamentId: string): Promise<TournamentField> {
    const { year, tournId } = parseExternalId(externalTournamentId);
    const data = await this.request<RawTournamentResponse>("/tournament", {
      tournId,
      year,
      orgId: this.orgId,
    });

    return {
      externalId: externalTournamentId,
      name: data.name,
      startDate: data.date.start,
      endDate: data.date.end,
      golfers: data.players.map((entry) => ({
        externalId: entry.player.playerId,
        name: `${entry.player.firstName} ${entry.player.lastName}`,
      })),
    };
  }

  async getScores(externalTournamentId: string): Promise<LiveRoundScore[]> {
    const { year, tournId } = parseExternalId(externalTournamentId);
    const data = await this.request<RawLeaderboardResponse>("/leaderboard", {
      tournId,
      year,
      orgId: this.orgId,
    });

    return data.leaderboardRows.map((row) => {
      const roundEntry = row.rounds?.find((r) => r.roundId === data.roundId);
      return {
        externalGolferId: row.playerId,
        round: data.roundId,
        strokes: roundEntry?.strokes ?? null,
        toPar: parseToPar(row.total),
        thru: row.roundComplete ? 18 : (row.currentHole ?? null),
        position: row.position ?? null,
        status: mapStatus(row.status),
      };
    });
  }
}
