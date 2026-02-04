# Project Milestone Architecture

## Overview

Project milestones (like PA2, PA3, NMR3) are **project-level entities** that define key dates shared across all activities within a project. This ensures consistency - when you set PA2 to January 15th for the T90W project, that date applies to all activities (Part Approval, MCPC, NMR, etc.) that reference PA2.

## Architecture Principles

### 1. Milestones are Project-Scoped

Milestones are defined at the **project level**, not the activity level:

```
Project: T90W (version 2026-01-15)
├── Milestone: PA2 → 2026-03-15
├── Milestone: PA3 → 2026-05-20
├── Milestone: NMR3 → 2026-06-01
├── Activity: Part Approval
│   └── Schedule Items can reference PA2, PA3
└── Activity: MCPC
    └── Schedule Items can reference PA2, PA3, NMR3
```

**Key point**: PA2 date (2026-03-15) is the same for both Part Approval and MCPC activities. You set it once at the project level, and all activities inherit it.

## Database Schema

### Project Milestones Table

```sql
CREATE TABLE project_milestones (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,           -- Belongs to a project
  name TEXT NOT NULL,                    -- e.g., "PA2", "PA3", "NMR3"
  date TEXT,                             -- YYYY-MM-DD or NULL
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

**Important**: The `project_id` foreign key means milestones belong to the project, not to individual activities.

### Schedule Items Reference Milestones

```sql
CREATE TABLE project_schedule_items (
  id INTEGER PRIMARY KEY,
  project_activity_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  anchor_type TEXT NOT NULL,             -- 'PROJECT_MILESTONE' to reference milestone
  project_milestone_id INTEGER,          -- Points to project_milestones.id
  offset_days INTEGER,                   -- Optional: days before/after milestone
  -- ... other fields
  FOREIGN KEY (project_activity_id) REFERENCES project_activities(id),
  FOREIGN KEY (project_milestone_id) REFERENCES project_milestones(id)
);
```

## How Schedule Items Reference Milestones

Schedule items within activities can anchor their dates to project milestones using the `PROJECT_MILESTONE` anchor type:

### Anchor Types

- **FIXED_DATE**: Hard-coded date (e.g., "2026-03-15")
- **SCHEDULE_ITEM**: Offset from another schedule item's planned date
- **COMPLETION**: Offset from another schedule item's actual completion date
- **PROJECT_MILESTONE**: Offset from a project milestone's date ← **This is the key feature**

### Example: Anchoring to PA2

```typescript
// Schedule item in Part Approval activity
{
  name: "Submit PA2 Documents",
  anchorType: "PROJECT_MILESTONE",
  projectMilestoneId: 5,  // ID of PA2 milestone
  offsetDays: -14,        // 14 days BEFORE PA2
  // Computed date: PA2 date - 14 days
}

// Schedule item in MCPC activity
{
  name: "PA2 Review Meeting",
  anchorType: "PROJECT_MILESTONE",
  projectMilestoneId: 5,  // Same PA2 milestone
  offsetDays: 0,          // Exactly on PA2 date
  // Computed date: PA2 date
}
```

Both schedule items reference the **same project milestone** (ID 5), ensuring consistency.

## Date Calculation Flow

### Step 1: Load Project Detail

When loading a project (e.g., for the Project Detail page), the system:

```typescript
// From electron/handlers.ts:3258
function handleProjectsGetDetail(_event: any, id: number) {
  // 1. Load project milestones
  const milestones = query(
    'SELECT * FROM project_milestones WHERE project_id = ? ORDER BY sort_order',
    [id]
  );

  // 2. Build milestone dates map
  const milestoneDates = new Map<number, string | null>();
  for (const ms of milestones) {
    milestoneDates.set(ms.id, ms.date);  // Map milestone ID → date
  }

  // 3. Load all activities
  const activities = query('SELECT * FROM project_activities WHERE project_id = ?', [id]);

  // 4. For each activity, calculate schedule item dates
  activities.forEach(activity => {
    const scheduleItems = query('SELECT * FROM project_schedule_items WHERE project_activity_id = ?', [activity.id]);

    // Pass the same milestoneDates map to ALL activities
    const itemsWithDates = calculateScheduleDates(scheduleItems, useBusinessDays, undefined, milestoneDates);
  });
}
```

**Key insight**: The `milestoneDates` map is built once at the project level and passed to ALL activities. This ensures every activity sees the same milestone dates.

### Step 2: Calculate Schedule Item Dates

The scheduler calculates dates for each schedule item:

```typescript
// From electron/scheduler.ts:143
case 'PROJECT_MILESTONE':
  if (item.projectMilestoneId === null) {
    return null;  // No milestone specified
  }
  if (!milestoneDates) {
    return null;  // Milestones not provided
  }

  // Look up milestone date from map
  const msDate = milestoneDates.get(item.projectMilestoneId) || null;
  if (!msDate) {
    return null;  // Milestone has no date set
  }

  // Apply offset if specified
  if (item.offsetDays === null) {
    return msDate;  // Exactly on milestone date
  }
  return addDays(msDate, item.offsetDays, useBusinessDays);  // Offset from milestone
```

## Propagation to Suppliers

When a project is applied to a supplier:

1. **Project milestones** are NOT copied to suppliers - they remain at the project level
2. **Supplier schedule item instances** are created with `planned_date` computed from the project's milestones
3. When project milestones change, the propagation engine recalculates supplier dates automatically

### Propagation Example

```
Project: T90W
├── PA2 milestone: 2026-03-15
└── Activity: Part Approval
    └── Schedule Item: "Submit Documents" (PA2 - 14 days)
        → Computed: 2026-03-01

Supplier: ACME Corp (has T90W project applied)
└── Supplier Activity Instance: Part Approval
    └── Supplier Schedule Item Instance: "Submit Documents"
        └── planned_date: 2026-03-01 (computed from PA2)

✓ If PA2 changes to 2026-03-20, propagation updates supplier to 2026-03-06
```

## Setting Milestone Dates

### Where to Set Milestone Dates

Project milestone dates can be set in two places:

1. **Project Detail Page → Milestones Tab** (or Overview side panel):
   - Create milestones with optional initial dates
   - Bulk update milestone dates

2. **Configure Dates Page** (per activity):
   - When configuring schedule items for an activity
   - You can update project milestone dates
   - Changes apply to ALL activities in the project

### Bulk Update Handler

```typescript
// From electron/handlers.ts (project-milestones:bulk-update)
function handleProjectMilestonesBulkUpdate(updates: { id: number; date: string | null }[]) {
  updates.forEach(update => {
    exec('UPDATE project_milestones SET date = ? WHERE id = ?', [update.date, update.id]);
  });

  // After updating milestones, trigger propagation to suppliers
  // All activities that reference these milestones get recalculated
}
```

## TypeScript Interfaces

### ProjectMilestone

```typescript
export interface ProjectMilestone {
  id: number;
  projectId: number;      // Belongs to project
  name: string;           // e.g., "PA2", "PA3", "NMR3"
  date: string | null;    // YYYY-MM-DD or null if not set
  sortOrder: number;
  createdAt: string;
}
```

### ProjectScheduleItem

```typescript
export interface ProjectScheduleItem {
  id: number;
  projectActivityId: number;
  name: string;
  anchorType: AnchorType;           // 'PROJECT_MILESTONE' to reference milestone
  projectMilestoneId: number | null;// ID of the milestone
  offsetDays: number | null;        // Offset from milestone (can be negative)
  // ... other fields
}
```

### ProjectDetail

```typescript
export interface ProjectDetail extends Project {
  milestones: ProjectMilestone[];           // All project milestones
  activities: ProjectActivityDetail[];      // All activities with computed dates
}
```

## User Workflow Example

### Scenario: Creating T90W Project with PA Milestones

1. **Create Project**:
   ```
   Project Name: T90W
   Version: 2026-01-15
   ```

2. **Define Milestones** (Project Detail page):
   ```
   PA2  → Date: (not set yet)
   PA3  → Date: (not set yet)
   PA5  → Date: (not set yet)
   NMR3 → Date: (not set yet)
   ```

3. **Add Activities**:
   - Add "Part Approval" activity from template
   - Add "MCPC" activity from template
   - Add "NMR - B-Rank" activity from template

4. **Configure Schedule Items** (Configure Dates page):
   - Part Approval activity:
     - "PA2 Submission" → Anchor: PA2 - 14 days
     - "PA2 Approval" → Anchor: PA2 + 0 days
     - "PA3 Submission" → Anchor: PA3 - 7 days

   - MCPC activity:
     - "MCPC Kickoff" → Anchor: PA2 + 7 days
     - "PA3 Review" → Anchor: PA3 + 0 days

5. **Set Milestone Dates**:
   ```
   PA2  → 2026-03-15
   PA3  → 2026-05-20
   PA5  → 2026-08-10
   NMR3 → 2026-06-01
   ```

6. **Computed Dates** (automatic):
   - Part Approval:
     - "PA2 Submission" → 2026-03-01 (PA2 - 14 days)
     - "PA2 Approval" → 2026-03-15 (PA2 + 0 days)
     - "PA3 Submission" → 2026-05-13 (PA3 - 7 days)

   - MCPC:
     - "MCPC Kickoff" → 2026-03-22 (PA2 + 7 days)
     - "PA3 Review" → 2026-05-20 (PA3 + 0 days)

7. **Apply to Supplier**:
   - When T90W is applied to ACME Corp supplier:
   - All computed dates propagate to supplier instances
   - PA2 (2026-03-15) drives dates across both Part Approval and MCPC activities

### Key Benefit

If PA2 date changes from 2026-03-15 to 2026-03-20:
- Update happens once at project level
- All schedule items anchored to PA2 recalculate automatically
- Propagation to all suppliers happens in one operation
- **Consistency guaranteed**: PA2 is the same across all activities

## Activity Templates and Milestones

Activity templates can pre-configure schedule items to reference project milestones:

```typescript
// In activity_template_schedule_items table
{
  activityTemplateId: 1,  // Part Approval template
  name: "PA2 Document Submission",
  anchorType: "PROJECT_MILESTONE",
  projectMilestoneName: "PA2",  // Template specifies milestone NAME
  offsetDays: -14
}
```

When this template is added to a project:
1. System looks up milestone named "PA2" in the project
2. If found, links the schedule item to that milestone's ID
3. If not found, the anchor remains unlinked (date cannot be computed)

## Edge Cases and Behavior

### Milestone Not Set

If a milestone has no date (`date = NULL`):
- Schedule items anchored to it show `plannedDate: null`
- Error message: "Cannot compute date - milestone not set"

### Milestone Deleted

If a milestone is deleted:
- `project_milestone_id` is set to NULL (ON DELETE SET NULL)
- Schedule items lose their anchor
- Dates cannot be computed until re-anchored

### Circular Dependencies

Milestones cannot have circular dependencies because:
- Milestones have fixed dates (or NULL)
- Schedule items reference milestones, never the reverse
- No way to create a cycle

### Supplier Overrides

Suppliers can override dates even when anchored to milestones:
- `planned_date_override = true` flag prevents propagation
- Manual date takes precedence over computed date

## Summary

**Project milestones provide a single source of truth for key dates**:

- ✅ Set once at project level
- ✅ Referenced by all activities in the project
- ✅ Automatically propagate to suppliers
- ✅ Change once, update everywhere
- ✅ Ensure consistency across activities (PA2 is PA2, everywhere)

This design eliminates the need to set PA2 separately in Part Approval, MCPC, NMR, etc. Set it once for the project, and all activities that reference it stay synchronized.
