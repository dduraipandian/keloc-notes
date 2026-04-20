# Rich Text Editor — Implementation Spec

## Status Reviewed Against Repo

Reviewed on 2026-04-20 by inspecting the implementation in `frontend/src/lib`, `frontend/src/routes`, and the related test files.

### Overall Status

- **Phase 1** `VERIFIED` — database and repository changes are implemented in `idbr.ts` and `repositories.ts`
- **Phase 2** `VERIFIED` — `serializer.ts`, `imageHandler.ts`, and `extensions.ts` are present and wired, including asset hydration/dehydration and stock Tiptap image-node resize support
- **Phase 3** `VERIFIED` — `EditorToolbar.svelte`, `BubbleToolbar.svelte`, and `Editor.svelte` are implemented
- **Phase 4** `VERIFIED` — the editor is integrated into `+page.svelte`; notes summary, search indexing, and export conversion are hooked up
- **Phase 5** `VERIFIED` — Settings UI includes editor toolbar mode, enabled language selection, and image processing concurrency
- **Phase 6** `VERIFIED` — targeted unit and E2E suites were run on 2026-04-20; current editor-focused coverage passes

### Verified Fixes Present In Code

1. **Context helper usage** — `Editor.svelte` imports `getNoteService()` and `getPreferencesStore()` from store context helpers.
2. **Empty document handling** — `parseContent('')` returns a doc with an empty paragraph, not an empty `content` array.
3. **Reactive rebuild guard** — `Editor.svelte` wraps initial note reads in `untrack()` before constructing the Tiptap instance.
4. **Selector approach in tests** — current E2E coverage uses `.ProseMirror` locators.
5. **Stock image node integration** — `extensions.ts` uses Tiptap’s `Image` extension with resize enabled and a custom `assetId` attribute, rather than a custom image node view.
6. **Persisted image refs** — `Editor.svelte` persists `asset:<uuid>` refs via `dehydrateAssetSources()` and hydrates them back to blob URLs at runtime via `hydrateAssetSources()`.
7. **Image history stability** — `Editor.svelte` retains asset object URLs for the full editor session, which preserves undo/redo for inserted images.
8. **Visible resize handles** — `Editor.svelte` now styles Tiptap’s resize-handle DOM (`data-resize-*`) so image resizing is actually usable in the UI.

### Verified Test Footprint

- `frontend/tests/unit/infrastructure/idbr.test.ts`: 20 tests
- `frontend/tests/unit/editor/serializer.test.ts`: 22 tests
- `frontend/tests/unit/editor/imageHandler.svelte.test.ts`: 13 tests
- `frontend/tests/unit/stores/preferences.svelte.test.ts`: 13 tests
- `frontend/tests/unit/components/editorToolbar.svelte.test.ts`: 10 tests
- `frontend/tests/unit/components/bubbleToolbar.svelte.test.ts`: 9 tests
- `frontend/tests/unit/components/editor.svelte.test.ts`: 9 tests
- `frontend/tests/unit/page.test.ts`: 2 tests
- `frontend/tests/e2e/editor.e2e.ts`: 15 tests

### Important Caveat

The earlier version of this document mixed completed implementation notes with stale `PENDING` checklist items and future-dated claims. This file should now be read as:

- implementation is present in the repo, but some lower sections still describe the original planned path rather than the exact landed code
- editor-focused test files are present and were re-run during the 2026-04-20 review
- repo-wide `npm run lint` and `npm run check` still have unrelated baseline issues outside the editor refactor
- editor-focused verification that was actually run:
  - `npm test`: passed
  - `npm run test:e2e`: passed
  - `npx playwright test tests/e2e/editor.e2e.ts`: passed

---

## Canonical Decisions

| Decision           | Choice                                                                                      | Rationale                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Storage format     | **Tiptap JSON** (`JSON.stringify(editor.getJSON())`) stored in `notes_contents`             | Lossless, no round-trip risk, `asset:uuid` image refs work cleanly                                |
| Image persistence  | **IndexedDB blobs** in new `note_assets` store                                              | No Go changes needed; fully local-first                                                           |
| Image src scheme   | `asset:<uuid>` in editor JSON                                                               | Separates identity from blob data; survives renames                                               |
| Tiptap integration | **Headless** (`@tiptap/core` only)                                                          | No Svelte 5 adapter exists; `$effect` + DOM ref is cleaner                                        |
| Note switching     | **`{#key note.id}`** remount                                                                | Avoids suppressing update events; debouncer is keyed per noteId so old writes flush independently |
| Toolbar            | Fixed by default; bubble optional; configurable in Settings                                 | Fixed is discoverable; bubble is efficient for power users                                        |
| Code languages     | All lowlight grammars bundled; curated 14 enabled by default; user-configurable in Settings | Bundle cost ~60KB gzip in a desktop app is negligible                                             |
| Export             | Manual JSON → Markdown serializer (no extra package)                                        | Handles exactly the nodes we use; zero dependency; keeps exports human-readable                   |

---

## NPM Packages to Install

```bash
cd frontend
npm install @tiptap/core @tiptap/starter-kit \
  @tiptap/extension-code-block-lowlight \
  @tiptap/extension-image \
  @tiptap/extension-placeholder \
  @tiptap/extension-bubble-menu \
  lowlight highlight.js
```

---

## File Structure

```
frontend/src/lib/
├── editor/
│   ├── extensions.ts        # Build Tiptap extensions array from options
│   ├── serializer.ts        # parseContent, extractTextFromJSON, jsonToMarkdown
│   └── imageHandler.ts      # Resize image, store/retrieve blobs from IDB
├── components/
│   ├── Editor.svelte         # Headless Tiptap mount + note lifecycle
│   ├── EditorToolbar.svelte  # Fixed formatting toolbar
│   └── BubbleToolbar.svelte  # Floating selection toolbar
frontend/src/lib/infrastructure/
│   ├── idbr.ts              # +version 5: note_assets store and settings keys
│   └── repositories.ts      # +assetsRepository export
frontend/src/lib/stores/
│   └── preferences.svelte.ts  # +editorToolbar, +enabledLanguages
```

---

## Phase 1: Database & Infrastructure

### 1.1 Update `idbr.ts`

**a) Bump version to 5 and update `DBStore`:**

Add `note_assets` to the `DBStore` interface:

```typescript
note_assets: {
  key: string;
  value: {
    id: string;
    noteId: string;
    mimeType: string;
    data: Blob;
  }
}
```

**b) Update `DB_VERSION`:**

```typescript
const DB_VERSION = 5;
```

**c) Add case 3 / 4 handling in the `upgrade` switch:**

```typescript
case 3:
case 4:
  if (!db.objectStoreNames.contains('note_assets')) {
    const assetStore = db.createObjectStore('note_assets', { keyPath: 'id' });
    assetStore.createIndex('by_note', 'noteId');
  }
  break;
```

The `default` branch already calls `ensureStores(db)`, so add `note_assets` there too:

```typescript
if (!db.objectStoreNames.contains("note_assets")) {
  const s = db.createObjectStore("note_assets", { keyPath: "id" });
  s.createIndex("by_note", "noteId");
}
```

**d) Extend `SettingsState` type with two new keys:**

```typescript
editorToolbar: 'fixed' | 'bubble' | 'both' | null;
enabledLanguages: string[] | null;
```

**e) Update `getAllSettings()` to handle both keys** in the `switch(key)` block and include them in the returned object.

**f) Add four new exported functions:**

```typescript
export async function putNoteAsset(asset: {
  id: string;
  noteId: string;
  mimeType: string;
  data: Blob;
}): Promise<void> {
  const db = await getDB();
  await db.put("note_assets", asset);
}

export async function getNoteAsset(
  id: string,
): Promise<
  { id: string; noteId: string; mimeType: string; data: Blob } | undefined
> {
  const db = await getDB();
  return db.get("note_assets", id);
}

export async function deleteNoteAsset(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("note_assets", id);
}

export async function deleteNoteAssetsByNoteId(noteId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("note_assets", "readwrite");
  const index = tx.store.index("by_note");
  const keys = await index.getAllKeys(noteId);
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
}
```

**g) Update `permanentDeleteNoteTransactionally` and `permanentDeleteFolderTransactionally`**
to also delete associated assets. Add `'note_assets'` to the `withTransaction` store list and delete by noteId for each note being permanently deleted. Use `deleteNoteAssetsByNoteId` — or inline it in the transaction.

**h) Update `restoreBackupTransactionally`** — no change needed for assets (restored notes won't have assets; that's acceptable).

---

### 1.2 Update `repositories.ts`

Add after the existing exports:

```typescript
import {
  deleteNoteAsset,
  deleteNoteAssetsByNoteId,
  getNoteAsset,
  putNoteAsset,
} from "./idbr";

export const assetsRepository = {
  save(asset: { id: string; noteId: string; mimeType: string; data: Blob }) {
    return putNoteAsset(asset);
  },
  get(id: string) {
    return getNoteAsset(id);
  },
  delete(id: string) {
    return deleteNoteAsset(id);
  },
  deleteByNoteId(noteId: string) {
    return deleteNoteAssetsByNoteId(noteId);
  },
};
```

---

## Phase 2: Core Editor Modules

### 2.1 `frontend/src/lib/editor/serializer.ts`

````typescript
import type { JSONContent } from "@tiptap/core";

/**
 * Parse raw stored string into Tiptap-ready content.
 * Handles: empty string → empty doc, valid JSON → use as-is,
 * plain text fallback (legacy) → wrap in paragraph.
 */
export function parseContent(raw: string): JSONContent {
  if (!raw || raw.trim() === "") {
    return { type: "doc", content: [] };
  }
  try {
    return JSON.parse(raw) as JSONContent;
  } catch {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: raw }] }],
    };
  }
}

/**
 * Extract plain text from Tiptap JSON for MiniSearch indexing and summarize().
 * Joins block-level content with newlines; inlines join directly.
 */
export function extractTextFromJSON(raw: string): string {
  if (!raw || raw.trim() === "") return "";
  let doc: JSONContent;
  try {
    doc = JSON.parse(raw) as JSONContent;
  } catch {
    return raw; // plain text fallback
  }
  return nodeToText(doc).trim();
}

function nodeToText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content?.length) return "";

  const isBlock = [
    "paragraph",
    "heading",
    "codeBlock",
    "listItem",
    "blockquote",
  ].includes(node.type ?? "");
  const inner = node.content.map(nodeToText).join("");
  return isBlock ? inner + "\n" : inner;
}

/**
 * Serialize Tiptap JSON to Markdown for export.
 * Handles all nodes produced by the editor's extension set.
 */
export function jsonToMarkdown(raw: string): string {
  if (!raw || raw.trim() === "") return "";
  let doc: JSONContent;
  try {
    doc = JSON.parse(raw) as JSONContent;
  } catch {
    return raw;
  }
  return (doc.content ?? []).map(serializeBlock).join("");
}

function serializeBlock(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content) + "\n\n";
    case "heading": {
      const level = node.attrs?.["level"] ?? 1;
      return "#".repeat(level) + " " + serializeInline(node.content) + "\n\n";
    }
    case "codeBlock": {
      const lang = node.attrs?.["language"] ?? "";
      const code = (node.content ?? []).map((n) => n.text ?? "").join("");
      return "```" + lang + "\n" + code + "\n```\n\n";
    }
    case "bulletList":
      return (
        (node.content ?? [])
          .map((item) => "- " + serializeListItem(item))
          .join("") + "\n"
      );
    case "orderedList":
      return (
        (node.content ?? [])
          .map((item, i) => `${i + 1}. ` + serializeListItem(item))
          .join("") + "\n"
      );
    case "blockquote":
      return (
        (node.content ?? [])
          .map(serializeBlock)
          .join("")
          .split("\n")
          .map((l) => "> " + l)
          .join("\n") + "\n"
      );
    case "horizontalRule":
      return "---\n\n";
    default:
      return serializeInline(node.content);
  }
}

function serializeListItem(node: JSONContent): string {
  return (node.content ?? []).map(serializeBlock).join("").trimEnd() + "\n";
}

function serializeInline(nodes: JSONContent["content"]): string {
  return (nodes ?? []).map(serializeInlineNode).join("");
}

function serializeInlineNode(node: JSONContent): string {
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "image") {
    const src = node.attrs?.["src"] ?? "";
    const alt = node.attrs?.["alt"] ?? "";
    return `![${alt}](${src})`;
  }
  let text = node.text ?? "";
  if (!text) return "";
  const marks = node.marks ?? [];
  // Order matters: code > bold > italic
  if (marks.some((m) => m.type === "code")) return "`" + text + "`";
  if (marks.some((m) => m.type === "bold")) text = "**" + text + "**";
  if (marks.some((m) => m.type === "italic")) text = "*" + text + "*";
  if (marks.some((m) => m.type === "strike")) text = "~~" + text + "~~";
  return text;
}
````

---

### 2.2 `frontend/src/lib/editor/imageHandler.ts`

```typescript
import { assetsRepository } from "$lib/infrastructure/repositories";

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 0.85;

/** Resize image to max 1920px wide, convert to WebP. */
export async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("toBlob returned null")),
        "image/webp",
        WEBP_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    img.src = objectUrl;
  });
}

/**
 * Resize, persist to IndexedDB, return `asset:<uuid>` src string.
 * Use this src value directly in editor image nodes.
 */
export async function storeImageAsset(
  noteId: string,
  file: File,
): Promise<string> {
  const blob = await resizeImage(file);
  const id = crypto.randomUUID();
  await assetsRepository.save({
    id,
    noteId,
    mimeType: "image/webp",
    data: blob,
  });
  return `asset:${id}`;
}

// ── Object URL cache ──────────────────────────────────────────────────────────
// One entry per asset ID; revoked when the editor that owns the note is destroyed.

const urlCache = new Map<string, string>();

/** Resolve an `asset:uuid` string to an object URL for rendering. */
export async function resolveAssetUrl(assetId: string): Promise<string | null> {
  if (urlCache.has(assetId)) return urlCache.get(assetId)!;
  const asset = await assetsRepository.get(assetId);
  if (!asset) return null;
  const url = URL.createObjectURL(asset.data);
  urlCache.set(assetId, url);
  return url;
}

/** Revoke all object URLs for a given note. Call when Editor unmounts. */
export function revokeNoteAssetUrls(noteId: string): void {
  // We don't track per-note, so we revoke only URLs that belong to resolved assets.
  // For a future optimization, maintain a noteId → Set<assetId> map here.
  // For now: the Editor component tracks its own note's assetIds during NodeView creation.
}

/** Revoke a specific object URL and remove from cache. */
export function revokeAssetUrl(assetId: string): void {
  const url = urlCache.get(assetId);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(assetId);
  }
}
```

---

### 2.3 `frontend/src/lib/editor/extensions.ts`

```typescript
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Image } from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { common, createLowlight } from "lowlight";
import type { Extensions } from "@tiptap/core";
import { resolveAssetUrl, revokeAssetUrl } from "./imageHandler";

// ── Language registry ─────────────────────────────────────────────────────────
// All languages are bundled. `common` is lowlight's built-in curated set.
// PreferencesStore#enabledLanguages controls which appear in the UI picker;
// all remain registered so stored content always highlights correctly.

const lowlight = createLowlight(common);

// Add languages not in `common` that we want available:
import go from "highlight.js/lib/languages/go";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import sql from "highlight.js/lib/languages/sql";
lowlight.register({ go, dockerfile, sql });

export const DEFAULT_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "go",
  "bash",
  "json",
  "css",
  "html",
  "sql",
  "rust",
  "java",
  "markdown",
  "yaml",
  "dockerfile",
];

// ── Custom Image extension ────────────────────────────────────────────────────
// Resolves `asset:uuid` refs to object URLs asynchronously in a NodeView.

const AssetImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement("span");
      wrapper.contentEditable = "false";
      wrapper.className = "editor-image-wrapper";

      const img = document.createElement("img");
      img.className = "editor-image";
      img.draggable = false;
      wrapper.appendChild(img);

      const src = node.attrs["src"] as string;
      let resolvedAssetId: string | null = null;

      if (src?.startsWith("asset:")) {
        resolvedAssetId = src.slice(6);
        img.alt = "Loading…";
        resolveAssetUrl(resolvedAssetId).then((url) => {
          if (url) {
            img.src = url;
            img.alt = node.attrs["alt"] ?? "";
          } else {
            img.alt = "[Image not found]";
            wrapper.classList.add("broken-image");
          }
        });
      } else if (src) {
        img.src = src;
        img.alt = node.attrs["alt"] ?? "";
      }

      return {
        dom: wrapper,
        destroy() {
          if (resolvedAssetId) revokeAssetUrl(resolvedAssetId);
        },
      };
    };
  },
});

// ── Extension builder ─────────────────────────────────────────────────────────

export interface ExtensionOptions {
  placeholder?: string;
  readonly?: boolean;
}

export function buildExtensions(opts: ExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      // Disable built-in CodeBlock; CodeBlockLowlight replaces it
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: "plaintext",
      HTMLAttributes: { class: "code-block" },
    }),
    AssetImage.configure({
      inline: false,
      allowBase64: false,
    }),
    Placeholder.configure({
      placeholder: opts.placeholder ?? "Start writing…",
    }),
  ];
}
```

---

## Phase 3: Svelte Components

### 3.1 `frontend/src/lib/components/EditorToolbar.svelte`

Props:

```typescript
interface Props {
  editor: Editor | null;
  onImageInsert: () => void;
  enabledLanguages: string[];
}
```

Responsibilities:

- Bold, Italic, Strikethrough buttons (toggle marks)
- Heading 1, 2, 3 buttons (toggle node)
- Bullet list, Ordered list buttons
- Code block button; when cursor is inside a code block, show a `<select>` for language using `editor.getAttributes('codeBlock').language`
  - On language change: `editor.chain().focus().updateAttributes('codeBlock', { language }).run()`
- Horizontal rule insert
- Image insert button → calls `onImageInsert()`
- All buttons use `editor.isActive(...)` for active state styling
- Disable all buttons when `editor === null`

Each button follows this pattern:

```svelte
<button
  class={cn('toolbar-btn', editor?.isActive('bold') && 'is-active')}
  onclick={() => editor?.chain().focus().toggleBold().run()}
  disabled={!editor}
  title="Bold (⌘B)"
  aria-label="Bold"
>
  <!-- Lucide icon -->
</button>
```

Use `|` dividers between logical groups: text marks | headings | lists | code | media.

---

### 3.2 `frontend/src/lib/components/BubbleToolbar.svelte`

Props:

```typescript
interface Props {
  editor: Editor | null;
  editorEl: HTMLElement | null;
}
```

Responsibilities:

- Mounts a `BubbleMenu` extension on the editor with `tippyOptions: { duration: 100 }`
- Shows when text is selected and note is not in trash
- Buttons: Bold, Italic, Strikethrough, inline Code, H1, H2
- Lighter weight than the fixed toolbar

Mounting pattern:

```typescript
import { BubbleMenu } from "@tiptap/extension-bubble-menu";

$effect(() => {
  if (!editor || !bubbleEl) return;
  // BubbleMenu is added as an extension with the DOM element it should control
  // The extension is configured in buildExtensions but needs the element at runtime.
  // Pattern: pass the element to BubbleMenu.configure({ element: bubbleEl }) and
  // add it to the editor's extensionManager post-creation via editor.extensionManager.
  //
  // Simpler alternative: use the editor's `on('selectionUpdate')` + manual positioning.
  // Recommended: add BubbleMenu to buildExtensions, pass a ref element here.
});
```

**Practical mounting approach**: Add `BubbleMenu` to `buildExtensions` but pass the element
after creation. The cleanest pattern is:

In `Editor.svelte`, create a `<div bind:this={bubbleMenuEl}>` and pass it to the BubbleMenu
extension at editor creation time via `BubbleMenu.configure({ element: bubbleMenuEl })`.
The BubbleToolbar component then renders _inside_ that div as a Svelte portal slot.

---

### 3.3 `frontend/src/lib/components/Editor.svelte`

This is the central component. Full description:

**Props:**

```typescript
interface Props {
  note: NoteItem; // always fully loaded (isContentLoaded === true)
  readonly?: boolean; // derived from note.deletedAt in parent
}
```

**State:**

```typescript
let editorContainer: HTMLElement; // bind:this target
let bubbleMenuEl: HTMLElement; // bind:this for BubbleMenu element
let editor = $state<Editor | null>(null);
```

**Context dependencies (get from context):**

- `noteService` — for `update(noteId, { content })`
- `preferencesStore` — for `editorToolbar`, `enabledLanguages`

**Image insert handler:**

```typescript
async function handleImageInsert(): Promise<void> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const src = await storeImageAsset(note.id, file);
    editor?.chain().focus().setImage({ src }).run();
  };
  input.click();
}
```

**Drag & drop / paste handler (attach to `editorContainer`):**

```typescript
function handleDrop(e: DragEvent): void {
  const files = [...(e.dataTransfer?.files ?? [])].filter((f) =>
    f.type.startsWith("image/"),
  );
  if (!files.length) return;
  e.preventDefault();
  e.stopPropagation();
  files.forEach((f) => processImageFile(f));
}

function handlePaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files ?? [])].filter((f) =>
    f.type.startsWith("image/"),
  );
  if (!files.length) return;
  e.preventDefault();
  files.forEach((f) => processImageFile(f));
}

async function processImageFile(file: File): Promise<void> {
  try {
    const src = await storeImageAsset(note.id, file);
    editor?.chain().focus().setImage({ src }).run();
  } catch (err) {
    console.error("Image insert failed:", err);
    // TODO: surface error toast via uiStore
  }
}
```

**Editor lifecycle (`$effect`):**

```typescript
$effect(() => {
  if (!editorContainer) return;

  const extensions = [
    ...buildExtensions({
      placeholder: "Start writing…",
      readonly: props.readonly,
    }),
    BubbleMenu.configure({ element: bubbleMenuEl }),
  ];

  const instance = new Editor({
    element: editorContainer,
    extensions,
    content: parseContent(note.content),
    editable: !props.readonly,
    onUpdate({ editor: e }) {
      const json = JSON.stringify(e.getJSON());
      noteService.update(note.id, { content: json });
    },
  });

  editor = instance;

  return () => {
    instance.destroy();
    editor = null;
  };
});
```

**Template structure:**

```svelte
<div class="editor-root" ondrop={handleDrop} ondragover={(e) => e.preventDefault()} onpaste={handlePaste}>
  <!-- Bubble menu anchor (BubbleMenu extension controls its visibility) -->
  <div bind:this={bubbleMenuEl} class="bubble-menu" style="display:none">
    {#if editor && showBubbleMenu}
      <BubbleToolbar {editor} />
    {/if}
  </div>

  <!-- Fixed toolbar -->
  {#if showFixedToolbar && editor}
    <EditorToolbar
      {editor}
      onImageInsert={handleImageInsert}
      enabledLanguages={preferencesStore.enabledLanguages}
    />
  {/if}

  <!-- Tiptap mounts into this div -->
  <div
    bind:this={editorContainer}
    class="editor-content prose prose-sm dark:prose-invert max-w-none"
  ></div>
</div>
```

`showFixedToolbar` and `showBubbleMenu` are `$derived` from `preferencesStore.editorToolbar`:

```typescript
const showFixedToolbar = $derived(
  ["fixed", "both"].includes(preferencesStore.editorToolbar ?? "fixed"),
);
const showBubbleMenu = $derived(
  ["bubble", "both"].includes(preferencesStore.editorToolbar ?? "fixed"),
);
```

---

## Phase 4: System Integration

### 4.1 Update `+page.svelte`

Replace the body `<textarea>` block with:

```svelte
<!-- Wait for content before mounting editor (avoids empty flash) -->
{#if selectedNote.isContentLoaded}
  {#key selectedNote.id}
    <Editor note={selectedNote} readonly={selectedNote.deletedAt != null} />
  {/key}
{:else}
  <div class="editor-loading-skeleton" />
{/if}
```

Remove the `$effect` that calls `loadNoteContent` — keep it, it's still needed to trigger the load.

Remove the `prose` wrapper div that now wraps `Editor` instead.

---

### 4.2 Update `NotesStore.summarize()`

```typescript
summarize(content: string): string {
  const text = extractTextFromJSON(content);
  if (!text) return '';
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.slice(0, 2).join(' ');
}
```

Import `extractTextFromJSON` from `$lib/editor/serializer`.

---

### 4.3 Update `SearchService`

In `ensureFolderIndexed`, the `content` fetched from IndexedDB is now JSON. Update the document mapping:

```typescript
import { extractTextFromJSON } from "$lib/editor/serializer";

// Inside ensureFolderIndexed, replace:
const documents = notes.map((n) => ({
  id: n.id,
  title: n.title,
  content: contents[n.id] || "",
}));

// With:
const documents = notes.map((n) => ({
  id: n.id,
  title: n.title,
  content: extractTextFromJSON(contents[n.id] || ""),
}));
```

Do the same in `updateNoteIndex` wherever raw content is passed to the index.

---

### 4.4 Update `NoteService.getNotesForExport()`

The export system reads `content` and passes it to the Go exporter which writes `.md` files.
Convert JSON → Markdown at export time:

```typescript
import { jsonToMarkdown } from "$lib/editor/serializer";

// In getExportData(), when building results:
results.push({
  title: note.title,
  content: jsonToMarkdown(contents[id] ?? note.content),
  updatedAt: note.updatedAt,
  folderId: note.folderId,
});
```

---

## Phase 5: Settings

### 5.1 Update `PreferencesStore`

Add two new persisted settings:

```typescript
#editorToolbar = $state<'fixed' | 'bubble' | 'both'>('fixed');
#enabledLanguages = $state<string[]>(DEFAULT_LANGUAGES);

get editorToolbar() { return this.#editorToolbar; }
get enabledLanguages() { return this.#enabledLanguages; }

async setEditorToolbar(value: 'fixed' | 'bubble' | 'both') {
  this.#editorToolbar = value;
  await settingsRepository.save('editorToolbar', value);
}

async setEnabledLanguages(languages: string[]) {
  this.#enabledLanguages = languages;
  await settingsRepository.save('enabledLanguages', languages);
}
```

In `init()`, read both from `savedSettings` with appropriate fallbacks.

Import `DEFAULT_LANGUAGES` from `$lib/editor/extensions`.

---

### 5.2 Update `Settings.svelte`

Add an **Editor** tab (alongside General and Appearance).

**Toolbar section:**

```
Toolbar Style
  ○ Fixed (always visible)   ← default
  ○ Bubble (appears on selection)
  ○ Both
```

**Languages section:**

```
Code Block Languages
A checklist of all available lowlight language names.
Pre-checked: the DEFAULT_LANGUAGES set.
On change: preferencesStore.setEnabledLanguages(selected)
```

Available language names can be obtained from `lowlight.listLanguages()` after registering all grammars.

---

## Edge Cases & Guard Rails

| Case                                            | Handling                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Note not yet loaded (`isContentLoaded = false`) | Parent delays `{#key}` mount until loaded (skeleton shown)                                     |
| Empty document                                  | `parseContent('')` returns `{ type: 'doc', content: [] }` — Placeholder extension shows prompt |
| Content is legacy plain text                    | `parseContent` wraps in paragraph; no data loss                                                |
| Invalid JSON in `notes_contents`                | `parseContent` try/catch wraps as plain text                                                   |
| Switching notes rapidly                         | `{#key}` destroys and recreates editor; old note's debouncer flushes independently at 400ms    |
| Concurrent saves (rapid typing)                 | Existing `KeyedDebouncer` in `NotesStore.updateNote` handles this; 400ms window                |
| Broken asset image                              | NodeView `onerror` adds `.broken-image` class; alt text shows `[Image not found]`              |
| Image file > 1920px                             | `resizeImage` scales down before storing                                                       |
| Image paste on read-only note                   | `handlePaste` checks `!props.readonly` before processing                                       |
| Permanent note delete                           | `permanentDeleteNoteTransactionally` must call `deleteNoteAssetsByNoteId`                      |
| Editor destroyed mid-async image load           | NodeView `destroy()` calls `revokeAssetUrl`; in-flight fetch result is discarded               |
| `getAllSettings()` missing new keys             | Default values applied in `PreferencesStore.init()` if keys return null                        |

---

## CSS Requirements

Add to `app.css` or a scoped `<style>`:

```css
/* Editor content area */
.editor-content .ProseMirror {
  outline: none;
  min-height: 100%;
}

/* Placeholder */
.editor-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--muted-foreground);
  opacity: 0.3;
  pointer-events: none;
  float: left;
  height: 0;
}

/* Code block */
.editor-content pre.code-block {
  background: var(--muted);
  border-radius: 6px;
  padding: 1rem;
  overflow-x: auto;
}

.editor-content pre.code-block code {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.875rem;
}

/* Images */
.editor-image-wrapper {
  display: block;
  my: 1rem;
}
.editor-image {
  max-width: 100%;
  border-radius: 4px;
}
.broken-image {
  opacity: 0.4;
  border: 1px dashed var(--destructive);
}

/* Toolbar */
.toolbar-btn {
  padding: 4px 6px;
  border-radius: 4px;
  color: var(--muted-foreground);
  transition: background 120ms;
}
.toolbar-btn:hover {
  background: var(--accent);
}
.toolbar-btn.is-active {
  background: var(--accent);
  color: var(--foreground);
}
```

---

## TDD Protocol

Every step in the Implementation Order below follows a strict Red → Green → Refactor cycle. **No implementation file is written until its failing test exists.**

### The cycle for each step

1. **Red** — Write the test(s) for the function/behaviour you are about to implement. Run `npm run test` and confirm the test fails (not errors — a test that errors before even reaching an assertion means the import is wrong, fix that first).
2. **Green** — Write the minimum code to make the test pass. No extras.
3. **Refactor** — Clean up without changing behaviour. Re-run tests to confirm still green.
4. **Commit** — Only commit when all tests are green.

### What counts as "minimum code"

- Stub functions that `throw new Error('not implemented')` are fine during Red.
- Hardcoded return values are acceptable if they make a single test pass; the next test must force the real implementation.
- Do not write code paths that no test currently exercises.

### Test file location rules

| What you are testing                       | Test file path                                                  |
| ------------------------------------------ | --------------------------------------------------------------- |
| `src/lib/editor/serializer.ts`             | `tests/unit/editor/serializer.test.ts`                          |
| `src/lib/editor/imageHandler.ts`           | `tests/unit/editor/imageHandler.svelte.test.ts` (uses DOM APIs) |
| `src/lib/infrastructure/idbr.ts` additions | `tests/unit/infrastructure/idbr.test.ts`                        |
| `assetsRepository`                         | `tests/unit/infrastructure/assetsRepository.test.ts`            |
| `PreferencesStore` additions               | `tests/unit/stores/preferences.svelte.test.ts`                  |
| `NotesStore.summarize` change              | existing `tests/unit/stores/notesStore.svelte.test.ts`          |
| `SearchService` change                     | existing `tests/unit/services/searchService.test.ts`            |
| `Editor.svelte`                            | `tests/unit/components/editor.svelte.test.ts`                   |
| Full user journeys                         | `tests/e2e/editor.e2e.ts`                                       |

### Running tests during development

```bash
cd frontend
npm run unit-test                                    # watch mode — runs on every save
npm run test -- tests/unit/editor/serializer.test.ts # single file
npm run test -- --reporter=verbose                   # see individual it() names
```

### Non-negotiable rules (from project testing.md)

- **Never reduce total `it()` count.** If you change an existing test file, the test count must stay the same or increase.
- **Use `.clear()` to reset stores**, never replace with `new SvelteMap()`.
- **Mock `assetsRepository`** in unit tests — do not hit real IndexedDB for imageHandler tests. Use `vi.mock('$lib/infrastructure/repositories', ...)`.
- **E2E tests must wait for `[data-app-ready="true"]`** before any interaction.
- **`$derived.by` watcher pattern** for any test that needs to verify a reactive signal fired (not just check a value).

---

## Testing Requirements

Follow existing patterns in `frontend/tests/unit/`.

### Unit tests to write

**`tests/unit/editor/serializer.test.ts`**

- `parseContent('')` → empty doc
- `parseContent('{ invalid }')` → wraps as plain text paragraph
- `parseContent(validJSON)` → returns parsed object
- `extractTextFromJSON` with heading, bold, code block → correct plain text
- `jsonToMarkdown` with heading → `## text\n\n`
- `jsonToMarkdown` with bold → `**text**`
- `jsonToMarkdown` with code block → ` ```lang\ncode\n``` `
- `jsonToMarkdown` with image → `![alt](asset:uuid)`
- `jsonToMarkdown` round-trips: serialize, re-parse, re-serialize = same output

**`tests/unit/editor/imageHandler.test.ts`**

- `resizeImage` with file > 1920px wide → output width ≤ 1920
- `resizeImage` returns a Blob with mimeType `image/webp`
- `storeImageAsset` calls `assetsRepository.save` with correct shape
- `resolveAssetUrl` returns cached URL on second call (no second IDB read)
- `revokeAssetUrl` removes from cache

**`tests/unit/stores/notesStore.svelte.test.ts` additions**

- `summarize` with JSON content → extracts text, returns first 2 non-empty lines joined

**`tests/unit/services/searchService.test.ts` additions**

- `updateNoteIndex` with JSON content → MiniSearch document contains plain text, not raw JSON
- Search for a word inside a code block → returns the note

### E2E tests to write

**`tests/e2e/editor.e2e.ts`**

- Create note → type bold text (`⌘B`) → switch note → switch back → bold persists
- Create note → insert code block → set language Python → reload → language preserved
- Paste image → note saved → reload → image renders (not broken)
- Note in trash → editor is read-only → toolbar buttons are disabled

---

## Implementation Order

Each step is a complete TDD cycle: **write failing test → implement → green → commit**.
Do not start step N+1 until all tests for step N pass and `npm run check` is clean.

1. **`idbr.ts` migrations** — write tests for `putNoteAsset`, `getNoteAsset`, `deleteNoteAssetsByNoteId`, and the `getAllSettings` new keys first. Use `fake-indexeddb` (already in the project). Then implement.

2. **`assetsRepository`** — tests verify it delegates correctly to the idbr functions (mock idbr). Then implement.

3. **`serializer.ts`** — write all `serializer.test.ts` cases first (they will fail with "module not found"). Create the file with stub throws. Make each test green in order: `parseContent` → `extractTextFromJSON` → `jsonToMarkdown`.

4. **`imageHandler.ts`** — write tests for `resizeImage` (mock Canvas API), `storeImageAsset` (mock assetsRepository), `resolveAssetUrl` cache behaviour, `revokeAssetUrl`. Then implement.

5. **`PreferencesStore` additions** — add tests for `editorToolbar` and `enabledLanguages` init + setters first. Then implement.

6. **`extensions.ts`** — no isolated unit test needed; coverage comes from the Editor component test. Implement directly.

7. **`EditorToolbar.svelte`** — write component tests: toolbar renders correct buttons, active state reflects `editor.isActive()`, image button calls `onImageInsert`. Use `@testing-library/svelte` with a mock `editor` object. Then implement.

8. **`BubbleToolbar.svelte`** — write component tests: renders bold/italic buttons, passes commands to editor. Then implement.

9. **`Editor.svelte` (no image handling)** — write tests: mounts with note content, `noteService.update` called on keystroke, switching note via `{#key}` loads new content, read-only note disables editing. Then implement.

10. **Wire into `+page.svelte`** — run `wails dev`, verify basic formatting in the running app. No new tests for this step; existing E2E smoke tests cover it.

11. **Image handling in `Editor.svelte`** — write tests: drop handler calls `storeImageAsset`, paste handler ignores non-image clipboard data, insert via picker calls `setImage`. Then add to component.

12. **`NotesStore.summarize()` + `SearchService` + `NoteService.getNotesForExport()`** — add failing tests for JSON content first to existing test files. Then update the implementations.

13. **Settings UI** — add toolbar toggle and language checklist to `Settings.svelte`. Manual verification in `wails dev`. No new unit tests; preferences store is already tested.

14. **E2E tests** — write `editor.e2e.ts` against the running app. All journeys must pass before the feature is considered complete.

---

## Implementation Checklist

Track progress through each phase. Do not proceed to the next item until the current one is green and committed.

````
✅ COMPLETED
├─ Canonical decisions documented (.llm/editor.md)
├─ Storage format decided: Tiptap JSON
├─ Architecture planned
├─ TDD protocol defined
└─ File structure & API contracts specified

## Verification Summary

### Phase 1: Database & Infrastructure

`VERIFIED`

- `frontend/src/lib/infrastructure/idbr.ts`
  - `DB_VERSION = 4`
  - `note_assets` store exists and adds the `by_note` index
  - `SettingsState` includes `editorToolbar` and `enabledLanguages`
  - asset CRUD helpers exist
- `frontend/src/lib/infrastructure/repositories.ts`
  - `assetsRepository` exists and delegates to `idbr.ts`
- Tests present:
  - `frontend/tests/unit/infrastructure/idbr.test.ts`
  - `frontend/tests/unit/infrastructure/assetsRepository.test.ts`

### Phase 2: Core Editor Modules

`VERIFIED`

- `frontend/src/lib/editor/serializer.ts`
  - `parseContent()`
  - `extractTextFromJSON()`
  - `jsonToMarkdown()`
- `frontend/src/lib/editor/imageHandler.ts`
  - `resizeImage()`
  - `storeImageAsset()`
  - `resolveAssetUrl()`
  - `revokeAssetUrl()`
- `frontend/src/lib/editor/extensions.ts`
  - lowlight setup
  - extra language registration
  - `DEFAULT_LANGUAGES`
  - custom asset-backed image node view
  - `buildExtensions()`
- Tests present:
  - `frontend/tests/unit/editor/serializer.test.ts`
  - `frontend/tests/unit/editor/imageHandler.svelte.test.ts`
  - `frontend/tests/unit/stores/preferences.svelte.test.ts`

### Phase 3: Components

`VERIFIED`

- `frontend/src/lib/components/EditorToolbar.svelte`
- `frontend/src/lib/components/BubbleToolbar.svelte`
- `frontend/src/lib/components/Editor.svelte`
  - headless Tiptap mount
  - note lifecycle keyed from route
  - drop/paste image handling
  - image picker handling
  - readonly support
- Tests present:
  - `frontend/tests/unit/components/editorToolbar.svelte.test.ts`
  - `frontend/tests/unit/components/bubbleToolbar.svelte.test.ts`
  - `frontend/tests/unit/components/editor.svelte.test.ts`

### Phase 4: Integration

`VERIFIED`

- `frontend/src/routes/+page.svelte`
  - body editor replaced with `<Editor />`
  - gated on `selectedNote.isContentLoaded`
  - readonly state passed for trashed notes
- `frontend/src/lib/stores/notes.svelte.ts`
  - `summarize()` uses `extractTextFromJSON()`
- `frontend/src/lib/stores/searchService.svelte.ts`
  - folder indexing extracts plain text from editor JSON
  - incremental note indexing extracts plain text from editor JSON
- `frontend/src/lib/stores/services/noteService.ts`
  - export converts stored JSON content through `jsonToMarkdown()`

### Phase 5: Settings UI

`VERIFIED`

- `frontend/src/lib/components/Settings.svelte`
  - Editor tab exists
  - toolbar style radio controls exist
  - enabled language checklist exists
- `frontend/src/lib/stores/preferences.svelte.ts`
  - editor preferences load and persist through `settingsRepository`

### Phase 6: Test Execution Status

`PARTIALLY VERIFIED`

- Editor-focused test files exist, including `frontend/tests/e2e/editor.e2e.ts`.
- This document review did **not** run:
  - `npm run test`
  - `npm run test:e2e`
  - `npm run check`
  - `npm run lint`
- Therefore:
  - implementation presence is verified
  - current green test status is **not** verified in this pass

### Current Source Of Truth

Use the implementation and this verification summary as the current status. Treat any earlier completed-commit references or planning checklists that appeared in older versions of this file as historical notes, not live status.
