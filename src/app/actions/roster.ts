"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { ForbiddenError, knownErrorMessage } from "@/lib/errors";
import { addPick, removePick } from "@/lib/roster";
import { ingestField, ingestScores } from "@/lib/tournaments";
import { getPool } from "@/lib/pools";
import { getDefaultGolfDataProvider } from "@/lib/data-adapter";

type ActionResult = { error?: string; message?: string };

export async function addPickAction(poolId: string, golferId: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  try {
    await addPick(poolId, userId, golferId);
  } catch (error) {
    return { error: knownErrorMessage(error) };
  }

  revalidatePath(`/pools/${poolId}/roster`);
  return {};
}

export async function removePickAction(poolId: string, golferId: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  try {
    await removePick(poolId, userId, golferId);
  } catch (error) {
    return { error: knownErrorMessage(error) };
  }

  revalidatePath(`/pools/${poolId}/roster`);
  return {};
}

/**
 * Commissioner-only: pull the tournament field from the data provider and
 * upsert Golfer rows. Uses the live RapidAPI provider when RAPIDAPI_KEY is
 * set, otherwise the mock provider (see getDefaultGolfDataProvider).
 */
export async function syncFieldAction(poolId: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  try {
    const pool = await getPool(poolId);
    if (pool.ownerId !== userId) {
      throw new ForbiddenError("Only the pool owner can sync the field");
    }

    const result = await ingestField(pool.tournamentId, getDefaultGolfDataProvider());
    revalidatePath(`/pools/${poolId}`);
    revalidatePath(`/pools/${poolId}/roster`);
    return {
      message: `Synced ${result.total} golfers (${result.created} new, ${result.updated} updated).`,
    };
  } catch (error) {
    return { error: knownErrorMessage(error) };
  }
}

/**
 * Commissioner-only: pull current scores from the data provider and
 * upsert GolferScore rows. Same provider selection as syncFieldAction.
 */
export async function syncScoresAction(poolId: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  try {
    const pool = await getPool(poolId);
    if (pool.ownerId !== userId) {
      throw new ForbiddenError("Only the pool owner can sync scores");
    }

    const result = await ingestScores(pool.tournamentId, getDefaultGolfDataProvider());
    revalidatePath(`/pools/${poolId}`);
    revalidatePath(`/pools/${poolId}/leaderboard`);
    const skippedNote = result.skipped > 0 ? ` (${result.skipped} skipped — sync the field first)` : "";
    return {
      message: `Synced ${result.total} scores (${result.created} new, ${result.updated} updated)${skippedNote}.`,
    };
  } catch (error) {
    return { error: knownErrorMessage(error) };
  }
}
