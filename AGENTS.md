# AGENTS.md - Codex Operating Rules (Supplier-Project-Activity Tracking App)

These rules apply to all changes in this repo, including documentation and config updates.
If you cannot follow a rule, stop and report what blocks you.

---

## 0) Verification Gate (HARD REQUIREMENT)

You may not say: "complete", "done", "fixed", "ready", "merged", or "ship it"
until you have passed the Verification Gate below.

### Verification Gate = REQUIRED BEFORE FINAL RESPONSE
You must do ALL of the following and include evidence:

1) Run quality gates:
- `npm run type-check`
- `npm run lint`

2) Run the app:
- `npm run electron:dev` for any change that is not renderer-only styling/layout
- `npm run dev` is allowed ONLY for renderer-only styling/layout changes (no routing/state/logic changes)

3) Manual verification in the running app for the changed feature(s)

### Evidence Requirement (NO EXCEPTIONS)
In your final response you must include:
- The commands you ran AND the terminal output (copy/paste).
  - If output is long, include the final ~20 lines that show success or the error.
- The manual steps you performed in the UI
- The observed result

If approvals are required to run commands:
- You must ASK to run the Verification Gate commands.
- You may not skip them to "avoid bothering the user".

If you cannot run the commands due to environment issues:
- You must include the exact error output and what you tried.
- You must NOT claim completion.
- You must label the work as "Implemented but Unverified".

---

## 1) Repository Structure (DO NOT violate)

- `src/` - React + Vite renderer (pages, components, styles)
- `electron/` - Electron main process, preload, IPC handlers, SQLite/database logic
- `shared/` - cross-process TypeScript types shared by renderer + main
- `electron/migrations/` - SQLite schema migrations (append-only; never rewrite old migrations)
- `dist-electron/` - build output (do not commit changes here)

Root configs include `vite.config.ts`, `tsconfig*.json`, and `tailwind.config.js`.

---

## 2) Build, Test, and Development Commands (use these exactly)

Development:
- `npm run dev` - renderer in browser for fast UI iteration
- `npm run electron:dev` - full Electron app (preferred for any IPC/db work)

Quality gates (required by Verification Gate):
- `npm run type-check`
- `npm run lint`

Build:
- `npm run build` - builds renderer + Electron bundles into `dist-electron/`
- `npm run electron:build` - packages desktop app via electron-builder
- `npm run rebuild` - rebuilds native SQLite module if Electron upgrades break it

---

## 3) Coding Style & Naming Conventions

- TypeScript + React
- 2-space indentation
- Semicolons
- Single quotes (match `src/App.tsx`)
- PascalCase for components/pages (e.g. `ProjectsList.tsx`)
- Feature folders grouped by domain (e.g. `src/pages/Projects/`)
- Prefer shared interfaces in `shared/types.ts` for IPC and data models

---

## 4) Work Method (Codex-specific)

When you start a task:
1. Restate the goal in 1-3 bullets.
2. Identify impacted layer(s):
   - Renderer only (`src/`)
   - Electron main/db (`electron/`)
   - Shared types (`shared/`)
3. Make the smallest coherent change that satisfies the request.
4. Keep diffs tight; do not reformat unrelated code.

---

## 5) UI + Figma Parity Rules

If Figma exists, behavior and screen structure must match:
- Routes must exist if the design implies a page
- Primary actions must exist (can be disabled if not implemented)
- Hiding incomplete UI is allowed temporarily
- Deleting designed UI is not allowed unless explicitly instructed

---

## 6) Data Integrity Rules (Project -> Supplier propagation)

Model intent:
- Activity Library items = templates
- Project Activities = instances
- Supplier Activities = derived instances

Date intent:
- Project dates are the source of truth
- Supplier instances auto-update when project dates change unless explicitly overridden
- Offset-based tasks (e.g. -14 days) must recalculate when anchor dates change

SQLite changes:
- Schema changes require a new migration under `electron/migrations/` (append-only)

---

## 7) Final Response Format (MANDATORY)

### Summary
- What changed + why
- Files changed (paths)

### Verification Performed (WITH EVIDENCE)
- Commands + terminal output (copy/paste)
- Manual verification steps
- Observed results

### Known Limitations / Follow-ups (if any)

Forbidden phrases:
- "should work"
- "untested but"
- "looks correct"
- "I think"
