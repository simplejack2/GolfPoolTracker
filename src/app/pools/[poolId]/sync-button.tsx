"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SyncResult = { error?: string; message?: string };

export function SyncButton({
  label,
  pendingLabel,
  action,
}: {
  label: string;
  pendingLabel: string;
  action: () => Promise<SyncResult>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(undefined);
          setError(undefined);
          startTransition(async () => {
            const result = await action();
            if (result.error) setError(result.error);
            else {
              setMessage(result.message);
              router.refresh();
            }
          });
        }}
        className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {isPending ? pendingLabel : label}
      </button>
      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
