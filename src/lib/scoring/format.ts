/** Formats a toPar value the way golf leaderboards conventionally do: "E" for even, "+n" over, "-n" under. */
export function formatToPar(toPar: number): string {
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}
