# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + Vite renderer (pages, components, styles).
- `electron/` holds the Electron main process, preload, IPC handlers, and database logic.
- `shared/` contains cross-process TypeScript types shared by renderer and main.
- `electron/migrations/` stores SQLite schema migrations.
- `dist-electron/` is build output for the Electron bundle.
- Root configs include `vite.config.ts`, `tsconfig*.json`, and `tailwind.config.js`.

## Build, Test, and Development Commands
- `npm run dev` starts the Vite renderer in the browser for fast UI iteration.
- `npm run electron:dev` runs the full Electron app with hot reload (Vite + Electron).
- `npm run build` builds the renderer and Electron bundles into `dist-electron/`.
- `npm run electron:build` packages the desktop app via `electron-builder`.
- `npm run type-check` runs TypeScript type checks for renderer and Electron.
- `npm run lint` runs ESLint on `src/` and `electron/`.
- `npm run rebuild` rebuilds the native SQLite module if Electron upgrades break it.

## Coding Style & Naming Conventions
- TypeScript + React with 2-space indentation, semicolons, and single quotes (see `src/App.tsx`).
- Components and pages use PascalCase (for example, `ProjectsList.tsx`).
- Feature folders are grouped by domain (for example, `src/pages/Projects/`).
- Prefer shared interfaces in `shared/types.ts` for IPC and data models.

## Testing Guidelines
- No automated test framework is configured yet (no test scripts or dependencies found).
- If adding tests, use `*.test.ts` or `*.test.tsx` next to the code or under `src/__tests__/` and wire a script in `package.json`.

## Commit & Pull Request Guidelines
- No Git history is present in this workspace, so commit conventions are not defined.
- If adopting a standard, use Conventional Commits (for example, `feat: add supplier filter`).
- PRs should include a short summary, testing notes, and screenshots for UI changes.

## Configuration Tips
- Environment-specific settings should live in `.env` files loaded by Vite (keep secrets out of Git).
- Database schema changes should be added as new files under `electron/migrations/`.
