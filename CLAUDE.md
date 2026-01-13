# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Supplier Quality Tracking System (SQTS) - An Electron-based desktop application for tracking supplier quality activities, milestones, and schedule items with complex scheduling, propagation rules, and conditional task assignment.

## Architecture

### Technology Stack
- **Framework**: Electron + React 18 + TypeScript + Vite
- **Database**: sql.js (pure JavaScript SQLite implementation)
- **UI**: Tailwind CSS + shadcn/ui (Radix UI components)
- **Date Handling**: date-fns library
- **Icons**: lucide-react

### Directory Structure
```
supplier-tracking/
├── electron/              # Main process (Node.js)
│   ├── main.ts           # Entry point, window management
│   ├── preload.ts        # Context bridge for IPC
│   ├── database.ts       # SQLite initialization & queries
│   ├── handlers.ts       # IPC handlers for CRUD + business logic
│   ├── scheduler.ts      # Date calculation engine
│   ├── engine/           # Business logic modules
│   │   └── propagation.ts  # Change propagation with override rules
│   └── migrations/       # Database schema migrations
├── src/                  # Renderer process (React)
│   ├── main.tsx          # React entry point
│   ├── App.tsx           # Root component with routing
│   ├── components/ui/    # shadcn/ui components
│   └── pages/            # Main page components
└── shared/               # Code shared between main and renderer
    └── types.ts          # Common type definitions
```

### Process Communication
- **Main Process** (Node.js/CommonJS): Runs migrations on startup, handles database operations
- **Renderer Process** (React 18 + TypeScript + Vite): UI layer
- **IPC**: Electron contextBridge (`window.sqts` API) for secure main-to-renderer communication

### Database Architecture
- **SQLite** with synchronous API via sql.js
- **Location**: User data directory (`app.getPath('userData')`)
- **Migrations**: Auto-run on startup from `electron/migrations/`
- **Date Format**: All dates stored and transmitted as `YYYY-MM-DD` strings

### Key Architectural Patterns

#### 1. Template Snapshotting
Template data is copied to instance tables at creation time. This allows template changes without affecting existing activities. For example, when applying a project to a supplier, all project schedule items are copied to supplier schedule item instances.

#### 2. Wave-Based Date Calculation
The scheduler (`electron/scheduler.ts`) uses a wave-based algorithm to resolve schedule item dates:
1. Wave 1: FIXED_DATE items (use `fixed_date` directly)
2. Wave 2+: Items whose anchor references are now resolved
3. Circular dependency detection: if no progress made but items remain, there's a cycle

Reference offsets work like: "Submit Task = Milestone 2 Due - 14 days"

#### 3. Propagation Engine
When project schedule items are updated, changes propagate to supplier instances via `electron/engine/propagation.ts`:
- **Preview Mode**: Shows what will/won't change before applying
- **Protection Rules**: Skips instances that are locked, overridden, or complete
- **Audit Logging**: Records all propagation events to `audit_events` table

#### 4. snake_case ↔ camelCase Conversion
- **Database**: Uses snake_case (e.g., `supplier_id`, `planned_date`)
- **TypeScript**: Uses camelCase (e.g., `supplierId`, `plannedDate`)
- **Pattern**: All IPC handlers must explicitly map database fields using `toCamelCase()` helper from `database.ts`
- **Critical**: When accessing raw database results before conversion, use snake_case field names

## Development Commands

```bash
# Start development server (launches Electron app with hot reload)
npm run dev

# Compile Electron TypeScript (main process)
npx tsc -p tsconfig.electron.json

# Type checking (both renderer and main process)
npm run type-check

# Lint code
npm run lint

# Build for production
npm run build

# Package app for distribution
npm run electron:build
```

## Recent Architectural Changes

### Phase 4 Implementation (2026-01-13)
Implemented propagation engine + override/lock controls:
- `electron/engine/propagation.ts`: Core propagation logic
- `PropagationPreviewModal.tsx`: Preview UI showing what will/won't change
- Override/lock controls in `SupplierProjectDetail.tsx`
- Audit logging for all propagation events

### Migration History
- **Migration 003**: Added `activity_template_schedule_items` table for reusable task definitions
- **Migration 002**: Added `project_anchor_date` to projects table
- **Migration 001**: Initial schema (suppliers, projects, activities, schedule items, instances, parts, audit)

## Data Model Key Concepts

### Project Structure Hierarchy
```
Project
  └─ Project Activity (references Activity Template)
      └─ Project Schedule Item (MILESTONE or TASK)
          - anchor_type: FIXED_DATE | PROJECT_ANCHOR | SCHEDULE_ITEM | etc.
          - offset_days: Offset from anchor reference
          - fixed_date: YYYY-MM-DD (if FIXED_DATE anchor)
```

### Supplier Instance Hierarchy
```
Supplier Project (project applied to supplier)
  └─ Supplier Activity Instance
      └─ Supplier Schedule Item Instance
          - planned_date: Calculated from project schedule
          - actual_date: User-set completion date
          - status: 'Not Started' | 'In Progress' | 'Blocked' | 'Complete' | 'Not Required'
          - locked: boolean (prevents propagation)
          - planned_date_override: boolean (prevents propagation)
```

### Anchor Types
- **FIXED_DATE**: Absolute date (e.g., "2026-02-01")
- **PROJECT_ANCHOR**: Offset from project anchor date
- **SUPPLIER_ANCHOR**: Offset from supplier anchor date
- **SCHEDULE_ITEM**: Offset from another schedule item (enables chains like "Submit = Milestone - 14 days")
- **COMPLETION**: (Future) Offset from completion of another item

## Critical Implementation Details

### Adding New IPC Handlers
1. Define handler function in `electron/handlers.ts`
2. Register handler in `registerHandlers()` with `ipcMain.handle()`
3. Add method to `electron/preload.ts` contextBridge exposure
4. Add TypeScript interface to `SQTSAPI` in `preload.ts`
5. Use handler in React components via `window.sqts.*`

### Working with Schedule Items
- Always use `calculateScheduleDates()` from `scheduler.ts` to compute planned dates
- Validate for circular dependencies using `validateScheduleItems()` before persisting
- When updating project schedule items, consider propagation impact on supplier instances

### Propagation Workflow
1. User updates project schedule item date
2. Click "Propagate Changes" button in `ProjectDetail.tsx`
3. `PropagationPreviewModal` loads via `window.sqts.projects.previewPropagation()`
4. Preview shows "Will Update" vs "Protected" instances
5. User clicks "Apply" → calls `window.sqts.projects.propagateChanges()`
6. Backend recalculates dates, respects locks/overrides, updates instances, logs audit event

### TypeScript Configuration
- **Renderer**: `tsconfig.json` (ESNext, React JSX)
- **Main Process**: `tsconfig.electron.json` (ESNext, NodeNext module)
- **Path Aliases**: `@/` → `src/`, `@shared/` → `shared/`

## Common Gotchas

### snake_case Field Access Error
**Symptom**: "Property 'anchor_type' does not exist on type 'ActivityTemplateScheduleItem'. Did you mean 'anchorType'?"

**Cause**: Trying to access snake_case database fields after `toCamelCase()` conversion.

**Fix**: Use raw database results before conversion:
```typescript
// WRONG
const items = query<ActivityTemplateScheduleItem>('SELECT * FROM ...');
items.forEach((item) => {
  run(INSERT, [item.anchor_type]); // ERROR
});

// CORRECT
const itemsRaw = query('SELECT * FROM ...');
itemsRaw.forEach((itemRaw: any) => {
  run(INSERT, [itemRaw.anchor_type]); // OK
});
```

### null vs undefined in Date Parameters
**Symptom**: "Type 'string | null' is not assignable to parameter of type 'string | undefined'"

**Fix**: Convert null to undefined using `|| undefined`:
```typescript
calculateScheduleDates(items, projectAnchorDate || undefined)
```

### Missing Date Recalculation
When modifying project schedule items, always recalculate dependent dates. Use the scheduler engine's wave-based algorithm to handle chains of dependencies.

## Database Location
- **Development**: `C:\Users\{username}\AppData\Roaming\supplier-tracking\supplier-tracking.db`
- **Access**: `app.getPath('userData')` in Electron main process
- **WASM**: sql.js requires `sql-wasm.wasm` file from `node_modules/sql.js/dist/`

## Always Update This File
After significant architectural changes, migrations, or pattern changes, update this CLAUDE.md file to reflect the current state of the codebase.
