---
description: Staff Engineer Code review for svelte 5, go wails desktop app
---

# Staff-Level Code Review Protocol: Wails + Svelte 5 + Tailwind

**Role**: Act as a Senior Staff Engineer.
**Objective**: Perform a rigorous code review focusing on architectural integrity, security of the IPC bridge, and Svelte 5 reactivity performance.

---

## 1. Security & Bridge Integrity (Go/Wails)

- **Argument Injection & Sanitization**: Audit all Go bindings. Are frontend-provided strings (paths, filenames, IDs) validated before being used in `os`, `exec`, or database calls?
- **Bridge Payload Optimization**: Identify large JSON serializations. If payloads exceed 1MB, recommend **Streaming** or **Chunking** to prevent blocking the Wails main thread.
- **Error Handling**: Ensure Go errors are caught and returned as structured objects to the frontend. Reject "silent failures" or generic "error occurred" strings.

## 2. Svelte 5 Reactivity (Runes Audit)

- **Effect Hygiene**: Check every `$effect`. Does it include a cleanup function? Does it leak Wails event listeners or DOM observers? Ensure `$effect` is not being used where a `$derived` rune is more appropriate.
- **Reactivity Overhead**: Identify where `$state` is used for large, static, or deeply nested objects. Recommend `$state.raw` to bypass proxy overhead where deep reactivity isn't required.
- **Snippet Logic**: Audit Svelte 5 snippets. Ensure they are receiving data efficiently and not causing unnecessary re-renders of the entire list pane.

## 3. Tailwind & UI Performance

- **Layout Stability**: Check for dynamic classes that could trigger **Cumulative Layout Shift (CLS)**, especially during the "hydration" phase when data first arrives from the Go backend.
- **Design System Consistency**: Look for hardcoded magic numbers in Tailwind classes. Suggest using the `tailwind.config.js` for app-wide spacing and color tokens to maintain the Apple Notes/Bear aesthetic.

## 4. Local-First Data Integrity

- **Atomic Operations**: Verify that file writes in Go are atomic (write-to-temp-then-rename). Ensure a crash mid
