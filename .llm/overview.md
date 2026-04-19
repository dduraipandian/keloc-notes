# mdnotes Architectural Overview

## Project Mission
`mdnotes` is a high-performance, local-first desktop markdown application built for speed, privacy, and native-feeling interactions.

## Core Philosophies

### 1. Local-First & Privacy
User data never leaves the machine. Persistence is handled via IndexedDB (browser-side) and potentially filesystem-backed storage later. The app operates fully offline with no remote synchronization requirements.

### 2. Test-Driven Stability
The codebase follows a strict TDD (Test-Driven Development) approach. 
- **Unit Tests (Vitest)**: Enforce domain logic, store reactivity, and service-layer invariants.
- **E2E Tests (Playwright)**: Guarantee critical user journeys (content retrieval, folder scoping, trash lifecycle).

### 3. Reactive Domain Model
Utilizing **Svelte 5 Runes** (`$state`, `$derived`, `$effect`), the application maintains a highly reactive and efficient UI. Domain state is decoupled from the UI via a dedicated **Service Layer** and **View Projections**.

## System Architecture

### High-Level Stack
- **Desktop Shell**: Go + Wails v2 (High stability, native OS bridge).
- **Frontend Core**: Svelte 5 (Runes mode), SvelteKit.
- **Styling**: Tailwind CSS v4 (Modern, utility-first).
- **Storage**: IndexedDB (Metadata/Content separation for performance).
- **Search**: `MiniSearch` (On-demand indexing, prefix-matching focus).

### The Three-Pane Layout
The UI is structured around a classic three-pane information hierarchy:
1.  **Navigation (Left)**: Sidebar managing user folders and virtual system views (Favorites, Trash).
2.  **Organization (Middle)**: Note list with date-grouping and full-text search filtering.
3.  **Creation (Right)**: Markdown editor for the active note.

## Data & Persistence Strategy
To maintain a "snappy" feel even with thousands of notes:
- **Metadata First**: The UI predominantly interacts with note metadata (titles, timestamps).
- **Lazy Content Loading**: Full note bodies are stored in a separate IndexedDB object store and loaded only when the editor or the search indexer requires them.
- **Atomic Cascade**: Complex operations like folder deletions use batch IDs (`crypto.randomUUID()`) to ensure consistent restoration of entire subtrees.

## Search Architecture
`mdnotes` implements a local full-text search using `MiniSearch`.
- **On-Demand Indexing**: Content is pulled from IndexedDB and indexed only when a folder tree becomes active or notes are created/updated.
- **Scoped Search**: Results can be filtered by the active folder subtree, leveraging the `FolderTreeHelper`.
- **Prefix Matching**: Prioritizes prefix and exact matches over fuzzy search to maintain high precision and predictability.

## Repository Layout
- `/main.go` & `/app.go`: Wails entry point and desktop lifecycle hooks.
- `/menu/`: Native OS menu configurations (macOS roles).
- `/frontend/src/lib/stores/`:
    - **Domain Stores**: (`folders`, `notes`) Raw state and CRUD.
    - **Service Layer**: (`folderService`, `noteService`) Complex cross-store logic.
    - **Registry**: (`services.ts`) Dependency injection and singleton management.
- `/frontend/src/lib/views/`: View Models (Projections) that prepare domain data for Svelte components.
- `/frontend/tests/`: Comprehensive test suite (Unit & E2E).

## Recommendation for AI Agents
When modifying this project:
1.  **Prioritize Tests**: Add or update unit tests before changing core logic.
2.  **Respect the Service Layer**: Avoid binding components directly to deep store mutations; use services.
3.  **Mind the Runes**: Ensure all reactive state uses Svelte 5 runes and verify signal propagation in tests.

