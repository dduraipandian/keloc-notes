# Svelte 5 Guidelines

This document outlines the best practices and critical "gotchas" for Svelte 5 reactivity in the `mdnotes` project.

## 1. Rune-Based State Management

### Class Properties

- Use `$state()` for any property that needs to be reactive.
- Use `$derived()` or `$derived.by()` for computed values.
- **CRITICAL**: Initializing a field with `$state()` in the class body makes that property reactive. Avoid re-initializing the same property with `$state()` inside the constructor (it is redundant and can lead to confusing proxy chains).
- **Explicit Declaration**: Never rely on implicit reactivity from standard class fields. Every property that needs to trigger a UI update or a `$derived` signal must be explicitly declared as a rune.

```typescript
class Store {
  items = $state<string[]>([]); // Correct
  selectedID = $state<string | null>(null); // ✅ Explicit
}
```

## 2. Flattening Reactive State

Deeply nested reactive objects (e.g., `const state = $state({ counts: { folders: {}, favorites: 0 } })`) can become brittle, especially when tracking dynamic keys in unit test environments like Vitest/JSDOM.

**Strategy**: Flatten complex state into individual top-level reactive properties.

- Use primitive `$state` for simple counters (e.g., `favoriteCount`, `trashCount`).
- Use a reactive Record for dynamic key-value mappings (e.g., folder-specific counts).

```typescript
class NotesStore {
  folderNoteCounts = $state<Record<string, number>>({});
  favoriteCount = $state(0);

  // Provide a getter for backward compatibility if needed
  get counts() {
    return {
      byFolder: { get: (id) => this.folderNoteCounts[id ?? "null"] ?? 0 },
      favorites: this.favoriteCount,
    };
  }
}
```

## 3. Dynamic Key Reactivity (Map vs. Record)

- **Use `SvelteMap`** when you need heavy Map-specific methods or high-volume item management with complex keys. Note that a `SvelteMap` only tracks additions, removals, and replacements of entries; it does NOT automatically make the inner properties of its values reactive.
- **Use `$state(Record)`** for simpler ID-to-Primitive mappings (like folder counts). Standard objects wrapped in `$state` are often more reliable for triggering signals in diverse environments (including non-browser tests) when keys are added or updated.

## 4. Deep Reactivity & Proxies

- If an object is stored in a collection (like a `SvelteMap` or an array) and its **individual properties** need to be reactive (e.g., `folder.title`), the object **must** be wrapped in `$state()` before being added to the collection.

```typescript
// CORRECT PATTERN
const folder = $state({ title: "New" });
folders.set(id, folder);
folder.title = "Updated"; // UI updates correctly
```

## 5. Selection & Editor Sync

Selection markers (e.g., `selectedNoteID`) must be reactive `$state` properties in the owner store to ensure components (like the Editor) stay in sync with the current application state.

## 6. Incremental Updates (O(1) vs O(n))

For list-heavy views where performance is critical (like sidebars with note counts), avoid `$derived` blocks that iterate over the entire collection (`O(n)`).

- **Correct approach**: Use incremental counter updates (`O(1)`) inside your mutation methods (`createNote`, `updateNote`, `deleteNote`). Combined with flattened `$state`, this provides both maximum performance and reliable reactivity.

## 7. Snapshotting

- Use `$state.snapshot(obj)` when passing data to non-reactive layers (like IndexedDB repositories or Wails backends). This strips the proxies and provides a plain JS object.

## 8. Testing Reactivity (Signal Verification)

Verify that **reactive signals are firing**, not just that the final value is correct. In Vitest, use a `$derived.by` variable with a counter to observe whether the signal was triggered.

```typescript
it("property change should trigger signal", () => {
  let signalsFired = 0;
  const watcher = $derived.by(() => {
    signalsFired++;
    return store.count; // Track signal
  });

  // 1. Initial access (triggers track)
  expect(watcher).toBe(0);
  expect(signalsFired).toBe(1);

  // 2. Mutate state
  store.increment();

  // 3. Verify signal propagation
  expect(watcher).toBe(1);
  expect(signalsFired).toBe(2); // Signal fired!
});
```
