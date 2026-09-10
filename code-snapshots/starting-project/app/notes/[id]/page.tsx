import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NoteEditor from "@/app/notes/note-editor";
import { getNote } from "@/lib/notes";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Edit note" };

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { user }] = await Promise.all([params, requireSession()]);
  const note = getNote(user.id, id);
  if (!note) notFound();

  return (
    <main className="flex-1 bg-slate-50 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 id="note-editor-title" className="sr-only">
        Edit {note.title || "untitled note"}
      </h1>
      <NoteEditor
        mode={{ kind: "edit", noteId: note.id }}
        initialTitle={note.title}
        initialContent={note.contentJson}
      />
    </main>
  );
}
