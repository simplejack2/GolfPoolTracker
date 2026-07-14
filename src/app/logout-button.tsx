"use client";

import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        void logout();
      }}
      className="font-medium underline underline-offset-2"
    >
      Sign out
    </button>
  );
}
