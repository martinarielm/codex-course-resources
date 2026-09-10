"use client";

export default function NotesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-red-700">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          We couldn’t load your notes
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your notes are still safe. Try loading this page again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
