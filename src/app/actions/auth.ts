"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";

const devLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(100).optional(),
});

export async function devLogin(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const parsed = devLoginSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input";
  }

  const { email, name } = parsed.data;

  const user = await prisma.user.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name },
  });

  await setSessionCookie(user.id);
  redirect("/pools");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
