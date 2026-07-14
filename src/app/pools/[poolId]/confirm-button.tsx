"use client";

export function ConfirmButton({
  action,
  confirmMessage,
  className,
  children,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (confirm(confirmMessage)) {
          void action();
        }
      }}
    >
      {children}
    </button>
  );
}
