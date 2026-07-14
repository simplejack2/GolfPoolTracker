"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import * as pools from "@/lib/pools";

type ActionError = string | undefined;

function knownErrorMessage(error: unknown): string {
  if (
    error instanceof ValidationError ||
    error instanceof ForbiddenError ||
    error instanceof ConflictError ||
    error instanceof NotFoundError
  ) {
    return error.message;
  }
  throw error;
}

export async function createPoolAction(_prevState: ActionError, formData: FormData): Promise<ActionError> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  let pool;
  try {
    pool = await pools.createPool(userId, {
      name: formData.get("name"),
      tournamentId: formData.get("tournamentId"),
      scoringMode: formData.get("scoringMode") || undefined,
      countBestN: formData.get("countBestN"),
      rosterSize: formData.get("rosterSize"),
      lockAt: formData.get("lockAt"),
      buyIn: formData.get("buyIn") || undefined,
      ownerTeamName: formData.get("ownerTeamName"),
    });
  } catch (error) {
    return knownErrorMessage(error);
  }

  revalidatePath("/pools");
  redirect(`/pools/${pool.id}`);
}

export async function updatePoolRulesAction(
  poolId: string,
  _prevState: ActionError,
  formData: FormData,
): Promise<ActionError> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const raw: Record<string, FormDataEntryValue> = {};
  for (const key of ["name", "scoringMode", "countBestN", "rosterSize", "lockAt", "buyIn", "status"]) {
    const value = formData.get(key);
    if (value !== null && value !== "") raw[key] = value;
  }

  try {
    await pools.updatePoolRules(poolId, userId, raw);
  } catch (error) {
    return knownErrorMessage(error);
  }

  revalidatePath(`/pools/${poolId}`);
}

export async function deletePoolAction(poolId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  await pools.deletePool(poolId, userId);
  revalidatePath("/pools");
  redirect("/pools");
}

export async function joinPoolAction(
  poolId: string,
  _prevState: ActionError,
  formData: FormData,
): Promise<ActionError> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  try {
    await pools.joinPool(poolId, userId, { teamName: formData.get("teamName") });
  } catch (error) {
    return knownErrorMessage(error);
  }

  revalidatePath(`/pools/${poolId}`);
}

export async function leavePoolAction(poolId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  await pools.leavePool(poolId, userId);
  revalidatePath(`/pools/${poolId}`);
  redirect("/pools");
}

export async function removeMemberAction(poolId: string, memberId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  await pools.removeMember(poolId, userId, memberId);
  revalidatePath(`/pools/${poolId}`);
}

export async function updateTeamNameAction(
  poolId: string,
  _prevState: ActionError,
  formData: FormData,
): Promise<ActionError> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  try {
    await pools.updateMemberTeamName(poolId, userId, { teamName: formData.get("teamName") });
  } catch (error) {
    return knownErrorMessage(error);
  }

  revalidatePath(`/pools/${poolId}`);
}
