# Import/Export Feature Plan

## Overview

Add bulk import/export functionality to the Supplier Quality Tracking System using JSON format. The primary use case is **bulk updates** to existing data with a merge/comparison workflow that allows users to review, edit, and approve changes before applying them.

---

## Goals

1. **Export** data to JSON (full or selective)
2. **Import** JSON with intelligent duplicate detection
3. **Merge/Comparison View** for reviewing conflicts with inline editing
4. **Rollback** capability to undo imports
5. **Schema Update**: Link parts to supplier_location_codes instead of supplier_projects

---

## 1. Schema Migration

### Current Structure
```
SupplierProject
  └── Part (part_number linked to supplier_project_id)
```

### New Structure
```
SupplierProject
  └── SupplierLocationCode
        └── Part (part_number linked to supplier_location_code_id)
```

### Migration SQL (Migration 012)

```sql
-- Step 1: Add new foreign key column to parts
ALTER TABLE parts ADD COLUMN supplier_location_code_id INTEGER REFERENCES supplier_location_codes(id) ON DELETE CASCADE;

-- Step 2: Create index for new FK
CREATE INDEX idx_parts_supplier_location_code ON parts(supplier_location_code_id);

-- Step 3: For existing parts without location codes, create a default location code per supplier_project
-- This is handled in TypeScript migration logic to:
--   a) For each supplier_project with parts, find or create a default supplier_location_code
--   b) Update parts to reference that location code

-- Step 4: After data migration, make the column NOT NULL (optional, or keep nullable for backwards compat)
```

### TypeScript Migration Handler

The migration will need TypeScript logic to:
1. Query all parts with their supplier_project relationships
2. For each supplier_project, find existing supplier_location_codes or create a default one
3. Update each part to reference the appropriate supplier_location_code_id

---

## 2. JSON Structure Design

### Export Format

The JSON uses **human-readable natural keys** (not internal IDs) for portability between databases.

```json
{
  "exportMetadata": {
    "version": "1.0",
    "exportedAt": "2024-01-15T10:30:00Z",
    "source": "SQTS v1.0.0",
    "scope": "full" | "selective"
  },

  "activityTemplates": [
    {
      "name": "PPAP Submission",
      "description": "Production Part Approval Process",
      "category": "Quality",
      "scheduleItems": [
        {
          "name": "Submit Documents",
          "kind": "MILESTONE",
          "anchorType": "FIXED_DATE",
          "offsetDays": null,
          "anchorRef": null
        },
        {
          "name": "Review Period",
          "kind": "TASK",
          "anchorType": "SCHEDULE_ITEM",
          "offsetDays": 5,
          "anchorRef": "Submit Documents"
        }
      ],
      "applicabilityRules": {
        "operator": "ALL",
        "enabled": true,
        "clauses": [
          {
            "subjectType": "SUPPLIER_NMR",
            "comparator": "IN",
            "value": "A1,A2"
          }
        ]
      }
    }
  ],

  "projects": [
    {
      "name": "2024 Model Year Launch",
      "version": "1.0",
      "activities": [
        {
          "activityTemplateName": "PPAP Submission",
          "sortOrder": 1,
          "scheduleItems": [
            {
              "name": "Submit Documents",
              "kind": "MILESTONE",
              "anchorType": "FIXED_DATE",
              "fixedDate": "2024-06-01",
              "offsetDays": null,
              "anchorRef": null,
              "sortOrder": 1,
              "overrideDate": null,
              "overrideEnabled": false
            }
          ],
          "dependencies": ["Design Validation"]
        }
      ]
    }
  ],

  "suppliers": [
    {
      "name": "Acme Manufacturing",
      "notes": "Primary supplier for fasteners",
      "locationCodes": [
        {
          "supplierNumber": "SUP-001",
          "locationCode": "PLANT-A"
        },
        {
          "supplierNumber": "SUP-001",
          "locationCode": "PLANT-B"
        }
      ],
      "projects": [
        {
          "projectName": "2024 Model Year Launch",
          "projectVersion": "1.0",
          "nmrRank": "A1",
          "activities": [
            {
              "activityTemplateName": "PPAP Submission",
              "status": "In Progress",
              "scopeOverride": null,
              "scheduleItems": [
                {
                  "name": "Submit Documents",
                  "plannedDate": "2024-06-01",
                  "actualDate": null,
                  "status": "Not Started",
                  "plannedDateOverride": false,
                  "scopeOverride": null,
                  "locked": false
                }
              ],
              "attachments": [
                {
                  "label": "PPAP Package",
                  "url": "https://sharepoint.example.com/ppap/123"
                }
              ]
            }
          ],
          "parts": [
            {
              "supplierNumber": "SUP-001",
              "locationCode": "PLANT-A",
              "partNumber": "FAS-12345",
              "description": "M8 Hex Bolt",
              "paRank": "Critical",
              "notes": "Safety critical fastener"
            }
          ]
        }
      ]
    }
  ],

  "settings": {
    "nmrRanks": ["A1", "A2", "B1", "B2", "C1"],
    "paRanks": ["Critical", "High", "Medium", "Low"],
    "propagationSkipComplete": true,
    "propagationSkipLocked": true,
    "propagationSkipOverridden": true,
    "dateFormat": "MM/DD/YYYY",
    "useBusinessDays": false
  }
}
```

### Key Design Decisions

1. **Natural Keys**: All references use names/human-readable identifiers, not database IDs
2. **Hierarchical Structure**: Nested JSON mirrors the entity hierarchy (a separate tool will be created for mass JSON edits)
3. **Self-Contained**: Schedule item anchors reference by name within the same activity
4. **Parts Reference Location Codes**: Parts include `supplierNumber` + `locationCode` to identify which location they belong to
5. **Optional Sections**: Import can include partial data (e.g., just suppliers, just dates)

---

## 3. Matching Logic

### Duplicate Detection Rules

| Entity | Match Key | Example |
|--------|-----------|---------|
| **Supplier** | `name` | "Acme Manufacturing" |
| **SupplierLocationCode** | `supplier.name` + `supplierNumber` + `locationCode` | "Acme Manufacturing/SUP-001/PLANT-A" |
| **ActivityTemplate** | `name` | "PPAP Submission" |
| **Project** | `name` + `version` | "2024 Model Year Launch/1.0" |
| **ProjectActivity** | `project.name` + `project.version` + `activityTemplate.name` | "2024.../PPAP Submission" |
| **ProjectScheduleItem** | `project...` + `activity...` + `name` | ".../Submit Documents" |
| **SupplierProject** | `supplier.name` + `project.name` + `project.version` | "Acme.../2024.../1.0" |
| **SupplierActivityInstance** | `supplier...` + `project...` + `activity.name` | "Acme.../2024.../PPAP..." |
| **SupplierScheduleItemInstance** | `supplier...` + `...` + `scheduleItem.name` | ".../Submit Documents" |
| **Part** | `supplier.name` + `project...` + `supplierNumber` + `locationCode` + `partNumber` | "Acme.../SUP-001/PLANT-A/FAS-12345" |

### Match Results

For each imported record, classification:
- **NEW**: No matching record exists → Will be created
- **UNCHANGED**: Record exists with identical values → No action needed
- **MODIFIED**: Record exists with different values → Show comparison
- **CONFLICT**: Structural conflict (e.g., FK reference doesn't exist) → Requires resolution

---

## 4. Export Functionality

### 4.1 Selective Export (List View Checkboxes)

Add checkboxes to existing list views for selective export:

**Suppliers Page (`src/pages/Suppliers.tsx`)**
- Add checkbox column to supplier table
- Add "Export Selected" button to toolbar
- Export includes: selected suppliers + all their location codes, projects, activities, schedule items, parts

**Projects Page (`src/pages/Projects.tsx`)**
- Add checkbox column to project table
- Add "Export Selected" button
- Export includes: selected projects + all their activities, schedule items (as templates)

**Activity Templates Page**
- Add checkbox column
- Export includes: selected templates + schedule items + applicability rules

### 4.2 Dedicated Export Page

Location: Top-level "Import/Export" section (separate from Settings, near Settings/Help buttons in header/sidebar)

**UI Components:**
```
┌─────────────────────────────────────────────────────────────┐
│  Export Data                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Export Scope:                                              │
│  ○ Full Database Export                                     │
│  ○ Selective Export                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ □ Activity Templates          [Select All] [Clear]  │   │
│  │   ☑ PPAP Submission                                 │   │
│  │   ☑ Design Validation                               │   │
│  │   □ Tooling Approval                                │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ □ Projects                    [Select All] [Clear]  │   │
│  │   ☑ 2024 Model Year Launch (v1.0)                   │   │
│  │   □ 2025 Platform Refresh (v1.0)                    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ □ Suppliers                   [Select All] [Clear]  │   │
│  │   ☑ Acme Manufacturing                              │   │
│  │   ☑ Beta Components                                 │   │
│  │   □ Gamma Industries                                │   │
│  │     └─ Include: ☑ Projects ☑ Parts ☑ Schedule Data │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ □ Settings                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Include Options:                                           │
│  ☑ Include schedule item instances (dates, status)         │
│  ☑ Include attachments                                      │
│  □ Include audit history                                    │
│                                                             │
│  [Export to JSON]                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Export IPC Handlers

```typescript
// New handlers in electron/handlers.ts

interface ExportOptions {
  scope: 'full' | 'selective';
  activityTemplateIds?: number[];
  projectIds?: number[];
  supplierIds?: number[];
  includeScheduleInstances: boolean;
  includeAttachments: boolean;
  includeSettings: boolean;
}

// Handler: export.generateJson
// Returns: { success: true, data: ExportedData }

// Handler: export.saveToFile
// Opens save dialog, writes JSON to selected location
```

---

## 5. Import Functionality

### 5.1 Import Page

Location: Top-level "Import/Export" section → Import Tab

**Step 1: File Selection**
```
┌─────────────────────────────────────────────────────────────┐
│  Import Data                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │         Drag & drop JSON file here                  │   │
│  │                 or                                  │   │
│  │            [Browse Files]                           │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Selected: supplier_update_2024-01-15.json                 │
│  Size: 245 KB | Records: ~150 entities                     │
│                                                             │
│  [Analyze Import →]                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Step 2: Analysis Summary**
```
┌─────────────────────────────────────────────────────────────┐
│  Import Analysis                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Summary:                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Entity Type          New   Modified  Unchanged  Err │   │
│  │ ─────────────────────────────────────────────────── │   │
│  │ Suppliers              2        3          5      0 │   │
│  │ Location Codes         4        1          8      0 │   │
│  │ Projects               0        1          2      0 │   │
│  │ Activities             0        5          20     0 │   │
│  │ Schedule Items         0       45          80     0 │   │
│  │ Parts                 12        8          30     1 │   │
│  │ ─────────────────────────────────────────────────── │   │
│  │ TOTAL                 18       63         145     1 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠ 1 error requires attention                              │
│  ℹ 63 records have changes to review                       │
│                                                             │
│  [← Back]                    [Review Changes →]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Merge/Comparison View**
```
┌─────────────────────────────────────────────────────────────┐
│  Review Changes                                    [1/63]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Filter: [All ▼] [Suppliers ▼] [Modified ▼]    🔍 Search   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☑ Acme Manufacturing / 2024 Launch / PPAP / Submit  │   │
│  │   ├─ plannedDate: 2024-06-01 → 2024-06-15          │   │
│  │   └─ status: Not Started → In Progress              │   │
│  │   [Edit Incoming ✏️]                                │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ☑ Acme Manufacturing / 2024 Launch / PPAP / Review  │   │
│  │   └─ plannedDate: 2024-06-10 → 2024-06-20          │   │
│  │   [Edit Incoming ✏️]                                │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ☑ Beta Components / 2024 Launch / Design Val        │   │
│  │   └─ actualDate: (empty) → 2024-05-28              │   │
│  │   [Edit Incoming ✏️]                                │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ⚠ ERROR: Part FAS-99999                             │   │
│  │   Location code "SUP-002/PLANT-X" not found         │   │
│  │   [Create Location Code] [Skip This Record]         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Bulk Actions:                                              │
│  [Select All Modified] [Deselect All] [Accept All Selected] │
│                                                             │
│  Selected: 62 of 63 changes                                │
│                                                             │
│  [← Back]                    [Apply Selected Changes →]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Edit Incoming Modal**
```
┌─────────────────────────────────────────────────────────┐
│  Edit Incoming Data                                     │
│  Acme Manufacturing / 2024 Launch / PPAP / Submit Docs  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Field            Current        Incoming (editable)    │
│  ───────────────────────────────────────────────────── │
│  Planned Date     2024-06-01     [2024-06-15    📅]    │
│  Actual Date      (empty)        [(empty)       📅]    │
│  Status           Not Started    [In Progress   ▼]     │
│  Locked           No             [No            ▼]     │
│  Override         No             [No            ▼]     │
│                                                         │
│              [Cancel]  [Save Changes]                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Step 4: Confirmation & Apply**
```
┌─────────────────────────────────────────────────────────────┐
│  Confirm Import                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  You are about to apply the following changes:              │
│                                                             │
│  • 2 new suppliers will be created                         │
│  • 3 suppliers will be updated                             │
│  • 45 schedule dates will be modified                      │
│  • 12 new parts will be added                              │
│  • 1 record skipped due to errors                          │
│                                                             │
│  ☑ Create rollback point before applying                   │
│    (Allows you to undo this entire import)                 │
│                                                             │
│  [← Back to Review]              [Apply Changes]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Import IPC Handlers

```typescript
// Handler: import.parseFile
// Input: file path
// Returns: parsed JSON with validation errors

// Handler: import.analyze
// Input: parsed data
// Returns: analysis with match results (new/modified/unchanged/error)

// Handler: import.preview
// Input: record ID from analysis
// Returns: side-by-side comparison data

// Handler: import.apply
// Input: { changes: ChangeRecord[], createRollback: boolean }
// Returns: { success, rollbackId?, appliedCount, errors }
```

---

## 6. Rollback Mechanism

### 6.1 Rollback Storage

Create new table for storing rollback snapshots:

```sql
-- Migration 013: Add rollback support

CREATE TABLE import_rollbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  snapshot_data TEXT NOT NULL,  -- JSON blob of affected records (before state)
  records_affected INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  applied_at TEXT,              -- NULL if not yet rolled back
  status TEXT NOT NULL DEFAULT 'available'  -- 'available', 'applied', 'expired'
);

CREATE INDEX idx_import_rollbacks_status ON import_rollbacks(status);
```

### 6.2 Rollback Snapshot Structure

```json
{
  "importId": "abc123",
  "createdAt": "2024-01-15T10:30:00Z",
  "affectedRecords": [
    {
      "entityType": "supplier_schedule_item_instances",
      "entityId": 456,
      "matchKey": "Acme.../PPAP.../Submit Documents",
      "action": "update",
      "beforeState": {
        "planned_date": "2024-06-01",
        "status": "Not Started"
      },
      "afterState": {
        "planned_date": "2024-06-15",
        "status": "In Progress"
      }
    },
    {
      "entityType": "parts",
      "entityId": null,
      "matchKey": "Acme.../SUP-001/PLANT-A/FAS-99999",
      "action": "create",
      "beforeState": null,
      "afterState": { "...": "..." }
    }
  ]
}
```

### 6.3 Rollback UI (Import/Export Page)

```
┌─────────────────────────────────────────────────────────────┐
│  Import History & Rollback                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Recent Imports:                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Date          Records   Status      Actions         │   │
│  │ ─────────────────────────────────────────────────── │   │
│  │ 2024-01-15    63        Applied     [Undo Import]   │   │
│  │ 2024-01-10    28        Applied     [Undo Import]   │   │
│  │ 2024-01-05    15        Rolled Back (view details)  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Note: Rollback points are kept for 30 days                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Rollback IPC Handlers

```typescript
// Handler: rollback.list
// Returns: list of available rollback points

// Handler: rollback.preview
// Input: rollbackId
// Returns: summary of what will be undone

// Handler: rollback.apply
// Input: rollbackId
// Returns: { success, restoredCount, errors }

// Handler: rollback.cleanup
// Removes rollback points older than 30 days
```

---

## 7. Implementation Phases

### Phase 1: Schema Migration & Core Infrastructure
**Estimated scope: Foundation work**

- [ ] Create Migration 012: Link parts to supplier_location_codes
- [ ] Update TypeScript types in `shared/types.ts`
- [ ] Update IPC handlers for parts CRUD operations
- [ ] Update UI components that display/edit parts
- [ ] Create JSON schema validation utilities
- [ ] Create matching/deduplication engine

### Phase 2: Export Functionality
**Estimated scope: Export feature**

- [ ] Implement export data assembly logic
- [ ] Add export IPC handlers
- [ ] Create dedicated Export page in Settings
- [ ] Add checkbox selection to Suppliers list view
- [ ] Add checkbox selection to Projects list view
- [ ] Add checkbox selection to Activity Templates list view
- [ ] Add "Export Selected" buttons to toolbars
- [ ] Implement file save dialog integration

### Phase 3: Import Analysis & Comparison
**Estimated scope: Import analysis**

- [ ] Implement JSON parsing and validation
- [ ] Build matching engine for duplicate detection
- [ ] Create analysis summary generation
- [ ] Build comparison data structures
- [ ] Create Import page in Settings (Steps 1-2)

### Phase 4: Merge/Comparison UI
**Estimated scope: Review workflow**

- [ ] Build merge/comparison list view component
- [ ] Implement filtering and search
- [ ] Create inline edit modal for incoming data
- [ ] Add bulk selection actions
- [ ] Implement change preview tooltips
- [ ] Handle error cases with resolution options

### Phase 5: Import Apply & Rollback
**Estimated scope: Apply and undo**

- [ ] Create Migration 013: Rollback tables
- [ ] Implement rollback snapshot creation
- [ ] Build import apply transaction logic
- [ ] Create rollback apply logic
- [ ] Add rollback history UI to Settings
- [ ] Implement automatic rollback cleanup (30-day retention)

### Phase 6: Polish & Testing
**Estimated scope: Quality assurance**

- [ ] End-to-end testing of full import/export cycle
- [ ] Edge case handling (empty files, malformed JSON, etc.)
- [ ] Performance testing with large datasets
- [ ] Error message improvements
- [ ] Documentation updates

---

## 8. File Changes Summary

### New Files
```
src/pages/ImportExport/index.tsx          -- Main import/export page (top-level section)
src/pages/ImportExport/ImportTab.tsx      -- Import tab content
src/pages/ImportExport/ExportTab.tsx      -- Export tab content
src/pages/ImportExport/RollbackTab.tsx    -- Rollback history tab
src/components/import/ImportWizard.tsx    -- Multi-step import flow
src/components/import/AnalysisSummary.tsx -- Step 2: Analysis results
src/components/import/MergeReview.tsx     -- Step 3: Comparison view
src/components/import/EditIncoming.tsx    -- Modal for editing incoming data
src/components/import/ConfirmApply.tsx    -- Step 4: Confirmation
src/components/export/EntitySelector.tsx  -- Checkbox tree for selection
electron/migrations/012-parts-location.sql
electron/migrations/013-rollback-tables.sql
electron/import/                          -- Import engine modules
  ├── parser.ts                           -- JSON parsing & validation
  ├── matcher.ts                          -- Duplicate detection
  ├── analyzer.ts                         -- Change analysis
  └── applier.ts                          -- Transaction application
electron/export/
  └── assembler.ts                        -- Export data assembly
```

### Modified Files
```
shared/types.ts                           -- Add Part.supplierLocationCodeId, import/export types
electron/handlers.ts                      -- Add import/export handlers
electron/database.ts                      -- Update parts queries
src/pages/Suppliers.tsx                   -- Add checkbox column, export button
src/pages/Projects.tsx                    -- Add checkbox column, export button
src/pages/ActivityTemplates.tsx           -- Add checkbox column, export button
src/App.tsx                               -- Add route for Import/Export page
src/components/layout/                    -- Add Import/Export nav item near Settings/Help
electron/preload.ts                       -- Expose new IPC methods
```

---

## 9. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Large file progress** | Not needed | Bulk updates expected to be small (<1000 records) |
| **Rollback granularity** | Entire import only | Simplifies rollback logic; users undo all or nothing |
| **Export scheduling** | Not planned | Out of scope for current requirements |
| **Validation strictness** | Allow partial imports | Skip bad records, import valid ones; user can fix and re-import errors |

---

## Appendix: JSON Schema (Draft)

A formal JSON Schema for validation will be created during implementation to ensure imported files conform to the expected structure. This will catch format errors early in the import process.
