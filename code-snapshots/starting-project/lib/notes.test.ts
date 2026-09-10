import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { EMPTY_NOTE_CONTENT } from "./note-types";

process.env.DB_PATH = ":memory:";

const { getDatabase } = await import("./db");
const {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  NoteValidationError,
  serializeNoteContent,
  updateNote,
} = await import("./notes");
const db = getDatabase();
const migration = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
db.exec(migration.split("--! UP")[1].split("--! DOWN")[0]);

const firstUserId = crypto.randomUUID();
const secondUserId = crypto.randomUUID();

function insertUser(id: string, email: string) {
  const timestamp = new Date().toISOString();
  db.query(
    `
      INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
      VALUES (?1, 'Test User', ?2, 0, NULL, ?3, ?3);
    `,
  ).run(id, email, timestamp);
}

beforeEach(() => {
  db.exec("DELETE FROM note; DELETE FROM user;");
  insertUser(firstUserId, "first@example.com");
  insertUser(secondUserId, "second@example.com");
});

afterAll(() => db.close());

describe("notes data access", () => {
  test("creates and reads a note only for its owner", () => {
    const created = createNote({
      userId: firstUserId,
      title: "  Project ideas  ",
      contentJson: EMPTY_NOTE_CONTENT,
    });

    expect(created.title).toBe("Project ideas");
    expect(getNote(firstUserId, created.id)).toEqual(created);
    expect(getNote(secondUserId, created.id)).toBeNull();
  });

  test("lists only the owner's notes in descending update order", () => {
    const older = createNote({
      userId: firstUserId,
      title: "Older",
      contentJson: EMPTY_NOTE_CONTENT,
    });
    const newer = createNote({
      userId: firstUserId,
      title: "Newer",
      contentJson: EMPTY_NOTE_CONTENT,
    });
    createNote({ userId: secondUserId, title: "Private", contentJson: EMPTY_NOTE_CONTENT });
    db.query("UPDATE note SET updated_at = ?1 WHERE id = ?2;").run(
      "2025-01-01T00:00:00.000Z",
      older.id,
    );
    db.query("UPDATE note SET updated_at = ?1 WHERE id = ?2;").run(
      "2026-01-01T00:00:00.000Z",
      newer.id,
    );

    expect(listNotes(firstUserId).map(({ title }) => title)).toEqual(["Newer", "Older"]);
  });

  test("allows blank titles and updates content for the owner", () => {
    const created = createNote({
      userId: firstUserId,
      title: "   ",
      contentJson: EMPTY_NOTE_CONTENT,
    });
    const contentJson = {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Saved" }] }],
    };

    const updatedAt = updateNote({
      id: created.id,
      userId: firstUserId,
      title: "Updated",
      contentJson,
    });

    expect(created.title).toBe("");
    expect(updatedAt).not.toBeNull();
    expect(getNote(firstUserId, created.id)?.contentJson).toEqual(contentJson);
  });

  test("prevents another user from updating or deleting a note", () => {
    const created = createNote({
      userId: firstUserId,
      title: "Private",
      contentJson: EMPTY_NOTE_CONTENT,
    });

    expect(
      updateNote({
        id: created.id,
        userId: secondUserId,
        title: "Changed",
        contentJson: EMPTY_NOTE_CONTENT,
      }),
    ).toBeNull();
    expect(deleteNote(secondUserId, created.id)).toBeFalse();
    expect(getNote(firstUserId, created.id)?.title).toBe("Private");
  });

  test("deletes a note for its owner", () => {
    const created = createNote({
      userId: firstUserId,
      title: "Temporary",
      contentJson: EMPTY_NOTE_CONTENT,
    });

    expect(deleteNote(firstUserId, created.id)).toBeTrue();
    expect(getNote(firstUserId, created.id)).toBeNull();
  });
});

describe("note validation", () => {
  test("rejects malformed Tiptap documents", () => {
    for (const value of [
      null,
      {},
      { type: "paragraph" },
      { type: "doc", content: [{}] },
      { type: "doc", content: [{ type: "paragraph", attrs: { invalid: new Date() } }] },
    ]) {
      expect(() => serializeNoteContent(value)).toThrow(NoteValidationError);
    }
  });

  test("rejects content larger than 256 KB", () => {
    const oversized = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(256 * 1024) }] }],
    };

    expect(() => serializeNoteContent(oversized)).toThrow("too large");
  });

  test("rejects titles longer than 200 characters", () => {
    expect(() =>
      createNote({
        userId: firstUserId,
        title: "x".repeat(201),
        contentJson: EMPTY_NOTE_CONTENT,
      }),
    ).toThrow(NoteValidationError);
  });
});
