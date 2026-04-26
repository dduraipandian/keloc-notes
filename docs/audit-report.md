# keloc-notes Audit Report

Based on a comprehensive review of the `keloc-notes` project (Go + Wails v2, Svelte 5, IndexedDB) against the standards of a Principal Engineer and Product Maintainer, here is the brutally honest audit of the application's readiness for public release.

### 🚫 Critical Issues (must fix before release)

- **Missing End-User Distribution Path**: There are no prebuilt binaries, DMGs, EXEs, or AppImages available. A user currently has to run `wails build` or `wails dev` to use the app, which completely alienates non-developer users and drastically reduces adoption.
- **Lack of Code Signing and Notarization**: Even if a binary were provided, macOS will aggressively block unsigned desktop apps with "App is damaged" or security warnings. This instantly destroys user trust.
- **Leaked Local Paths in `go.mod`**: The `go.mod` file contains a replace directive pointing to a local filesystem path (`/Users/dduraipandian/...`). This will break the build for anyone else trying to compile the project from the source.
- **Missing First-Run Onboarding**: The app relies on a three-pane layout but provides zero empty-state guidance. A new user dropping into a blank screen with no folders or notes will experience immediate friction.
- **Undefined Platform Support Parity**: The application claims to be cross-platform, but the native menu implementations (which handle critical text shortcuts like Undo/Copy/Paste) are heavily tailored for Darwin (macOS). Windows and Linux users will likely experience a broken or degraded UX.

### ⚠️ Major Friction Points

- **No Versioning Single Source of Truth**: The app version, backup metadata version, and release tags are disconnected. If a user encounters an issue, diagnosing it will be a nightmare because it's unclear exactly what version they are running.
- **Unclear Storage and Privacy Guarantees**: For a "local-first, privacy-focused" app, there is no documentation on _where_ the data is actually stored on the disk, or whether it is encrypted at rest. Advanced users will want to back up their data via file sync (e.g., Dropbox, iCloud) but won't know how.
- **Incomplete Documentation**: The README currently lacks screenshots, an accurate tech stack description, and a quick-start guide. Open-source projects without visual proof of value are rarely downloaded.
- **License and Legal Boilerplate**: The `LICENSE` file still contains placeholder `[yyyy] [name of copyright owner]` text.

### 🔒 Security Concerns

- **Cross-Site Scripting (XSS) Potential in Markdown**: While the `AlertDialog` XSS vulnerability was recently fixed, desktop markdown editors using local webviews are notoriously susceptible to XSS via maliciously crafted imported markdown files (e.g., `<img>` tags with `onerror` payloads).
- **Storage Encryption**: IndexedDB is used to store sensitive notes natively, but the data is presumably stored in plaintext within the Chromium profile directory. If a user's machine is compromised, their "private" notes are fully exposed.
- **Backup Integrity**: Restoring backups from malicious or corrupted JSON sources needs strict schema validation to prevent injecting corrupted state or malicious payloads into IndexedDB.

### ⚡ Performance Risks

- **Memory Pressure on Large Exports**: Harvesting notes for export uses chunking (50 notes per batch), which is good, but zipping thousands of notes with embedded image assets entirely in the browser thread (JavaScript) could cause the Wails webview to freeze or crash due to memory limits.
- **IndexedDB Bloat**: Storing binary image data (`note_assets`) inside IndexedDB is viable for MVPs, but as users paste hundreds of high-res images, the IndexedDB quota and performance could degrade significantly, leading to sluggish startup times or silent failures on save.
- **MiniSearch Re-indexing**: On-demand indexing when switching folders is efficient for small folders, but if a user clicks a "Root" or "All Notes" view with 10,000 notes, pulling all bodies from IndexedDB into MiniSearch synchronously will lock the UI thread.

### 📦 Packaging Gaps

- **No CI/CD Pipeline**: There are no GitHub Actions workflows to automatically run `npm run check`, `npm test`, or build the Wails binaries. Releases are entirely manual.
- **Missing Installers**: We need a `.dmg` for macOS, an `.exe` installer for Windows, and an `.AppImage` or `.deb` for Linux.
- **Auto-Updater**: Desktop apps need auto-updates (e.g., Sparkle for Mac or Wails native updaters). Without it, users will be permanently stuck on buggy MVP versions.

### 📚 Documentation Gaps

- **`SECURITY.md`**: Missing. Security researchers need a way to privately report vulnerabilities.
- **`CONTRIBUTING.md`**: Missing. Without PR templates, issue templates, and local setup instructions, external developers won't contribute.
- **Privacy Policy / Local-First Manifesto**: The app needs a clear, prominent statement explaining exactly what "local-first" means regarding telemetry, crash reports, and data exfiltration.

### 🌍 Adoption Score (0–10)

**Score: 3/10 (in its current state)**

_Reasoning_: While the architectural foundation (Svelte 5 + Wails v2) is excellent and highly performant, the app is completely inaccessible to standard users. Without prebuilt signed binaries, proper onboarding, and polished documentation, the only people who can use this are Go developers willing to compile it themselves. It is a fantastic prototype, but it is not yet a releasable product.

### 🚀 Top 5 Improvements to Maximize Adoption

1. **Automate Releases and Signing**: Set up GitHub Actions to build, sign, and notarize a macOS `.dmg` and a Windows `.exe` on every tagged release. This is the absolute highest ROI task.
2. **Implement First-Run Onboarding**: Detect an empty IndexedDB state and automatically generate an interactive "Welcome to keloc-notes" tutorial note that explains markdown, shortcuts, and privacy.
3. **Add High-Quality Screenshots to README**: Visuals sell desktop apps. Add a beautiful hero image, a GIF of the search speed, and a shot of the dark mode.
4. **Publish a "Data Privacy Promise"**: Explicitly document where data lives on disk, how backups work, and guarantee zero telemetry. This is the core value prop over Apple Notes.
5. **Clean up the Build Environment**: Remove local filesystem paths from `go.mod`, finalize the LICENSE, and ensure `npm run check` and `go build` pass cleanly out of the box for open-source contributors.
