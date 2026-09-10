import type { Metadata } from "next";
import NoteEditor from "@/app/notes/note-editor";

export const metadata: Metadata = { title: "New note" };

export default function NewNotePage() {
  return (
    <main className="flex-1 bg-slate-50 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 id="note-editor-title" className="sr-only">
        Create a new note
      </h1>
      <NoteEditor mode={{ kind: "create" }} />
    </main>
  );
}
