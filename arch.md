# Create `frontend/architecture.md`

## Summary

Create a new reusable architecture guide at `frontend/architecture.md`.

This file will be the stable Svelte UI architecture reference for your future projects, based on the layered architecture we have been shaping in this repo. It will stay separate from `refactor.md`:

- `refactor.md` remains the project-specific migration tracker
- `frontend/architecture.md` becomes the reusable architecture and conventions guide

After this document step, the implementation work should return to the previous refactor track unchanged.

## Document Content

Write `frontend/architecture.md` with these sections, in this order:

1. **Purpose**
   - Explain that this architecture applies layered design to Svelte/SvelteKit UI code
   - State that it follows the same ownership style commonly used in Go services
   - Emphasize maintainability, explicit boundaries, testability, and resilience

2. **Architecture Overview**
   - Short explanation of the layer stack:
     - components
     - selection boundary
     - selectors / sources / read model
     - services
     - stores
     - repositories
     - persistence implementation

3. **Mermaid Diagram**
   - Include one Mermaid diagram using the finalized architecture already established in `refactor.md`
   - Keep the wording reusable, not tied too tightly to this app’s feature names

4. **Layer Responsibilities**
   - One subsection each for:
     - Components
     - Selection boundary
     - Selectors / source adapters / read model
     - Services
     - Stores
     - Repositories
     - Persistence implementation
   - For each layer, define:
     - what it owns
     - what it can call
     - what it must not do

5. **Recommended Project Structure**
   - Describe the reusable default structure for Svelte UI projects:
     - `src/lib/components` for rendering and interaction
     - `src/lib/stores/*.svelte.ts` for reactive domain state
     - `services.ts` or per-domain service files for workflows
     - `selectors.ts` or per-domain selector files for read composition
     - `selection.svelte.ts` for selected context ownership
     - `repositories.ts` for persistence-facing wrappers
     - low-level storage implementation behind a dedicated file such as `idbr.ts`
   - Clarify that larger projects may split these by domain later

6. **Data Flow**
   - Write-side flow:
     - component triggers intent
     - service coordinates workflow
     - stores mutate local state
     - repositories persist when needed
   - Read-side flow:
     - component reads selectors or source model
     - selectors read stores
     - selectors never perform mutations

7. **Naming and Conventions**
   - Use `Service` naming, not `UseCase`
   - Use domain names like `folderService`, `noteService`, `trashService`
   - Keep selectors/view helpers named by display intent
   - Reserve “store” for reactive state owners
   - Reserve “repository” for persistence wrappers
   - Reserve “selection” for active context ownership
   - Treat source/view abstractions as read-only

8. **Testing Guidelines**
   - Store tests for local mutation and persistence behavior
   - Service tests for workflow rules and cross-entity orchestration
   - Selector tests for read composition
   - Playwright tests for user-visible flows
   - Recommend scoped e2e helpers for repeated UI structures such as dialogs, panes, and sidebar trees

9. **Anti-Patterns**
   - Components coordinating multi-entity workflows
   - Stores orchestrating other stores
   - Services becoming UI read-model builders
   - Repositories owning business rules
   - Special-case strings spread through components
   - Multiple owners for persisted selection state

10. **Adoption Checklist**

- Short checklist for starting a new Svelte project with this architecture:
  - define domains
  - create stores per domain
  - add services for workflows
  - introduce selection early
  - add selectors when read logic grows
  - isolate persistence behind repositories
  - add service tests first and e2e tests for critical journeys

## Examples and Tone

- Make the guide reusable, but include a few light references to this repo as examples
- Use examples only to clarify boundaries, not to document every implementation detail
- Keep the tone practical and opinionated, like a project standard you plan to reuse

## Verification

No runtime code changes are part of this step.

The document is complete when it:

- clearly explains the layered architecture without chat context
- includes one Mermaid diagram
- defines ownership and forbidden responsibilities per layer
- includes naming, structure, and testing conventions
- is reusable for future Svelte UI projects
- remains separate from `refactor.md`

## Assumptions and Defaults

- Final file path: `frontend/architecture.md`
- `frontend/README.md` is not being rewritten in this step
- `refactor.md` remains the project-specific tracker
- This document is intentionally broader than architecture-only; it includes conventions and testing guidance
- After this doc is created, work should return to the previous implementation task, not start a new architecture direction
