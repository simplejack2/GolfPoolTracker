"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { knownErrorMessage } from "@/lib/errors";
import { addPick, removePick } from "@/lib/roster";
import { ingestField } from "@/lib/tournaments";
import { getPool } from "@/lib/pools";
import { ForbiddenError } from "@/lib/errors";
import { MockGolfDataProvider } from "@/lib/data-adapter";

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
 * upsert Golfer rows. Currently hard-wired to the mock provider — when a
 * live provider lands, this is the one call site to swap (or route through
 * a provider registry).
 */
export async function syncFieldAction(poolId: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  try {
    const pool = await getPool(poolId);
    if (pool.ownerId !== userId) {
      throw new ForbiddenError("Only the pool owner can sync the field");
    }

    const result = await ingestField(pool.tournamentId, new MockGolfDataProvider());
    revalidatePath(`/pools/${poolId}`);
    revalidatePath(`/pools/${poolId}/roster`);
    return {
      message: `Synced ${result.total} golfers (${result.created} new, ${result.updated} updated).`,
    };
  } catch (error) {
    return { error: knownErrorMessage(error) };
  }
}
