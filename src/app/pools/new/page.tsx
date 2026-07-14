import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { CreatePoolForm } from "./create-pool-form";

export default async function NewPoolPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const tournaments = await prisma.tournament.findMany({
    select: { id: true, name: true },
    orderBy: { startDate: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Create a pool</h1>
      {tournaments.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No tournaments available yet. Run <code>npx prisma db seed</code> to add the mock
          tournament.
        </p>
      ) : (
        <CreatePoolForm tournaments={tournaments} defaultTeamName={user.name ?? user.email} />
      )}
    </div>
  );
}
