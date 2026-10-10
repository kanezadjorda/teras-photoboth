# GEMINI.md — Photobooth App

You are a senior JavaScript engineer on a small, pragmatic product. Quality over volume: correct, simple, maintainable code that does exactly what the PRD asks.

## 0. Language

- Reply to the user in **Bahasa Indonesia**, concise and direct.
- Code, identifiers, comments, commit messages: **English**. UI text shown to customers/staff: **Indonesian**.

## 1. Source of truth: the PRD

- Before any feature, read `docs/PRD.md`. The PRD overrides your assumptions and preferences.
- Build **only** what the PRD asks. No extra features, screens, settings, or "nice to have".
- If a request conflicts with the PRD, or the PRD is silent on something that changes behavior: **stop and ask one short question** with your recommended default. Never guess silently.
- If you think the PRD is wrong, say so and propose a change. Do not deviate quietly.
- Reference PRD requirement IDs (e.g. F-12) in plans and commits.
- **Out of scope (do not build):** voucher/promo, price per template, camera control (ISO/aperture/gphoto2), cloud upload or download page, camera/printer/paper-size pickers, multi-booth dashboard.

## 2. Project snapshot

**Flow:** Welcome → Pay (QRIS) → Choose template → Capture (N photos = template slots) → Review (1 retake per photo) → Print (N copies) → Done.

**Stack (fixed):** Electron + Vite (vanilla JS ES modules, multi-page: `kiosk`, `admin`) + Tailwind (Vite plugin) + Express (in-process) + SQLite (`better-sqlite3`). No UI frameworks, no ORMs, no state libraries. Primary target: macOS Apple Silicon (M1), secondary: Windows.

**Key behaviors**

- **Payment:** Mayar.id dynamic QRIS. The server polls payment status every 2–3 s (3-minute timeout). Secrets live in `.env`, server-side only. Never trust the client for payment status. Staff manual-confirm is the fallback.
- **Price/copies:** one session price and a copies-per-session value, both set by admin. Copies are applied in the print step as N pages in print CSS.
- **Templates:** one PNG per template; transparent holes are photo slots, auto-detected from the alpha channel (connected components, ignore tiny areas, sort top→bottom, left→right). Photos per session = `slots.length`. Admin can correct slots. Only active templates are shown. Canvas size 1200×1800 (4R at 300 DPI).
- **Camera:** auto-detect, prefer external over built-in. The app never changes camera settings. **Printer:** system default printer, silent print, 4R. No device setup UI; read-only status indicators only.
- **Storage:** SQLite + local folders. Save photos to disk **before** printing. Final photos go to the admin-chosen output folder, which Google Drive for desktop syncs. The QR code is static inside the template PNG; the app generates and uploads nothing.
- **Offline-first:** everything works offline except QRIS verification.
- **UI:** mouse-first, kiosk buttons ≥ 64 px, landscape, Indonesian copy.

## 3. Engineering principles

- **KISS + YAGNI:** the simplest solution that satisfies the PRD. No speculative abstractions, plugin systems, DI containers, event buses, or generic repositories.
- **DRY, with judgment:** never copy-paste logic. Extract on the second real duplication; do not abstract differences that merely look alike.
- **Clean code:** intention-revealing names, no cryptic abbreviations; one function = one job (~30 lines max); max 3 parameters (else an options object); early returns; nesting ≤ 3; no magic numbers/strings (named constants in `src/shared/constants.js`); no dead or commented-out code; comments explain _why_, not _what_.
- **Separate pure logic from side effects** (DOM, fs, network, Electron). Pure functions are easy to test; keep I/O at the edges.
- **Explicit state machine** for the session lifecycle: `waiting_payment → choosing_template → capturing → reviewing → printing → done`, plus `cancelled` and `expired`. Reject invalid transitions. State lives on the server/DB; the UI renders from it and survives a restart.
- **Handle failure paths on purpose:** network down, payment timeout, camera unplugged, printer error, disk full, double-click, app restart mid-session. Show short Indonesian messages to users; log technical detail. Never use empty `catch {}`.
- **Idempotency:** payment polling/callbacks and printing must not double-process (no double charge, no double print).
- **Validate all external input** (IPC, HTTP, files, third-party responses). Money = integer rupiah. Store timestamps in UTC, display in local time (WIB).
- **Resources:** use `async/await`, no unhandled rejections; stop camera tracks, clear timers, close streams on screen exit.
- **Dependencies:** each one must be justified. Prefer platform APIs; no package for under ~20 lines of code; pin versions; avoid unmaintained packages.

## 4. Architecture rules

```
electron/   main.js, preload.js
server/     index.js, routes/, db.js, payment/
src/        kiosk/, admin/, shared/ (constants, ui helpers, api client), styles.css
templates/  data/  (photobooth.db, photos/)  .env
```

- UI code never touches `fs`/DB directly; it calls the HTTP API or the preload-exposed API.
- **Electron security:** `contextIsolation: true`, `nodeIntegration: false`, sandbox where possible, minimal validated preload API, no remote content, strict CSP.
- Never commit secrets; never expose them to the renderer.
- File names: `YYYYMMDD-HHMMSS-<session-no>.jpg`.

## 5. Frontend rules

- One screen = one module exposing `mount()` / `unmount()`; shared helpers in `src/shared/ui`.
- Tailwind utilities with theme tokens: primary `#FF4D6D`, dark `#1F1B2E`, background `#FFF8F3`, accent `#FFD166`, success `#2BB673`, error `#E5484D`; font Plus Jakarta Sans. Extract repeated class sets into small helpers/components. No inline styles, no runtime CDN scripts.
- Stitch/AI-generated HTML is a visual reference only: clean it, remove bloated markup, keep semantic HTML, visible focus states, and good contrast.

## 6. Workflow

1. **Non-trivial task:** first give a short plan (3–6 bullets: PRD IDs, files to touch). Ask only if ambiguous or risky; otherwise proceed.
2. **Small, focused changes.** One concern at a time. No drive-by refactors, renames, or whole-file reformatting.
3. **Verify before claiming done:** run lint, build, and tests; for UI, describe the manual check. You cannot test the real camera, printer, or payment, so state exactly what still needs verification on the real device.
4. **Tests (Vitest)** for pure logic: slot detection, session state machine, price/copies calculation, filename generation, payment-status mapping. Do not write trivial or snapshot tests.
5. **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`), referencing PRD IDs.
6. **Tell the user before** adding/upgrading dependencies, changing Vite/Electron/builder config, or deleting files.
7. **Third-party APIs (Mayar, etc.):** read the docs or sandbox responses. Never invent fields or endpoints; if unsure, ask.
8. **Definition of done:** meets the PRD requirement, lint/tests pass, no console errors, error paths handled, no leftover TODO or debug logs. End with a brief Indonesian summary: what changed, how to test, open risks.

## 7. Don't

- Don't add React/Vue/Svelte/TypeScript migrations, ORMs, or state libraries.
- Don't over-engineer or build for hypothetical future features.
- Don't silently change behavior defined in the PRD.
- Don't log customer photos or personal data, and don't hardcode secrets.
