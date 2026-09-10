import type { Metadata } from "next";
import Link from "next/link";
import { listNotes } from "@/lib/notes";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My notes" };

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function NotesPage() {
  const { user } = await requireSession();
  const notes = listNotes(user.id);

  return (
    <main className="flex-1 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-teal-700">Your workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              My notes
            </h1>
            <p className="mt-2 text-slate-600">Capture an idea, then shape it at your own pace.</p>
          </div>
          <Link
            href="/notes/new"
            className="inline-flex w-fit items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
          >
            New note
          </Link>
        </header>

        {notes.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-dashed border-teal-200 bg-white px-6 py-16 text-center shadow-sm">
            <span
              aria-hidden="true"
              className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-teal-100 text-xl text-teal-800"
            >
              ✦
            </span>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">
              Your first note starts here
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Create a note and use the rich text editor to organize the details.
            </p>
            <Link
              href="/notes/new"
              className="mt-6 inline-flex rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
            >
              Create your first note
            </Link>
          </section>
        ) : (
          <section aria-labelledby="notes-list-title" className="mt-10">
            <h2 id="notes-list-title" className="sr-only">
              Notes
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/notes/${note.id}`}
                    aria-label={`Open ${note.title || "untitled note"}`}
                    className="group block h-full rounded-2xl border border-teal-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-950/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
                  >
                    <article className="flex h-full min-h-36 flex-col">
                      <h3 className="line-clamp-2 text-lg font-semibold text-slate-950 group-hover:text-teal-900">
                        {note.title || "Untitled note"}
                      </h3>
                      <p className="mt-auto pt-8 text-sm text-slate-500">
                        Updated{" "}
                        <time dateTime={note.updatedAt}>
                          {dateFormatter.format(new Date(note.updatedAt))}
                        </time>
                      </p>
                    </article>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
