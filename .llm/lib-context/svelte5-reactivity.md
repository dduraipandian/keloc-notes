# Svelte 5 Reactivity Best Practices (Stores)

This document provides guidelines for managing global state and reactivity in Svelte 5 based on "hard-learned" lessons from stabilizing the `NotesStore`.

## 1. Explicit Property Declaration
Never rely on implicit reactivity from standard class fields. Every property that needs to trigger a UI update or a `$derived` signal must be explicitly declared as a rune.

```typescript
// ✅ CORRECT
class NotesStore {
  selectedNoteID = $state<NoteID | null>(null);
  favoriteCount = $state(0);
}

// ❌ INCORRECT (Non-reactive)
class NotesStore {
  selectedNoteID: NoteID | null = null;
}
```

## 2. Flattening Reactive State
Deeply nested reactive objects (e.g., `const state = $state({ counts: { folders: {}, favorites: 0 } })`) can become brittle, especially when tracking dynamic keys in unit test environments like Vitest/JSDOM.

**Strategy**: Flatten complex state into individual top-level reactive properties.
- Use primitive `$state` for simple counters.
- Use a reactive Record for dynamic key-value mappings.

```typescript
// ✅ ROBUST PATTERN
class NotesStore {
  folderNoteCounts = $state<Record<string, number>>({});
  favoriteCount = $state(0);
  trashCount = $state(0);
  
  // Provide a getter for backward compatibility if needed
  get counts() {
    return {
      byFolder: { get: (id) => this.folderNoteCounts[id ?? 'null'] ?? 0 },
      favorites: this.favoriteCount,
      trash: this.trashCount
    };
  }
}
```

## 3. Dynamic Key Reactivity (Map vs. Record)
While `SvelteMap` is powerful, using a standard object wrapped in `$state` (a Record) is often more reliable for triggering reactivity signals in diverse environments (including non-browser tests) when keys are added or updated.

- **Use `SvelteMap`** when you need heavy Map-specific methods or high-volume item management with complex keys.
- **Use `$state(Record)`** for simpler ID-to-Primitive mappings where reliable signal propagation to `$derived` blocks is the priority.

## 4. Selection & Editor Sync
Selection issues often stem from "floating" selection IDs that aren't properly tracked.
- **Fix**: Declare the selection ID as a `$state` property in the owner store.
- **Verification**: Ensure the component (e.g., Editor) accesses the store's selection property directly in a way that Svelte's tracking system can see.

## 5. Testing Reactivity (Signal Verification)
Testing a store's data is not enough; you must verify that **reactive signals are firing** to ensure the UI will actually re-render.

**Pattern**: Use `$derived.by` with a counter in your unit tests.

```typescript
it('should trigger reactivity when counts change', () => {
  let signalsFired = 0;
  const countWatcher = $derived.by(() => {
    signalsFired++;
    return notesStore.getNoteCount('f1');
  });

  // 1. Initial access (triggers track)
  expect(countWatcher).toBe(0);
  expect(signalsFired).toBe(1);

  // 2. Mutate state
  notesStore.createNote('f1');

  // 3. Re-access and verify signal propagation
  expect(countWatcher).toBe(1);
  expect(signalsFired).toBe(2); // Signal fired!
});
```

## 6. Incremental Updates (O(1) vs O(n))
For list-heavy views (like sidebars with note counts), avoid `$derived` blocks that iterate over the entire collection (`O(n)`).
- **Correct approach**: Use incremental counter updates (`O(1)`) inside your mutation methods (`createNote`, `updateNote`, `deleteNote`). Combined with flattened `$state`, this provides both high performance and reliable reactivity.
