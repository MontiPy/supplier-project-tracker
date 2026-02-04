# Mass Activity Management Feature - Complete Documentation

## Overview

This feature enables bulk operations for applying activity templates across projects and automatic synchronization when templates change. It includes auto-propagation to suppliers with configurable settings.

---

## Features Implemented

### 1. Mass Apply Operations

#### Apply to Multiple Projects
- **Location**: Activity Library → Select template → "Apply to Projects..." button
- **Function**: Select multiple projects and apply the activity to all at once
- **Smart Filtering**: Automatically skips projects that already have the activity
- **Supplier Sync**: Creates supplier instances for all affected projects

#### Apply to All Projects
- **Location**: Activity Library → Select template → "Apply to All Projects" button
- **Function**: One-click application to every project in the system
- **Confirmation**: Shows confirmation dialog before executing
- **Results**: Displays count of created/skipped projects
- **Dual Purpose**: Also acts as "sync to suppliers" for existing activities

### 2. Auto-Propagation System

#### Template → Projects Auto-Sync
- **Setting**: Settings → Auto-Propagation → "Auto-Sync Template Changes"
- **Behavior**: When you add/remove schedule items from a template, all projects using that template automatically update
- **Version Tracking**: Increments template version number on each change
- **Safe Updates**: Only adds/removes items, preserves existing project dates and overrides

#### Projects → Suppliers Auto-Propagation
- **Setting**: Settings → Auto-Propagation → "Auto-Propagate to Suppliers"
- **Dependency**: Only works when Template Auto-Sync is enabled
- **Behavior**: After syncing projects, automatically propagates changes to supplier instances
- **Respects Policy**: Follows existing propagation policy (skip locked/overridden/complete)

### 3. Sync Status Indicators

#### Visual Badges
- **Green**: "All X projects in sync" - No action needed
- **Amber**: "Y of X projects out of sync" - Template changed, projects need updating
- **Gray**: "Not used in any projects" - Template not yet applied

#### Real-time Updates
- Badge updates after applying to projects
- Badge updates after auto-sync completes
- Shows accurate count of in-sync vs out-of-sync projects

### 4. Applicability Rules Integration

#### Automatic Evaluation
- When activities are applied to projects, supplier instances are created based on applicability rules
- Rules evaluate: Supplier NMR rank, Part PA rank
- Manual overrides (REQUIRED/NOT_REQUIRED) are respected

#### Re-evaluation on Apply
- "Apply to All Projects" re-evaluates applicability for all suppliers
- Creates missing instances for suppliers that now match rules
- Updates status for suppliers that no longer match

---

## Database Schema Changes

### Migration: `013_activity_template_versions.sql`

**New Table: `activity_template_versions`**
```sql
CREATE TABLE activity_template_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_template_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id) ON DELETE CASCADE
);
```

**Modified Table: `project_activities`**
```sql
ALTER TABLE project_activities ADD COLUMN template_version INTEGER DEFAULT 1;
```

**New Settings:**
```sql
INSERT INTO settings (key, value) VALUES
  ('auto_propagate_template_changes', 'false'),
  ('auto_propagate_to_suppliers', 'false');
```

---

## Backend Implementation

### New IPC Handlers

#### `handleProjectActivitiesBatchCreate`
**Route**: `project-activities:batch-create`
**Parameters**:
```typescript
{
  projectIds: number[];
  activityTemplateIds: number[];
  autoSync?: boolean;
}
```
**Returns**: `{ created: number, skipped: number, errors: string[] }`
**Purpose**: Apply multiple activities to multiple projects in one operation

#### `handleActivityTemplateApplyToAllProjects`
**Route**: `activity-templates:apply-to-all-projects`
**Parameters**:
```typescript
{
  activityTemplateId: number;
  autoSync?: boolean;
}
```
**Returns**: `{ created: number, skipped: number, projectNames: string[], errors: string[] }`
**Purpose**: Apply one activity to all projects

#### `handleActivityTemplateGetSyncStatus`
**Route**: `activity-templates:get-sync-status`
**Parameters**: `activityTemplateId: number`
**Returns**:
```typescript
{
  templateVersion: number;
  projects: Array<{
    projectId: number;
    projectName: string;
    projectActivityId: number;
    appliedVersion: number;
    isOutOfSync: boolean;
    templateItemCount: number;
    projectItemCount: number;
  }>;
}
```
**Purpose**: Check which projects are out of sync with the template

### Helper Functions

#### `bumpTemplateVersion(activityTemplateId: number)`
- Increments the template version number
- Checks if auto-propagation is enabled
- Triggers `autoSyncProjectsForTemplate` if enabled
- Logs all actions for debugging

#### `autoSyncProjectsForTemplate(activityTemplateId: number)`
- Finds all projects using the template
- Syncs schedule items for each project
- Updates project template_version to match
- Ensures supplier instances exist
- Optionally propagates to suppliers

#### `ensureSupplierActivitiesForProject(projectId: number)`
- Finds all supplier projects for a given project
- Calls `evaluateApplicabilityForSupplierProject` for each
- Creates missing `SupplierActivityInstance` records
- Respects applicability rules

### Auto-Trigger Points

Auto-propagation triggers on:
1. **Template Schedule Item Created** - `handleActivityTemplateScheduleItemsCreate`
2. **Template Schedule Item Updated** - `handleActivityTemplateScheduleItemsUpdate`
3. **Template Schedule Item Deleted** - `handleActivityTemplateScheduleItemsDelete`

Each checks the `auto_propagate_template_changes` setting before syncing.

---

## Frontend Implementation

### New Components

#### `ApplyToProjectsDialog.tsx`
**Location**: `src/components/activities/ApplyToProjectsDialog.tsx`
**Features**:
- Multi-select project list with checkboxes
- "Select All" / "Clear" buttons
- Shows selected count
- Displays results (created/skipped)
- Loading and error states

#### `SyncStatusBadge.tsx`
**Location**: `src/components/activities/SyncStatusBadge.tsx`
**Features**:
- Fetches sync status from backend
- Color-coded badges (green/amber/gray)
- Auto-refreshes on key events
- Loading spinner while checking

### Modified Components

#### `ActivityLibraryPage.tsx`
**Changes**:
- Added "Apply to Projects..." button
- Added "Apply to All Projects" button
- Integrated `SyncStatusBadge` component
- Added dialog state management
- Added success handlers to refresh sync status

#### `SettingsPage.tsx`
**Changes**:
- Added "Auto-Propagation" card
- Two new toggle switches with descriptions
- Cascade disable (suppliers toggle disabled when templates toggle off)
- Proper snake_case to camelCase conversion

---

## Console Logging

The feature includes comprehensive logging for debugging:

### Auto-Sync Logs
```
[Auto-Sync] Bumped template 6 version
[Auto-Sync] Setting auto_propagate_template_changes = true
[Auto-Sync] Auto-syncing projects for template 6
[Auto-Sync] Found 7 projects using template 6
[Auto-Sync] Successfully synced 7/7 projects
[Auto-Sync] Ensuring supplier activity instances exist...
[Auto-Sync] Checking supplier projects for project 1
[Auto-Sync] Found 5 supplier projects for project 1
[Auto-Sync] Ensuring supplier activities for 5 supplier projects
[Auto-Sync] Re-evaluating applicability for supplier project 10
[Auto-Sync] Completed creating missing supplier activity instances
[Auto-Sync] Propagating to suppliers...
[Auto-Sync] Propagated to suppliers for 7 projects
```

### Batch Create Logs
```
[Batch Create] Ensuring supplier instances for 7 projects
[Auto-Sync] Checking supplier projects for project 1
[Auto-Sync] Found 3 supplier projects for project 1
...
```

---

## Usage Guide

### Scenario 1: Create New Activity and Apply to All Projects

1. **Create Template**:
   - Go to Activity Library
   - Click "+" to create new activity template
   - Add schedule items (milestones and tasks)

2. **Apply to Projects**:
   - Click "Apply to All Projects" button
   - Confirm in dialog
   - See success message: "Applied to X projects, skipped Y"

3. **Verify**:
   - Sync status badge shows "All X projects in sync"
   - Go to any project → see the activity listed
   - Go to any supplier project → see the activity (if applicable)

### Scenario 2: Auto-Sync Template Changes

1. **Enable Setting**:
   - Go to Settings
   - Enable "Auto-Sync Template Changes"
   - Optionally enable "Auto-Propagate to Suppliers"

2. **Modify Template**:
   - Go to Activity Library → select template
   - Add a new milestone or task
   - Watch console logs

3. **Verify**:
   - All projects automatically updated
   - New milestone appears in all projects
   - Suppliers updated (if setting enabled)
   - Sync badge stays green

### Scenario 3: Sync Existing Activity to Suppliers

If you added an activity to projects before suppliers were created:

1. **Go to Activity Library** → select the activity
2. **Click "Apply to All Projects"**
   - It will skip all projects (already have activity)
   - But will create missing supplier instances
3. **Check Supplier Projects** → activity now appears

### Scenario 4: Manual Sync for Specific Projects

If you keep auto-sync disabled:

1. **Activity Library** shows "X of Y projects out of sync"
2. **Click "Apply to Projects..."**
3. **Select specific projects** to update
4. **Click Apply** → only selected projects sync

---

## Troubleshooting

### Activity Not Appearing on Some Suppliers

**Cause**: Applicability rules filtering the activity
**Solution**:
1. Go to Activity Library → select template
2. Click "Applicability Rules" tab
3. Check if rules exclude certain suppliers/parts
4. Either remove rules or adjust to include all

### Auto-Sync Not Working

**Cause**: Setting is disabled (default: OFF)
**Solution**:
1. Go to Settings
2. Enable "Auto-Sync Template Changes"
3. Make a change to the template
4. Check console logs for confirmation

### Sync Status Shows Out of Sync But Projects Are Correct

**Cause**: Version mismatch or item count difference
**Solution**:
1. Click "Apply to All Projects" to re-sync versions
2. This updates the template_version column
3. Badge will turn green

### Console Shows "Found 0 supplier projects"

**Cause**: Projects haven't been applied to suppliers yet
**Solution**:
1. Go to Suppliers page
2. For each supplier, apply the relevant projects
3. Or use the batch apply feature

---

## Technical Details

### Version Tracking Algorithm

```typescript
// On template change:
1. Increment template.version_number
2. For each project using template:
   - Sync schedule items (add missing, remove deleted)
   - Update project.template_version = template.version_number
3. Optionally propagate to suppliers

// Sync detection:
isOutOfSync = (project.template_version < template.version_number)
           || (project.item_count !== template.item_count)
```

### Applicability Re-evaluation

```typescript
// When activity applied to project:
1. Get all supplier_projects for this project
2. For each supplier_project:
   - Get all project_activities
   - For each activity:
     - Check applicability rules (NMR rank, PA rank)
     - Check manual overrides
     - Create/update SupplierActivityInstance
     - Set status: applicable ? "Not Started" : "Not Required"
```

### Performance Optimization

- **Batch operations**: All updates in single transaction
- **Database save**: Called once after all operations complete
- **Query optimization**: Uses indexed columns (project_id, template_id)
- **Lazy loading**: Sync status fetched on-demand, not preloaded

---

## Files Modified/Created

### Created (4 files)
1. `electron/migrations/013_activity_template_versions.sql`
2. `src/components/activities/ApplyToProjectsDialog.tsx`
3. `src/components/activities/SyncStatusBadge.tsx`
4. `MASS_ACTIVITY_FEATURE.md` (this file)

### Modified (5 files)
1. `shared/types.ts` - Added 9 new interfaces
2. `electron/handlers.ts` - Added ~400 lines (batch handlers, auto-sync)
3. `electron/preload.ts` - Exposed new IPC methods
4. `src/pages/ActivityLibrary/ActivityLibraryPage.tsx` - Added UI integration
5. `src/pages/Settings/SettingsPage.tsx` - Added auto-propagation controls

### Total Code Added
- **Backend**: ~450 lines
- **Frontend**: ~350 lines
- **Types**: ~60 lines
- **Total**: ~860 lines

---

## Future Enhancements

Potential improvements for future iterations:

1. **Selective Sync**: Choose which schedule items to sync (instead of all)
2. **Sync History**: Track when each project was last synced
3. **Conflict Resolution**: Handle cases where project and template both changed
4. **Bulk Undo**: Rollback a batch operation
5. **Scheduled Sync**: Auto-sync on a schedule (daily/weekly)
6. **Sync Preview**: Show what will change before syncing
7. **Activity Templates Versioning**: Full version history with rollback
8. **Batch Applicability Updates**: Change rules for multiple templates at once

---

## Support

If you encounter issues:
1. Check console logs for `[Auto-Sync]` and `[Batch Create]` messages
2. Verify settings are enabled (if using auto-sync)
3. Check applicability rules (if suppliers missing activities)
4. Review this documentation for proper usage

---

**Feature Complete**: February 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
