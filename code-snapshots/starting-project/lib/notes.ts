import "server-only";

import { getDatabase } from "@/lib/db";
import type {
  EditableNote,
  NoteContent,
  NoteSummary,
  TiptapMark,
  TiptapNode,
} from "@/lib/note-types";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_BYTES = 256 * 1024;

type NoteSummaryRow = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type EditableNoteRow = NoteSummaryRow & {
  contentJson: string;
};

export class NoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteValidationError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isPlainObject(value) && Object.values(value).every(isJsonValue);
}

function isTiptapMark(value: unknown): value is TiptapMark {
  if (
    !isPlainObject(value) ||
    !isJsonValue(value) ||
    typeof value.type !== "string" ||
    !value.type
  ) {
    return false;
  }
  return value.attrs === undefined || (isPlainObject(value.attrs) && isJsonValue(value.attrs));
}

function isTiptapNode(value: unknown): value is TiptapNode {
  if (
    !isPlainObject(value) ||
    !isJsonValue(value) ||
    typeof value.type !== "string" ||
    !value.type
  ) {
    return false;
  }
  if (value.text !== undefined && typeof value.text !== "string") return false;
  if (value.attrs !== undefined && (!isPlainObject(value.attrs) || !isJsonValue(value.attrs))) {
    return false;
  }
  if (
    value.marks !== undefined &&
    (!Array.isArray(value.marks) || !value.marks.every(isTiptapMark))
  ) {
    return false;
  }
  return (
    value.content === undefined ||
    (Array.isArray(value.content) && value.content.every(isTiptapNode))
  );
}

function isNoteContent(value: unknown): value is NoteContent {
  return isTiptapNode(value) && value.type === "doc";
}

export function normalizeNoteTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new NoteValidationError("The note title must be text.");
  }

  const title = value.trim();
  if (title.length > MAX_TITLE_LENGTH) {
    throw new NoteValidationError(`The note title cannot exceed ${MAX_TITLE_LENGTH} characters.`);
  }
  return title;
}

export function serializeNoteContent(value: unknown): string {
  if (!isNoteContent(value)) {
    throw new NoteValidationError("The note content is not a valid Tiptap document.");
  }

  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > MAX_CONTENT_BYTES) {
    throw new NoteValidationError("The note content is too large.");
  }
  return serialized;
}

function parseStoredContent(value: string): NoteContent {
  let content: unknown;
  try {
    content = JSON.parse(value);
  } catch {
    throw new Error("Stored note content is not valid JSON.");
  }

  if (!isNoteContent(content)) {
    throw new Error("Stored note content is not a valid Tiptap document.");
  }
  return content;
}

export function listNotes(userId: string): NoteSummary[] {
  return getDatabase()
    .query<NoteSummaryRow, [string]>(
      `
        SELECT id, title, created_at AS createdAt, updated_at AS updatedAt
        FROM note
        WHERE user_id = ?1
        ORDER BY updated_at DESC;
      `,
    )
    .all(userId);
}

export function getNote(userId: string, id: string): EditableNote | null {
  const row = getDatabase()
    .query<EditableNoteRow, [string, string]>(
      `
        SELECT id, title, content_json AS contentJson,
               created_at AS createdAt, updated_at AS updatedAt
        FROM note
        WHERE id = ?1 AND user_id = ?2;
      `,
    )
    .get(id, userId);

  return row ? { ...row, contentJson: parseStoredContent(row.contentJson) } : null;
}

export function createNote(input: {
  userId: string;
  title: unknown;
  contentJson: unknown;
}): EditableNote {
  const id = crypto.randomUUID();
  const title = normalizeNoteTitle(input.title);
  const serializedContent = serializeNoteContent(input.contentJson);
  const timestamp = new Date().toISOString();

  getDatabase()
    .query(
      `
        INSERT INTO note (id, user_id, title, content_json, share_enabled, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5);
      `,
    )
    .run(id, input.userId, title, serializedContent, timestamp);

  return {
    id,
    title,
    contentJson: parseStoredContent(serializedContent),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateNote(input: {
  id: string;
  userId: string;
  title: unknown;
  contentJson: unknown;
}): string | null {
  const title = normalizeNoteTitle(input.title);
  const serializedContent = serializeNoteContent(input.contentJson);
  const updatedAt = new Date().toISOString();
  const result = getDatabase()
    .query(
      `
        UPDATE note
        SET title = ?1, content_json = ?2, updated_at = ?3
        WHERE id = ?4 AND user_id = ?5;
      `,
    )
    .run(title, serializedContent, updatedAt, input.id, input.userId);

  return result.changes === 1 ? updatedAt : null;
}

export function deleteNote(userId: string, id: string): boolean {
  const result = getDatabase()
    .query("DELETE FROM note WHERE id = ?1 AND user_id = ?2;")
    .run(id, userId);
  return result.changes === 1;
}
