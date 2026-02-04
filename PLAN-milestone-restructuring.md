# Implementation Plan: Project Milestone Restructuring

## TODO Being Addressed

> "Need to restructure projects so that dates can be assigned to milestones like PA2 or NMR3 and then activities are linked to those dates."

## Problem Statement

Currently, milestones (schedule items with `kind = 'MILESTONE'`) live **inside individual activities**. Each activity has its own set of milestones with independently set `FIXED_DATE` values. This creates several problems:

1. **Redundancy**: If three activities all relate to "PA2", the PA2 date must be entered separately in each activity.
2. **No project-level milestone concept**: There's no way to say "PA2 is June 15th" once and have all linked activities derive from it.
3. **Inconsistency risk**: The same milestone (PA2) can have different dates across activities if entered incorrectly.
4. **Poor UX**: Users must navigate into each activity individually to set milestone dates instead of managing them in one place.

## Desired End State

- Projects have a set of **project-level milestones** (e.g., PA2, PA3, PA4, PA5, NMR3) with dates assigned at the project level.
- Activity schedule items **reference** these project milestones instead of having their own FIXED_DATE milestones.
- Changing a project milestone date automatically flows to all linked activity schedule items and then to supplier instances via propagation.
- The UI allows editing all project milestone dates in one place.

## Current Architecture (Relevant)

```
Project
  └── ProjectActivity (links to ActivityTemplate)
        └── ProjectScheduleItem
              ├── kind: MILESTONE | TASK
              ├── anchorType: FIXED_DATE | SCHEDULE_ITEM | COMPLETION
              ├── fixedDate (for FIXED_DATE anchors)
              ├── anchorRefId (for SCHEDULE_ITEM/COMPLETION - references another PSI within same activity)
              └── offsetDays
```

**Key constraint**: `anchorRefId` currently references another `project_schedule_items.id` **within the same activity**. Cross-activity references are not supported.

## Proposed Architecture

```
Project
  ├── ProjectMilestone (NEW - project-level: PA2, PA3, NMR3, etc.)
  │     ├── name: "PA2"
  │     ├── date: "2026-06-15"
  │     └── sortOrder: 1
  │
  └── ProjectActivity (links to ActivityTemplate)
        └── ProjectScheduleItem
              ├── kind: MILESTONE | TASK
              ├── anchorType: FIXED_DATE | SCHEDULE_ITEM | COMPLETION | PROJECT_MILESTONE (NEW)
              ├── projectMilestoneId (NEW - references ProjectMilestone for PROJECT_MILESTONE type)
              ├── fixedDate (for FIXED_DATE anchors, still supported)
              ├── anchorRefId (for SCHEDULE_ITEM/COMPLETION)
              └── offsetDays (works with all anchor types)
```

---

## Implementation Steps

### Phase 1: Database Schema Changes

**New migration file**: `electron/migrations/014_project_milestones.sql`

#### 1a. Create `project_milestones` table

```sql
CREATE TABLE project_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  date TEXT,                    -- YYYY-MM-DD, nullable (date not yet assigned)
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_milestones_project ON project_milestones(project_id);
```

#### 1b. Add `PROJECT_MILESTONE` anchor type and `project_milestone_id` column

Rebuild `project_schedule_items` to:
- Add `project_milestone_id INTEGER` column (FK to `project_milestones.id`)
- Expand `anchor_type` CHECK to include `'PROJECT_MILESTONE'`

Rebuild `activity_template_schedule_items` to:
- Add `project_milestone_name TEXT` column (stores the milestone name like "PA2" so templates know which milestone to link to when applied to a project)
- Expand `anchor_type` CHECK to include `'PROJECT_MILESTONE'`

#### 1c. Data migration strategy

Existing data continues to work because:
- All existing items use `FIXED_DATE`, `SCHEDULE_ITEM`, or `COMPLETION` which remain valid.
- No existing data uses `PROJECT_MILESTONE` yet.
- Users can gradually migrate activities to use project milestones.

**Files to modify:**
- `electron/migrations/014_project_milestones.sql` (new)
- `electron/database.ts` (migration runner picks up new file automatically)

---

### Phase 2: Shared Type Definitions

**File**: `shared/types.ts`

#### 2a. New interfaces

```typescript
export interface ProjectMilestone {
  id: number;
  projectId: number;
  name: string;
  date: string | null;
  sortOrder: number;
  createdAt: string;
}
```

#### 2b. Update AnchorType

```typescript
export type AnchorType =
  | 'FIXED_DATE'
  | 'SCHEDULE_ITEM'
  | 'COMPLETION'
  | 'PROJECT_MILESTONE';  // NEW
```

#### 2c. Update ProjectScheduleItem

Add `projectMilestoneId: number | null` field.

#### 2d. Update ActivityTemplateScheduleItem

Add `projectMilestoneName: string | null` field (template stores the milestone name, not ID, since templates are project-agnostic).

#### 2e. New param interfaces

```typescript
export interface CreateProjectMilestoneParams {
  projectId: number;
  name: string;
  date?: string;
  sortOrder?: number;
}

export interface UpdateProjectMilestoneParams {
  id: number;
  name?: string;
  date?: string | null;
  sortOrder?: number;
}
```

#### 2f. Update CreateScheduleItemParams / UpdateScheduleItemParams

Add `projectMilestoneId?: number` field.

#### 2g. Update ProjectDetail

Add `milestones: ProjectMilestone[]` to `ProjectDetail` interface.

#### 2h. Update export/import types

Add `ExportedProjectMilestone` and include in `ExportedProject`.

**Files to modify:**
- `shared/types.ts`

---

### Phase 3: IPC Handlers (Backend)

**File**: `electron/handlers.ts`

#### 3a. CRUD handlers for project milestones

New IPC channels:
- `project-milestones:list` — List milestones for a project
- `project-milestones:create` — Create a new milestone
- `project-milestones:update` — Update milestone name/date/sort
- `project-milestones:delete` — Delete a milestone (with validation that no schedule items reference it)
- `project-milestones:bulkUpdate` — Update multiple milestone dates at once (for the tabular input UI from TODO #2)

#### 3b. Update schedule item handlers

- `schedule-items:create` — Support `anchorType: 'PROJECT_MILESTONE'` with `projectMilestoneId`
- `schedule-items:update` — Support changing to/from `PROJECT_MILESTONE` anchor
- Validation: When `anchorType === 'PROJECT_MILESTONE'`, require `projectMilestoneId` and ensure it belongs to the same project

#### 3c. Update project detail handler

- `projects:getDetail` — Include `milestones` array in the response

#### 3d. Update sync-from-template logic

- When syncing from template, if template schedule item has `projectMilestoneName`, look up the matching `project_milestones.name` for the current project and set `projectMilestoneId`
- If no matching project milestone exists, either create it automatically or fall back to `FIXED_DATE`

#### 3e. Update propagation queries

- When collecting schedule items for recalculation, also fetch project milestone dates
- Pass milestone dates to the scheduler

**Files to modify:**
- `electron/handlers.ts`

---

### Phase 4: Scheduler Engine

**File**: `electron/scheduler.ts`

#### 4a. Extend `calculateScheduleDates`

Add a new parameter: `milestoneDates: Map<number, string | null>` (milestone ID -> date).

For items with `anchorType === 'PROJECT_MILESTONE'`:
1. Look up the date from `milestoneDates` using `projectMilestoneId`
2. If date exists and `offsetDays` is set, apply the offset
3. If date doesn't exist, return `null` (unresolved)

```typescript
export function calculateScheduleDates(
  scheduleItems: ProjectScheduleItem[],
  useBusinessDays: boolean = false,
  actualDates?: Map<number, string | null>,
  milestoneDates?: Map<number, string | null>  // NEW
): ScheduleItemWithDates[]
```

#### 4b. Update `calculatePlannedDate`

Add new case:

```typescript
case 'PROJECT_MILESTONE':
  if (item.projectMilestoneId === null) return null;
  if (!milestoneDates) return null;
  const msDate = milestoneDates.get(item.projectMilestoneId) || null;
  if (!msDate) return null;
  if (item.offsetDays === null) return msDate;
  return addDays(msDate, item.offsetDays, useBusinessDays);
```

#### 4c. Update `validateScheduleItems`

No circular dependency concern for `PROJECT_MILESTONE` since milestones are external anchors (like `FIXED_DATE`). Skip them in cycle detection.

**Files to modify:**
- `electron/scheduler.ts`

---

### Phase 5: Propagation Engine

**File**: `electron/engine/propagation.ts`

#### 5a. Update `previewPropagation`

When fetching project schedule items for recalculation:
1. Also query `project_milestones` for the project
2. Build `milestoneDates` map
3. Pass to `calculateScheduleDates`

#### 5b. No changes to propagation policy

`PROJECT_MILESTONE`-anchored items propagate the same way as `FIXED_DATE` items. The skip rules (locked, overridden, complete) still apply at the supplier instance level.

**Files to modify:**
- `electron/engine/propagation.ts`

---

### Phase 6: Preload / IPC Bridge

**File**: `electron/preload.ts`

#### 6a. Expose new project milestone methods

```typescript
projectMilestones: {
  list: (projectId: number) => ipcRenderer.invoke('project-milestones:list', projectId),
  create: (params: CreateProjectMilestoneParams) => ipcRenderer.invoke('project-milestones:create', params),
  update: (params: UpdateProjectMilestoneParams) => ipcRenderer.invoke('project-milestones:update', params),
  delete: (id: number) => ipcRenderer.invoke('project-milestones:delete', id),
  bulkUpdate: (milestones: UpdateProjectMilestoneParams[]) => ipcRenderer.invoke('project-milestones:bulkUpdate', milestones),
},
```

**Files to modify:**
- `electron/preload.ts`

---

### Phase 7: UI - Project Milestone Management

#### 7a. Project Detail page updates

**File**: `src/pages/Projects/ProjectDetail.tsx`

- Add a "Milestones" section showing all project milestones and their dates
- Add "Add Milestone" button with a dialog to create new milestones
- Show milestone count in project overview
- Each milestone row shows: name, date (editable inline or via dialog), delete button

#### 7b. Milestone management on ProjectConfigureDates

**File**: `src/pages/Projects/ProjectConfigureDates.tsx`

This is the biggest UI change. Currently this page:
- Shows one activity at a time
- Lets you set FIXED_DATE milestones per activity
- Shows calculated task dates

**New behavior:**
- Add a top section showing **Project Milestones** with date inputs (PA2, PA3, NMR3, etc.)
- Below that, show the activity-level schedule with items referencing project milestones
- For `PROJECT_MILESTONE`-anchored items, show the derived date (milestone date + offset) as read-only
- For `FIXED_DATE`-anchored items (legacy), keep existing behavior
- Preview and propagation work across all activities using the project milestones

#### 7c. Update ScheduleItemDialog

**File**: `src/pages/Projects/ScheduleItemDialog.tsx`

When creating/editing a schedule item:
- Add `PROJECT_MILESTONE` as an anchor type option
- When selected, show a dropdown of available project milestones (fetched for the current project)
- Allow setting an offset from the milestone date

#### 7d. Update EditProjectScheduleItemDialog

**File**: `src/components/projects/EditProjectScheduleItemDialog.tsx`

- Support editing items with `PROJECT_MILESTONE` anchor type
- Show current milestone reference and allow changing it

#### 7e. Supplier project detail updates

**File**: `src/pages/SupplierProjects/SupplierProjectDetail.tsx`

- Show which project milestone each item is linked to (informational)
- No functional changes needed — dates are already propagated to instances

**Files to modify:**
- `src/pages/Projects/ProjectDetail.tsx`
- `src/pages/Projects/ProjectConfigureDates.tsx`
- `src/pages/Projects/ScheduleItemDialog.tsx`
- `src/components/projects/EditProjectScheduleItemDialog.tsx`
- `src/pages/SupplierProjects/SupplierProjectDetail.tsx`

---

### Phase 8: Template Integration

#### 8a. Activity template schedule items

**File**: `src/pages/ActivityLibrary/ActivityLibraryPage.tsx` (and related components)

When defining schedule items in templates:
- Allow setting `anchorType: 'PROJECT_MILESTONE'` with a `projectMilestoneName` (text field, e.g., "PA2")
- This name is matched against actual project milestones when the template is applied to a project

#### 8b. Template sync logic

**File**: `electron/handlers.ts` (sync handler)

When syncing from template to project:
- For template items with `PROJECT_MILESTONE` anchor type:
  1. Look up `project_milestones` by name in the target project
  2. If found, set `projectMilestoneId` on the project schedule item
  3. If not found, create the project milestone automatically (with no date yet) or warn the user

**Files to modify:**
- `src/pages/ActivityLibrary/` (template schedule item UI)
- `electron/handlers.ts` (sync logic)

---

### Phase 9: Import/Export Updates

**File**: `electron/handlers.ts` (import/export handlers)

#### 9a. Export

- Include `project_milestones` in project export
- For schedule items with `PROJECT_MILESTONE` anchor, export the milestone name (not ID)

#### 9b. Import

- Re-create project milestones during import
- Re-link schedule items to milestones by name matching

**Files to modify:**
- `electron/handlers.ts`
- `shared/types.ts` (export types already addressed in Phase 2)

---

## Migration Path for Existing Data

This is a **non-breaking, additive change**:

1. Existing schedule items with `FIXED_DATE` milestones continue to work unchanged.
2. Users can optionally create project milestones and re-point existing schedule items from `FIXED_DATE` to `PROJECT_MILESTONE`.
3. No data migration of existing items is required — the old anchor types remain valid.
4. Over time, users will naturally adopt project milestones for new projects.

**Optional helper**: A UI action "Convert to Project Milestones" that:
- Scans all `FIXED_DATE` milestones across activities
- Groups by name (e.g., "PA2" appears in 3 activities)
- Creates a project milestone for each unique name
- Re-points the schedule items to the new project milestone

---

## Risks and Considerations

1. **Cross-activity anchoring**: Currently `anchorRefId` only references items within the same activity. Project milestones are a clean separate mechanism (different column: `projectMilestoneId`) that avoids this constraint entirely.

2. **Template portability**: Templates use milestone **names** (not IDs), so they remain project-agnostic. When applied to a project, the system matches by name.

3. **Backward compatibility**: All existing anchor types remain valid. No breaking changes to existing data or workflows.

4. **Performance**: Project milestones are a small table (typically 5-10 rows per project). No performance concerns.

5. **Propagation**: The existing propagation engine already handles date recalculation well. Adding milestone dates as an input source is a minimal change.

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `electron/migrations/014_project_milestones.sql` | New | Schema for project_milestones table + alter schedule items |
| `shared/types.ts` | Modify | New interfaces, updated AnchorType, updated params |
| `electron/handlers.ts` | Modify | New CRUD handlers, updated schedule item logic, sync logic |
| `electron/scheduler.ts` | Modify | Support PROJECT_MILESTONE in date calculation |
| `electron/engine/propagation.ts` | Modify | Pass milestone dates to scheduler |
| `electron/preload.ts` | Modify | Expose new IPC methods |
| `src/pages/Projects/ProjectDetail.tsx` | Modify | Show/manage project milestones |
| `src/pages/Projects/ProjectConfigureDates.tsx` | Modify | Project-level milestone date inputs |
| `src/pages/Projects/ScheduleItemDialog.tsx` | Modify | PROJECT_MILESTONE anchor option |
| `src/components/projects/EditProjectScheduleItemDialog.tsx` | Modify | Edit PROJECT_MILESTONE items |
| `src/pages/SupplierProjects/SupplierProjectDetail.tsx` | Modify | Show milestone linkage info |
| `src/pages/ActivityLibrary/` | Modify | Template milestone name field |

---

## Suggested Implementation Order

1. **Phase 1** (Database) + **Phase 2** (Types) — Foundation, no runtime impact
2. **Phase 3** (Handlers) + **Phase 4** (Scheduler) + **Phase 5** (Propagation) — Backend complete
3. **Phase 6** (Preload) — IPC bridge
4. **Phase 7** (UI) — User-facing changes
5. **Phase 8** (Templates) — Template integration
6. **Phase 9** (Import/Export) — Data portability

Each phase can be verified independently before proceeding to the next.
