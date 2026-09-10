"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult, NoteContent } from "@/lib/note-types";
import { createNote, deleteNote, NoteValidationError, updateNote } from "@/lib/notes";
import { getSession } from "@/lib/session";

type NoteActionInput = {
  title: string;
  contentJson: NoteContent;
};

function actionError(
  code: "UNAUTHORIZED" | "NOT_FOUND" | "VALIDATION_ERROR" | "INTERNAL_ERROR",
  message: string,
): ActionResult<never> {
  return { ok: false, error: { code, message } };
}

export async function createNoteAction(
  input: NoteActionInput,
): Promise<ActionResult<{ id: string; updatedAt: string }>> {
  try {
    const session = await getSession();
    if (!session) return actionError("UNAUTHORIZED", "Please log in to create a note.");

    const note = createNote({ ...input, userId: session.user.id });
    revalidatePath("/notes");
    return { ok: true, data: { id: note.id, updatedAt: note.updatedAt } };
  } catch (error) {
    if (error instanceof NoteValidationError) {
      return actionError("VALIDATION_ERROR", error.message);
    }
    console.error("Unable to create note.", error);
    return actionError("INTERNAL_ERROR", "Unable to create the note. Please try again.");
  }
}

export async function updateNoteAction(
  input: NoteActionInput & { id: string },
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const session = await getSession();
    if (!session) return actionError("UNAUTHORIZED", "Please log in to save this note.");

    const updatedAt = updateNote({ ...input, userId: session.user.id });
    if (!updatedAt) return actionError("NOT_FOUND", "This note could not be found.");

    revalidatePath("/notes");
    revalidatePath(`/notes/${input.id}`);
    return { ok: true, data: { updatedAt } };
  } catch (error) {
    if (error instanceof NoteValidationError) {
      return actionError("VALIDATION_ERROR", error.message);
    }
    console.error("Unable to update note.", error);
    return actionError("INTERNAL_ERROR", "Unable to save the note. Please try again.");
  }
}

export async function deleteNoteAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession();
    if (!session) return actionError("UNAUTHORIZED", "Please log in to delete this note.");

    if (!deleteNote(session.user.id, input.id)) {
      return actionError("NOT_FOUND", "This note could not be found.");
    }

    revalidatePath("/notes");
    return { ok: true, data: { id: input.id } };
  } catch (error) {
    console.error("Unable to delete note.", error);
    return actionError("INTERNAL_ERROR", "Unable to delete the note. Please try again.");
  }
}
