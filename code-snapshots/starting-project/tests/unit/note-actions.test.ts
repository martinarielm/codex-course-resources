import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_NOTE_CONTENT } from "@/lib/note-types";

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  getSession: vi.fn(),
  revalidatePath: vi.fn(),
  updateNote: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/notes", () => {
  class NoteValidationError extends Error {}

  return {
    NoteValidationError,
    createNote: mocks.createNote,
    deleteNote: mocks.deleteNote,
    updateNote: mocks.updateNote,
  };
});

import {
  createNoteAction,
  deleteNoteAction,
  updateNoteAction,
} from "@/app/notes/actions";
import { NoteValidationError } from "@/lib/notes";

const input = { title: "Test note", contentJson: EMPTY_NOTE_CONTENT };
const session = { user: { id: "user-1" } };

describe("note actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(session);
  });

  it("rejects unauthenticated creates before touching the database", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(createNoteAction(input)).resolves.toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Please log in to create a note." },
    });
    expect(mocks.createNote).not.toHaveBeenCalled();
  });

  it("creates for the session owner and revalidates the list", async () => {
    mocks.createNote.mockReturnValue({ id: "note-1", updatedAt: "2026-09-10T12:00:00.000Z" });

    await expect(createNoteAction(input)).resolves.toEqual({
      ok: true,
      data: { id: "note-1", updatedAt: "2026-09-10T12:00:00.000Z" },
    });
    expect(mocks.createNote).toHaveBeenCalledWith({ ...input, userId: "user-1" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/notes");
  });

  it("returns validation errors without converting them to internal errors", async () => {
    mocks.createNote.mockImplementation(() => {
      throw new NoteValidationError("The note title cannot exceed 200 characters.");
    });

    await expect(createNoteAction(input)).resolves.toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "The note title cannot exceed 200 characters.",
      },
    });
  });

  it("does not reveal unexpected create failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createNote.mockImplementation(() => {
      throw new Error("SQLITE_CONSTRAINT secret detail");
    });

    await expect(createNoteAction(input)).resolves.toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Unable to create the note. Please try again." },
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("treats an update outside the owner's notes as not found", async () => {
    mocks.updateNote.mockReturnValue(null);

    await expect(updateNoteAction({ id: "someone-elses-note", ...input })).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "This note could not be found." },
    });
    expect(mocks.updateNote).toHaveBeenCalledWith({
      id: "someone-elses-note",
      ...input,
      userId: "user-1",
    });
  });

  it("revalidates both note routes after an update", async () => {
    mocks.updateNote.mockReturnValue("2026-09-10T12:01:00.000Z");

    await expect(updateNoteAction({ id: "note-1", ...input })).resolves.toEqual({
      ok: true,
      data: { updatedAt: "2026-09-10T12:01:00.000Z" },
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/notes"], ["/notes/note-1"]]);
  });

  it("rejects unauthenticated deletes before touching the database", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(deleteNoteAction({ id: "note-1" })).resolves.toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Please log in to delete this note." },
    });
    expect(mocks.deleteNote).not.toHaveBeenCalled();
  });

  it("does not reveal whether another user's note exists during deletion", async () => {
    mocks.deleteNote.mockReturnValue(false);

    await expect(deleteNoteAction({ id: "someone-elses-note" })).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "This note could not be found." },
    });
    expect(mocks.deleteNote).toHaveBeenCalledWith("user-1", "someone-elses-note");
  });
});
