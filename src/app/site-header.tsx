import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/app/logout-button";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <Link href="/pools" className="font-semibold tracking-tight">
        Golf Pool Tracker
      </Link>
      {user ? (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">
            {user.name ?? user.email}
          </span>
          <LogoutButton />
        </div>
      ) : (
        <Link href="/login" className="text-sm font-medium underline underline-offset-2">
          Sign in
        </Link>
      )}
    </header>
  );
}
