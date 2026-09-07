import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const getSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
    // Server Components cannot set refreshed cookies. Read the database session.
    query: { disableRefresh: true },
  }),
);

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
