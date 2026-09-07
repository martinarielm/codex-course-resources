import type { Metadata } from "next";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My notes" };

export default async function NotesPage() {
  const { user } = await requireSession();
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome, {user.name}</h1>
      <p className="mt-3 text-slate-600">You are logged in as {user.email}.</p>
      <section className="mt-8 rounded-2xl border border-teal-100 bg-white p-8">
        <h2 className="text-xl font-semibold">My notes</h2>
        <p className="mt-2 text-slate-600">Your account is ready. Note editing is coming next.</p>
      </section>
    </main>
  );
}
