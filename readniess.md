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

- [x] Publish a real end-user install path for the primary release target.
      Decision: ship a macOS `.dmg` as the primary install path.
      Verified: `.dmg` packaging path works on macOS.
      Remaining concern: signing/notarization is still separate release-polish work.
- [x] Narrow and state supported platforms explicitly for release.
      Decision: `macOS supported`, `Windows preview`, `Linux preview`.
- [x] Add first-run onboarding for brand-new users.
      Landed: first-run guidance was added to the folder sidebar, note list, and editor empty state.
- [x] Establish one canonical app version source.
      Landed: frontend app surfaces now read from a shared `frontend/package.json` version via `frontend/src/lib/appVersion.ts`.
- [x] Fix public license metadata.
      Landed: placeholder copyright appendix text in `LICENSE` was replaced with real attribution.

## 2. Major Friction Points

- [ ] Add screenshots or demo visuals to the README.
      Goal: make the product value obvious in under 10 seconds.
- [x] Rewrite the README install section for end users, not just contributors.
      Landed: user install flow, release channel, and source/developer flow are now split clearly.
- [x] Reconcile README product claims with current shipped behavior.
      Landed: README now reflects the rich text editor, current platform support, and current macOS packaging path.
- [x] Rewrite README copy in a natural maintainer voice.
      Landed: README opening, install, release, and support sections were rewritten in a plainer maintainer voice.
- [x] Document the exact supported OS matrix and support level.
      Landed in `README.md` with an explicit platform support table and release policy.
- [x] Add a clear release channel strategy.
      Landed: README now states GitHub Releases for macOS `.dmg` downloads and manual updates for now.

## 3. Security And Trust

- [x] Document where local data is stored on each supported platform.
      Landed in `docs/security-and-storage.md` with current platform-specific storage notes and runtime caveats.
- [x] Document whether data is encrypted at rest.
      Landed in `docs/security-and-storage.md`.
- [x] Document backup compatibility guarantees across versions.
      Landed in `docs/security-and-storage.md`.
- [x] Document what "local-first" means in practical terms.
      Landed in `README.md` and `docs/security-and-storage.md`.
- [ ] Ship signed binaries for the primary release platform.
- [ ] Notarize the macOS build if macOS is the first public target.
      Current decision: deferred for now. Known consequence: users will see macOS trust/Gatekeeper friction on first launch.
- [x] Add `SECURITY.md` with a vulnerability disclosure path.

## 4. Failure Modes And Recovery

- [-] Create a dedicated Failure Modes And Recovery plan.
      Landed in `docs/failure-modes-and-recovery-plan.md`.
- [ ] Document recovery behavior for corrupted IndexedDB or blocked upgrades.
      See plan: `docs/failure-modes-and-recovery-plan.md` section 3.
- [ ] Add user-facing guidance for startup failures beyond a quit dialog.
      See plan: `docs/failure-modes-and-recovery-plan.md` section 2.
- [ ] Document backup restore expectations and limitations.
      See plan: `docs/failure-modes-and-recovery-plan.md` section 4.
- [ ] Define recovery guidance for failed imports/exports.
      See plan: `docs/failure-modes-and-recovery-plan.md` section 5.
- [ ] Audit crash-recovery behavior for incomplete writes and interrupted shutdown.
      See plan: `docs/failure-modes-and-recovery-plan.md` sections 1 and 6.

## 5. Performance And Stability

- [ ] Publish basic performance expectations for realistic note-library sizes.
- [ ] Add a repeatable manual performance test checklist.
- [ ] Add a release verification pass for startup time, typing responsiveness, and search responsiveness.
- [ ] Audit for long-running observers/effects and lifecycle leaks during app mount/unmount.
- [ ] Verify large-library behavior with import/export and search indexing workloads.

## 6. Packaging And Distribution

- [x] Produce a macOS `.dmg` install package.
      Current decision: `.dmg` is the chosen primary distribution format.
      Verified: maintainer packaging script added at `scripts/create-dmg.sh`, icon build script added at `scripts/build-icon.sh`, release notes added in `docs/macos-release.md`, and `.dmg` run confirmed on macOS.
- [ ] Decide whether code signing is in scope for the first macOS release.
- [x] Document the exact first-run behavior for an unsigned / unnotarized build.
      Landed in `README.md` with Gatekeeper workaround steps for first launch.
- [ ] Decide whether Homebrew should be supported.
- [ ] Decide whether Windows installer support is release-ready or preview-only.
- [ ] Decide whether Linux distribution support is release-ready or preview-only.
- [ ] Document versioning strategy for releases and binaries.
- [ ] Decide whether auto-update is in scope for the first public release.
- [ ] If auto-update is out of scope, document manual update expectations clearly.

## 7. Documentation And Onboarding

- [ ] Add a user-focused quick start that gets someone successful in under 5 minutes.
- [ ] Add screenshots under `docs/` and reference them from `README.md`.
- [x] Split README clearly between user install flow and contributor/dev setup.
- [x] Add a short product overview section that explains who the app is for and why it exists without sounding like marketing copy.
- [x] Audit README section-by-section for tone, redundancy, and credibility.
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

1. [x] Supported platform positioning
2. [x] One-click install path for the primary platform
       Decision: macOS `.dmg`, with notarization deferred for now.
3. [ ] Canonical versioning source
4. [ ] License cleanup
5. [ ] README overhaul with screenshots and support matrix
       Include: human tone, user-vs-contributor split, product positioning, and trust sections.
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
       Include: human tone, screenshots, clear support policy, install path, and trust details.
5. [ ] Add public maintainer hygiene: CI, `SECURITY.md`, `CONTRIBUTING.md`, templates.

## 12. Notes

- We should update this file as each item is completed.
- We should keep implementation details in code/docs and keep this file focused on release tracking.
- When we start an item, mark it `[-]`.
- When it lands and is verified, mark it `[x]`.
