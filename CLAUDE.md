# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Supplier Quality Tracking System (SQTS) - an Electron desktop application for tracking supplier progress against projects and activities. Single-user, offline-first with local SQLite database.

## Commands

```bash
npm run dev              # Start development (Vite + Electron with hot reload)
npm run build            # Build all: tsc + vite build + electron TS compilation
npm run type-check       # Type check both React and Electron TypeScript
npm run lint             # ESLint on src/ and electron/
npm run verify           # Run type-check + lint
npm run electron:build   # Full build + electron-builder for installers
npm run rebuild          # Rebuild native modules (if sql.js issues)
```

## Architecture

### Process Separation

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                        │
│  electron/main.ts      - App lifecycle, window management       │
│  electron/handlers.ts  - IPC handlers (~50 handlers)            │
│  electron/database.ts  - SQLite via sql.js (WASM)               │
│  electron/scheduler.ts - Date calculation engine                 │
│  electron/engine/propagation.ts - Schedule propagation          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ IPC (contextBridge)
┌─────────────────────┴───────────────────────────────────────────┐
│  electron/preload.ts - Exposes window.sqts API                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                   React Renderer Process                         │
│  src/App.tsx         - Routes                                    │
│  src/pages/          - Feature pages (Dashboard, Suppliers, etc) │
│  src/components/     - Reusable UI (Radix UI + Tailwind)        │
│  shared/types.ts     - Shared TypeScript interfaces             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

- **shared/types.ts** - All TypeScript interfaces shared between main/renderer (635 lines)
- **electron/handlers.ts** - All IPC handlers with database operations (~3400 lines)
- **electron/scheduler.ts** - Computes dates from anchor rules and offsets
- **electron/engine/propagation.ts** - Propagates project changes to supplier instances

### Database

- **Engine**: sql.js (SQLite compiled to WASM)
- **Location**: User data directory (`app.getPath('userData')`)
- **Migrations**: `electron/migrations/` - numbered SQL files run on startup

### IPC Pattern

Renderer calls `window.sqts.entity.method()` → preload invokes `ipcRenderer.invoke()` → main handler processes and returns `APIResponse<T>`:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Critical Patterns

### snake_case to camelCase Conversion

Database uses snake_case columns; TypeScript uses camelCase. All handlers must explicitly map fields:

```typescript
// In handlers.ts
const supplier = {
  id: row.id,
  name: row.name,
  supplierId: row.supplier_id,  // Explicit mapping required
  createdAt: row.created_at
};
```

Use `toCamelCase()` helper from database.ts or write explicit mappings.

### Date Format

All dates are stored and transmitted as **YYYY-MM-DD strings**. Use `date-fns` for arithmetic.

### Schedule Item Anchoring

Schedule items support three anchor types:
- `FIXED_DATE` - Hard-coded date
- `SCHEDULE_ITEM` - Offset from another item's planned date
- `COMPLETION` - Offset from another item's actual completion

### Propagation Policy

When project schedule items change, supplier instances update **unless**:
- Instance has `plannedDateOverride = true`
- Instance is `locked = true`
- Instance status is `Complete` (configurable in settings)

## TypeScript Configuration

Two separate configs:
- **tsconfig.json** - React renderer (ES2020, strict)
- **tsconfig.electron.json** - Main process (ES2022, outputs to dist-electron/)

Path aliases:
- `@/*` → `./src/*`
- `@shared/*` → `./shared/*`

## Entity Hierarchy

```
Supplier
  └── SupplierProject (project applied to supplier)
        ├── SupplierActivityInstance (per activity)
        │     └── SupplierScheduleItemInstance (milestones/tasks with dates)
        └── Part (unique part numbers with PA ranking)

Project (template)
  └── ProjectActivity (activity in project)
        └── ProjectScheduleItem (milestone/task definitions)

ActivityTemplate (global library)
  └── ActivityTemplateScheduleItem (default structure)
```

## Applicability Rules

Activities can be conditionally included based on:
- **Supplier NMR ranking** (New Model Review)
- **Part PA ranking** (Part Approval)
- Rules use operators: ALL, ANY with comparators: IN, NOT_IN, EQ, NEQ, GTE, LTE
