"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      window.location.assign("/login");
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-800 disabled:opacity-60"
      >
        {pending ? "Logging out…" : "Log out"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Unable to log out. Try again.
        </p>
      )}
    </div>
  );
}
