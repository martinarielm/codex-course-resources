"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "@/app/notes/actions";
import { EMPTY_NOTE_CONTENT, type NoteContent } from "@/lib/note-types";

type EditorMode = { kind: "create" } | { kind: "edit"; noteId: string };

type NoteEditorProps = {
  mode: EditorMode;
  initialTitle?: string;
  initialContent?: NoteContent;
};

type SaveState = "saved" | "unsaved" | "saving" | "error";
type TiptapEditor = NonNullable<ReturnType<typeof useEditor>>;

type EditorSnapshot = {
  title: string;
  contentJson: NoteContent;
  serialized: string;
};

const SAVE_DELAY_MS = 1000;
const TOOLBAR_BUTTON =
  "rounded-md border border-transparent px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-40";

function editorContent(editor: TiptapEditor): NoteContent {
  return { ...editor.getJSON(), type: "doc" };
}

function createSnapshot(title: string, contentJson: NoteContent): EditorSnapshot {
  const normalizedTitle = title.trim();
  return {
    title: normalizedTitle,
    contentJson,
    serialized: JSON.stringify({ title: normalizedTitle, contentJson }),
  };
}

function statusLabel(state: SaveState, isCreate: boolean): string {
  if (state === "saving") return isCreate ? "Creating…" : "Saving…";
  if (state === "error") return isCreate ? "Couldn’t create" : "Couldn’t save";
  if (state === "saved") return "Saved";
  return isCreate ? "Ready to create" : "Unsaved changes";
}

export default function NoteEditor({
  mode,
  initialTitle = "",
  initialContent = EMPTY_NOTE_CONTENT,
}: NoteEditorProps) {
  const router = useRouter();
  const isCreate = mode.kind === "create";
  const [title, setTitle] = useState(initialTitle);
  const [saveState, setSaveState] = useState<SaveState>(isCreate ? "unsaved" : "saved");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const titleRef = useRef(initialTitle);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSnapshot = createSnapshot(initialTitle, initialContent);
  const latestSnapshotRef = useRef(initialSnapshot);
  const lastSavedSnapshotRef = useRef(isCreate ? "" : initialSnapshot.serialized);
  const queuedSnapshotRef = useRef<EditorSnapshot | null>(null);
  const saveLoopRef = useRef<Promise<void> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          autolink: false,
          linkOnPaste: false,
          openOnClick: false,
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
          isAllowedUri: (url) => {
            try {
              return ["http:", "https:"].includes(new URL(url).protocol);
            } catch {
              return false;
            }
          },
        },
      }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Note content",
        class: "tiptap",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      markDirty(titleRef.current, editorContent(updatedEditor));
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function markDirty(nextTitle: string, contentJson: NoteContent) {
    const snapshot = createSnapshot(nextTitle, contentJson);
    latestSnapshotRef.current = snapshot;
    setError("");

    if (!isCreate && snapshot.serialized === lastSavedSnapshotRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSaveState("saved");
      return;
    }

    setSaveState(saveLoopRef.current ? "saving" : "unsaved");
    if (!isCreate) scheduleSave();
  }

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void requestSave();
    }, SAVE_DELAY_MS);
  }

  async function processSaveQueue() {
    if (saveLoopRef.current || mode.kind !== "edit") return;

    const saveLoop = (async () => {
      while (queuedSnapshotRef.current) {
        const snapshot = queuedSnapshotRef.current;
        queuedSnapshotRef.current = null;
        setSaveState("saving");
        setError("");

        try {
          const result = await updateNoteAction({
            id: mode.noteId,
            title: snapshot.title,
            contentJson: snapshot.contentJson,
          });
          if (!result.ok) {
            setSaveState("error");
            setError(result.error.message);
            queuedSnapshotRef.current = null;
            break;
          }

          lastSavedSnapshotRef.current = snapshot.serialized;
          setSaveState(
            latestSnapshotRef.current.serialized === snapshot.serialized ? "saved" : "unsaved",
          );
        } catch {
          setSaveState("error");
          setError("Unable to save the note. Please try again.");
          queuedSnapshotRef.current = null;
          break;
        }
      }
    })();

    saveLoopRef.current = saveLoop;
    await saveLoop;
    saveLoopRef.current = null;
    if (queuedSnapshotRef.current) await processSaveQueue();
  }

  async function requestSave() {
    if (mode.kind !== "edit") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;

    const snapshot = latestSnapshotRef.current;
    if (snapshot.serialized === lastSavedSnapshotRef.current) {
      setSaveState("saved");
      return;
    }

    queuedSnapshotRef.current = snapshot;
    await processSaveQueue();
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextTitle = event.currentTarget.value;
    titleRef.current = nextTitle;
    setTitle(nextTitle);
    markDirty(nextTitle, editor ? editorContent(editor) : initialContent);
  }

  async function handlePrimaryAction() {
    if (!editor) return;
    if (!isCreate) {
      await requestSave();
      return;
    }

    const snapshot = createSnapshot(titleRef.current, editorContent(editor));
    setSaveState("saving");
    setError("");
    try {
      const result = await createNoteAction({
        title: snapshot.title,
        contentJson: snapshot.contentJson,
      });
      if (!result.ok) {
        setSaveState("error");
        setError(result.error.message);
        return;
      }
      lastSavedSnapshotRef.current = snapshot.serialized;
      setSaveState("saved");
      router.replace(`/notes/${result.data.id}`);
      router.refresh();
    } catch {
      setSaveState("error");
      setError("Unable to create the note. Please try again.");
    }
  }

  function handleShowDeleteConfirmation() {
    setConfirmDelete(true);
    setError("");
  }

  function handleCancelDelete() {
    setConfirmDelete(false);
  }

  async function handleDelete() {
    if (mode.kind !== "edit") return;
    setDeleting(true);
    setError("");
    try {
      const result = await deleteNoteAction({ id: mode.noteId });
      if (!result.ok) {
        setError(result.error.message);
        setDeleting(false);
        return;
      }
      router.replace("/notes");
      router.refresh();
    } catch {
      setError("Unable to delete the note. Please try again.");
      setDeleting(false);
    }
  }

  const primaryDisabled =
    !editor || deleting || saveState === "saving" || (!isCreate && saveState === "saved");

  return (
    <section aria-labelledby="note-editor-title" className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/notes"
          className="w-fit rounded-md text-sm font-semibold text-teal-800 underline decoration-teal-300 underline-offset-4 hover:text-teal-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
        >
          ← Back to notes
        </Link>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <p aria-live="polite" className="text-sm font-medium text-slate-600">
            {statusLabel(saveState, isCreate)}
          </p>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
            className="min-w-28 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {isCreate ? (saveState === "saving" ? "Creating…" : "Create note") : "Save"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-xl shadow-teal-950/5">
        <div className="border-b border-teal-100 px-5 py-4 sm:px-7">
          <label htmlFor="note-title" className="sr-only">
            Note title
          </label>
          <input
            id="note-title"
            value={title}
            onChange={handleTitleChange}
            maxLength={200}
            placeholder="Untitled note"
            disabled={deleting}
            className="w-full bg-transparent text-2xl font-semibold tracking-tight text-slate-950 outline-hidden placeholder:text-slate-400 focus-visible:ring-0 sm:text-3xl"
          />
        </div>

        {editor ? <EditorToolbar editor={editor} /> : <EditorToolbarSkeleton />}
        <div className="min-h-96 bg-white px-5 py-6 sm:min-h-128 sm:px-7">
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <p className="text-sm text-slate-500">Loading editor…</p>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {error}
        </p>
      )}

      {!isCreate && (
        <section
          aria-labelledby="danger-zone-title"
          className="mt-8 border-t border-slate-200 pt-6"
        >
          <h2 id="danger-zone-title" className="text-sm font-semibold text-slate-900">
            Delete note
          </h2>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={handleShowDeleteConfirmation}
              disabled={deleting || saveState === "saving"}
              className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
            >
              Delete note
            </button>
          ) : (
            <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900">
                This permanently deletes the note. This action cannot be undone.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  disabled={deleting}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  );
}

function EditorToolbarSkeleton() {
  return (
    <div className="flex min-h-14 items-center border-b border-teal-100 bg-slate-50 px-5 py-3 sm:px-7">
      <span className="text-sm text-slate-500">Loading tools…</span>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`${TOOLBAR_BUTTON} ${active ? "border-teal-200 bg-teal-100 text-teal-950" : "bg-white"}`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: TiptapEditor }) {
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      paragraph: currentEditor.isActive("paragraph"),
      heading1: currentEditor.isActive("heading", { level: 1 }),
      heading2: currentEditor.isActive("heading", { level: 2 }),
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      underline: currentEditor.isActive("underline"),
      strike: currentEditor.isActive("strike"),
      code: currentEditor.isActive("code"),
      bulletList: currentEditor.isActive("bulletList"),
      orderedList: currentEditor.isActive("orderedList"),
      blockquote: currentEditor.isActive("blockquote"),
      codeBlock: currentEditor.isActive("codeBlock"),
      link: currentEditor.isActive("link"),
      canUndo: currentEditor.can().chain().focus().undo().run(),
      canRedo: currentEditor.can().chain().focus().redo().run(),
    }),
  });

  function handleParagraph() {
    editor.chain().focus().setParagraph().run();
  }
  function handleHeading1() {
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  }
  function handleHeading2() {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  }
  function handleBold() {
    editor.chain().focus().toggleBold().run();
  }
  function handleItalic() {
    editor.chain().focus().toggleItalic().run();
  }
  function handleUnderline() {
    editor.chain().focus().toggleUnderline().run();
  }
  function handleStrike() {
    editor.chain().focus().toggleStrike().run();
  }
  function handleCode() {
    editor.chain().focus().toggleCode().run();
  }
  function handleBulletList() {
    editor.chain().focus().toggleBulletList().run();
  }
  function handleOrderedList() {
    editor.chain().focus().toggleOrderedList().run();
  }
  function handleBlockquote() {
    editor.chain().focus().toggleBlockquote().run();
  }
  function handleCodeBlock() {
    editor.chain().focus().toggleCodeBlock().run();
  }
  function handleUndo() {
    editor.chain().focus().undo().run();
  }
  function handleRedo() {
    editor.chain().focus().redo().run();
  }
  function handleShowLinkEditor() {
    const href = editor.getAttributes("link").href;
    setLinkUrl(typeof href === "string" ? href : "");
    setLinkError("");
    setShowLinkEditor((visible) => !visible);
  }
  function handleLinkUrlChange(event: ChangeEvent<HTMLInputElement>) {
    setLinkUrl(event.currentTarget.value);
    setLinkError("");
  }
  function handleApplyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const url = new URL(linkUrl.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
      editor.chain().focus().extendMarkRange("link").setLink({ href: url.href }).run();
      setShowLinkEditor(false);
      setLinkError("");
    } catch {
      setLinkError("Enter a complete http:// or https:// URL.");
    }
  }
  function handleRemoveLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowLinkEditor(false);
    setLinkError("");
  }

  return (
    <div className="border-b border-teal-100 bg-slate-50 px-5 py-3 sm:px-7">
      <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap gap-1.5">
        <ToolbarButton label="Paragraph" active={state?.paragraph} onClick={handleParagraph}>
          P
        </ToolbarButton>
        <ToolbarButton label="Heading 1" active={state?.heading1} onClick={handleHeading1}>
          H1
        </ToolbarButton>
        <ToolbarButton label="Heading 2" active={state?.heading2} onClick={handleHeading2}>
          H2
        </ToolbarButton>
        <ToolbarButton label="Bold" active={state?.bold} onClick={handleBold}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="Italic" active={state?.italic} onClick={handleItalic}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Underline" active={state?.underline} onClick={handleUnderline}>
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={state?.strike} onClick={handleStrike}>
          <span className="line-through">S</span>
        </ToolbarButton>
        <ToolbarButton label="Inline code" active={state?.code} onClick={handleCode}>
          {"</>"}
        </ToolbarButton>
        <ToolbarButton label="Bullet list" active={state?.bulletList} onClick={handleBulletList}>
          • List
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={state?.orderedList}
          onClick={handleOrderedList}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton label="Blockquote" active={state?.blockquote} onClick={handleBlockquote}>
          Quote
        </ToolbarButton>
        <ToolbarButton label="Code block" active={state?.codeBlock} onClick={handleCodeBlock}>
          Code
        </ToolbarButton>
        <ToolbarButton label="Edit link" active={state?.link} onClick={handleShowLinkEditor}>
          Link
        </ToolbarButton>
        <ToolbarButton label="Undo" disabled={!state?.canUndo} onClick={handleUndo}>
          Undo
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!state?.canRedo} onClick={handleRedo}>
          Redo
        </ToolbarButton>
      </div>

      {showLinkEditor && (
        <form
          onSubmit={handleApplyLink}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"
        >
          <div className="flex-1">
            <label htmlFor="note-link-url" className="sr-only">
              Link URL
            </label>
            <input
              id="note-link-url"
              type="url"
              value={linkUrl}
              onChange={handleLinkUrlChange}
              placeholder="https://example.com"
              required
              aria-describedby={linkError ? "note-link-error" : undefined}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-hidden focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-200"
            />
            {linkError && (
              <p id="note-link-error" role="alert" className="mt-1 text-sm text-red-700">
                {linkError}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            Apply link
          </button>
          {state?.link && (
            <button
              type="button"
              onClick={handleRemoveLink}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Remove link
            </button>
          )}
        </form>
      )}
    </div>
  );
}
