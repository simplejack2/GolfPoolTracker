import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getPool } from "@/lib/pools";
import { NotFoundError } from "@/lib/errors";
import { deletePoolAction, leavePoolAction, removeMemberAction } from "@/app/actions/pools";
import { syncFieldAction, syncScoresAction } from "@/app/actions/roster";
import { JoinForm } from "./join-form";
import { TeamNameForm } from "./team-name-form";
import { EditRulesForm } from "./edit-rules-form";
import { ConfirmButton } from "./confirm-button";
import { SyncButton } from "./sync-button";

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function PoolDetailPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const pool = await getPool(poolId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const isOwner = pool.ownerId === user.id;
  const membership = pool.members.find((m) => m.userId === user.id);

  const fieldCount = await prisma.golfer.count({ where: { tournamentId: pool.tournamentId } });
  const myPickCount = membership
    ? await prisma.roster.count({ where: { poolMemberId: membership.id } })
    : 0;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/pools" className="text-sm text-zinc-500 underline underline-offset-2 dark:text-zinc-400">
          &larr; Your pools
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{pool.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{pool.tournament.name}</p>
        </div>
        {isOwner ? (
          <ConfirmButton
            action={deletePoolAction.bind(null, pool.id)}
            confirmMessage={`Delete "${pool.name}"? This cannot be undone.`}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete pool
          </ConfirmButton>
        ) : null}
      </div>

      <dl className="mb-8 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 text-sm sm:grid-cols-4 dark:border-zinc-800">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
          <dd className="font-medium">{pool.status}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Roster</dt>
          <dd className="font-medium">
            best {pool.countBestN} of {pool.rosterSize}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Locks at</dt>
          <dd className="font-medium">{pool.lockAt.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Buy-in</dt>
          <dd className="font-medium">{pool.buyIn ? `$${pool.buyIn}` : "—"}</dd>
        </div>
      </dl>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Teams ({pool.members.length})</h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {pool.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{member.teamName}</p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {member.user.name ?? member.user.email}
                  {member.userId === pool.ownerId ? " · Commissioner" : ""}
                </p>
              </div>
              {isOwner && member.userId !== pool.ownerId ? (
                <ConfirmButton
                  action={removeMemberAction.bind(null, pool.id, member.id)}
                  confirmMessage={`Remove ${member.teamName} from this pool?`}
                  className="text-sm font-medium text-red-600 underline underline-offset-2 dark:text-red-400"
                >
                  Remove
                </ConfirmButton>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {membership ? (
        <section className="mb-8 space-y-4">
          <h2 className="text-sm font-semibold">Your team</h2>
          <TeamNameForm poolId={pool.id} currentTeamName={membership.teamName} />
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/pools/${pool.id}/roster`}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Your picks ({myPickCount}/{pool.rosterSize})
            </Link>
            <Link
              href={`/pools/${pool.id}/leaderboard`}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Leaderboard
            </Link>
          </div>
          {!isOwner ? (
            <ConfirmButton
              action={leavePoolAction.bind(null, pool.id)}
              confirmMessage="Leave this pool?"
              className="text-sm font-medium text-red-600 underline underline-offset-2 dark:text-red-400"
            >
              Leave pool
            </ConfirmButton>
          ) : null}
        </section>
      ) : pool.status === "OPEN" ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">Join this pool</h2>
          <JoinForm poolId={pool.id} defaultTeamName={user.name ?? user.email} />
        </section>
      ) : (
        <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
          This pool isn&apos;t open for new members right now.
        </p>
      )}

      {isOwner ? (
        <section className="mb-8 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold">Tournament field</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {fieldCount > 0
                ? `${fieldCount} golfers in the field.`
                : "No golfers ingested yet — sync the field so members can make picks."}
            </p>
          </div>
          <SyncButton
            label="Sync tournament field"
            pendingLabel="Syncing..."
            action={syncFieldAction.bind(null, pool.id)}
          />
          <SyncButton
            label="Sync scores"
            pendingLabel="Syncing..."
            action={syncScoresAction.bind(null, pool.id)}
          />
        </section>
      ) : null}

      {isOwner ? (
        <EditRulesForm
          poolId={pool.id}
          pool={{
            name: pool.name,
            scoringMode: pool.scoringMode,
            countBestN: pool.countBestN,
            rosterSize: pool.rosterSize,
            cutPenaltyMode: pool.cutPenaltyMode,
            cutPenaltyValue: pool.cutPenaltyValue,
            lockAt: toDatetimeLocalValue(pool.lockAt),
            buyIn: pool.buyIn ? pool.buyIn.toString() : null,
            status: pool.status,
          }}
        />
      ) : null}
    </div>
  );
}
