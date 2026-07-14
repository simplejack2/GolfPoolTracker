import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import type { User } from "@prisma/client";

const SESSION_COOKIE = "gpt_user_id";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// Placeholder session mechanism: the cookie holds a User id directly, with
// no password/provider behind it. Good enough to build and test pool
// membership flows; swap for Supabase/Clerk by replacing this file only.
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
