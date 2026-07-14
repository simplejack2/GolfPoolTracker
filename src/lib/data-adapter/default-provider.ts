import { MockGolfDataProvider } from "./mock-provider";
import { RapidApiGolfProvider } from "./rapidapi-provider";
import type { GolfDataProvider } from "./types";

/**
 * Picks the live provider when RAPIDAPI_KEY is configured, falling back to
 * the mock provider otherwise so local dev/tests keep working without a
 * key. This is the one place that decides which provider backs the app;
 * everything else (sync actions, ingestion) depends only on
 * GolfDataProvider.
 */
export function getDefaultGolfDataProvider(): GolfDataProvider {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (apiKey) {
    return new RapidApiGolfProvider(apiKey);
  }
  return new MockGolfDataProvider();
}
