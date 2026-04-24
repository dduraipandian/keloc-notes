# Release Readiness Tracker

This file captures the current public-release gaps for `keloc-notes` based on the desktop app audit.

Goal:
- track the work needed before a public launch
- tackle one item at a time
- keep scope explicit so we do not mix release blockers with nice-to-haves

Status legend:
- `[ ]` not started
- `[-]` in progress
- `[x]` done

## 1. Critical Issues

- [ ] Publish a real end-user install path for the primary release target.
  Current state: install instructions are developer-oriented and require Go, Node.js, Wails CLI, and local build steps.
- [ ] Narrow and state supported platforms explicitly for release.
  Current state: macOS is the primary experience; Windows/Linux menu implementations are still stubs.
- [ ] Add first-run onboarding for brand-new users.
  Current state: the app exposes core controls, but the empty states do not explain the workflow clearly enough.
- [ ] Establish one canonical app version source.
  Current state: version values are inconsistent across frontend metadata, About dialog fallback, and backup export fallback.
- [ ] Fix public license metadata.
  Current state: `LICENSE` still contains placeholder copyright appendix text.

## 2. Major Friction Points

- [ ] Add screenshots or demo visuals to the README.
  Goal: make the product value obvious in under 10 seconds.
- [ ] Rewrite the README install section for end users, not just contributors.
  Goal: separate "install app" from "build from source".
- [ ] Reconcile README product claims with current shipped behavior.
  Current mismatch examples: editor maturity, platform support, packaging status.
- [ ] Document the exact supported OS matrix and support level.
  Example: `macOS supported`, `Windows preview`, `Linux preview`.
- [ ] Add a clear release channel strategy.
  Goal: explain where users download builds and how updates are communicated.

## 3. Security And Trust

- [ ] Document where local data is stored on each supported platform.
- [ ] Document whether data is encrypted at rest.
- [ ] Document backup compatibility guarantees across versions.
- [ ] Document what "local-first" means in practical terms.
  Include: no sync, no cloud dependency, no account requirement, no remote upload by default.
- [ ] Ship signed binaries for the primary release platform.
- [ ] Notarize the macOS build if macOS is the first public target.
- [ ] Add `SECURITY.md` with a vulnerability disclosure path.

## 4. Failure Modes And Recovery

- [ ] Document recovery behavior for corrupted IndexedDB or blocked upgrades.
- [ ] Add user-facing guidance for startup failures beyond a quit dialog.
- [ ] Document backup restore expectations and limitations.
- [ ] Define recovery guidance for failed imports/exports.
- [ ] Audit crash-recovery behavior for incomplete writes and interrupted shutdown.

## 5. Performance And Stability

- [ ] Publish basic performance expectations for realistic note-library sizes.
- [ ] Add a repeatable manual performance test checklist.
- [ ] Add a release verification pass for startup time, typing responsiveness, and search responsiveness.
- [ ] Audit for long-running observers/effects and lifecycle leaks during app mount/unmount.
- [ ] Verify large-library behavior with import/export and search indexing workloads.

## 6. Packaging And Distribution

- [ ] Produce a signed/notarized macOS `.app` or `.dmg`.
- [ ] Decide whether Homebrew should be supported.
- [ ] Decide whether Windows installer support is release-ready or preview-only.
- [ ] Decide whether Linux distribution support is release-ready or preview-only.
- [ ] Document versioning strategy for releases and binaries.
- [ ] Decide whether auto-update is in scope for the first public release.
- [ ] If auto-update is out of scope, document manual update expectations clearly.

## 7. Documentation And Onboarding

- [ ] Add a user-focused quick start that gets someone successful in under 5 minutes.
- [ ] Add screenshots under `docs/` and reference them from `README.md`.
- [ ] Add a privacy and storage section to the README or docs.
- [ ] Add backup/export/import documentation.
- [ ] Add `CONTRIBUTING.md`.
- [ ] Add issue templates and PR template.
- [ ] Add CI/CD documentation or workflow notes for contributors.

## 8. Adoption Readiness

- [ ] Tighten the product positioning.
  Goal: clearly answer why someone should pick this over Apple Notes, Bear, Obsidian, or plain markdown files.
- [ ] Define the primary target user.
  Candidate: developers who want a local-first desktop notes app with markdown portability.
- [ ] Make the differentiation obvious in the README opening section.
  Focus: local-first, simple UX, markdown portability, no account, desktop-native shell.
- [ ] Identify the minimum feature bar required before public promotion.
  Examples: installability, trust docs, screenshots, onboarding, versioning, support policy.

## 9. Testing And Release Gates

- [ ] Make frontend quality gates reproducible in CI.
  Include: `npm run test`, `npm run check`, `npm run lint`.
- [ ] Add a release workflow for `wails build` on the primary supported platform.
- [ ] Add a documented release checklist for maintainers.
- [ ] Add a smoke-test pass for install, first run, create note, search, export, import, quit/relaunch.
- [ ] Add a platform-specific release checklist for macOS packaging and signing.

## 10. Recommended Execution Order

Work in this order to maximize release readiness quickly:

1. [ ] Supported platform positioning
2. [ ] One-click install path for the primary platform
3. [ ] Canonical versioning source
4. [ ] License cleanup
5. [ ] README overhaul with screenshots and support matrix
6. [ ] First-run onboarding
7. [ ] Privacy/storage/backup documentation
8. [ ] CI and release gates
9. [ ] Secondary platform decision and positioning
10. [ ] Auto-update decision

## 11. Top 5 Highest-ROI Improvements

These are the highest-impact adoption improvements from the audit:

1. [ ] Ship one platform properly.
2. [ ] Add first-run onboarding.
3. [ ] Fix versioning and release identity.
4. [ ] Turn the README into a product-facing landing page.
5. [ ] Add public maintainer hygiene: CI, `SECURITY.md`, `CONTRIBUTING.md`, templates.

## 12. Notes

- We should update this file as each item is completed.
- We should keep implementation details in code/docs and keep this file focused on release tracking.
- When we start an item, mark it `[-]`.
- When it lands and is verified, mark it `[x]`.
