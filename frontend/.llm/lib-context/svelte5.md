# Svelte 5 Reactivity Guidelines

This document outlines the best practices and critical "gotchas" for Svelte 5 reactivity in the `mdnotes` project.

## 1. Rune-Based State Management

### Class Properties
- Use `$state()` for any property that needs to be reactive.
- Use `$derived()` or `$derived.by()` for computed values.
- **CRITICAL**: Initializing a field with `$state()` in the class body makes that property reactive. Avoid re-initializing the same property with `$state()` inside the constructor (it is redundant and can lead to confusing proxy chains).

```typescript
class Store {
    items = $state<string[]>([]); // Correct
    
    constructor() {
        // this.items = $state([]); // REDUNDANT - Avoid
    }
}
```

## 2. Deep Reactivity & Proxies

### Object Literals
- If an object is stored in a `SvelteMap` or an array, and its **individual properties** need to be reactive (e.g., `folder.title`), the object **must** be wrapped in `$state()`.
- A `SvelteMap` only tracks additions, removals, and replacements of entries. It does NOT automatically make the inner properties of its values reactive.

```typescript
// FAILING PATTERN (Non-reactive properties)
const folder = { title: 'New' };
folders.set(id, folder);
folder.title = 'Updated'; // UI will NOT update

// CORRECT PATTERN
const folder = $state({ title: 'New' });
folders.set(id, folder);
folder.title = 'Updated'; // UI updates correctly
```

## 3. Snapshotting
- Use `$state.snapshot(obj)` when passing data to non-reactive layers (like IndexedDB repositories or Wails backends). This strips the proxies and provides a plain JS object.

## 4. Testing Reactivity
- To verify reactivity in Vitest, use a `$derived` variable or an `$effect` (if in a component context) to observe the change.

```typescript
it('property change should be reactive', () => {
    const item = $state({ val: 1 });
    const double = $derived(item.val * 2);
    
    item.val = 2;
    expect(double).toBe(4); // Only passes if item is $state()
});
```
