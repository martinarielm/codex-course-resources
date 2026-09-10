export type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TiptapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
};

export type NoteContent = TiptapNode & {
  type: "doc";
};

export type NoteSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type EditableNote = NoteSummary & {
  contentJson: NoteContent;
};

export type ActionErrorCode = "UNAUTHORIZED" | "NOT_FOUND" | "VALIDATION_ERROR" | "INTERNAL_ERROR";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ActionErrorCode; message: string } };

export const EMPTY_NOTE_CONTENT: NoteContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
