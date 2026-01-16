# PLAN-NEW.md - UX Improvements & Feature Completion

This document tracks UX improvements based on best practices and user workflow analysis, plus remaining feature gaps from the specification.

---

## Data Model Clarification

**NMR Rank is per Supplier-Project, NOT per Supplier.**
- A supplier can be A1 rank on "2026 Model X" and B2 rank on "2026 Model Y"
- The `supplierProjectNmrRank` field is on the `SupplierProject` entity
- Applicability rules evaluate against this supplier-project rank

---

## Summary

| Category | Total Items | Completed | Remaining |
|----------|-------------|-----------|-----------|
| Critical UX Issues | 5 | 4 | 1 |
| Medium UX Improvements | 6 | 5 | 1 |
| Feature Gaps (spec.md) | 4 | 0 | 4 |
| Polish & Accessibility | 3 | 0 | 3 |
| **Total** | **18** | **9** | **9** |

---

## Part 1: Critical UX Issues (High Priority)

### 1.1 Dashboard Navigation Fix
- [x] **"Open" action should navigate to specific item, not just supplier** *(DONE)*
  - Added `supplierProjectId` to ActionableItem type and handler
  - Dashboard now navigates to `/supplier-projects/{supplierProjectId}`
  - Files modified: `shared/types.ts`, `electron/handlers.ts`, `src/pages/Dashboard.tsx`

### 1.2 Replace Browser alert() Dialogs
- [x] **Implement toast notification system** *(DONE)*
  - Toast infrastructure created: `src/components/ui/toast.tsx`, `src/components/ui/toaster.tsx`, `src/hooks/use-toast.ts`
  - Toaster added to App.tsx
  - No `alert()` calls found in codebase - infrastructure ready for future use

### 1.3 Propagation Discoverability
- [x] **Show banner when changes need propagating** *(DONE)*
  - Added amber warning banner to ProjectDetail when suppliers exist and activities exist
  - Banner includes clickable link to open Propagation Preview modal
  - File modified: `src/pages/Projects/ProjectDetail.tsx`

### 1.4 Form Validation & Inline Errors
- [ ] **Add real-time form validation**
  - Current: Errors only appear on submit (sometimes as alert dialogs)
  - Fix: Inline validation with error messages below fields
  - Validate schedule item dependencies during configuration, not at propagation time
  - Impact: Better feedback loop, fewer failed operations
  - Files: All dialog/form components

### 1.5 NMR Rank Visibility in Context
- [x] **Show NMR rank on supplier-project cards** *(DONE)*
  - Added RankBadge to supplier project cards in SupplierDetail page
  - Added NMR Rank column to "Suppliers Applied" table in ProjectDetail
  - Files modified: `src/pages/Suppliers/SupplierDetail.tsx`, `src/pages/Projects/ProjectDetail.tsx`

---

## Part 2: Medium UX Improvements

### 2.1 Simplify Schedule Item Editing
- [ ] **Reduce nesting in SupplierProjectDetail**
  - Current: Three levels of expand/collapse (activities → milestones → items)
  - Fix: Add "flat view" option showing all items in a single table
  - Or: Add quick-edit modal for individual items
  - Impact: Faster status updates, less accordion fatigue
  - File: `src/pages/SupplierProjects/SupplierProjectDetail.tsx`

### 2.2 Add Context to Calculated Dates
- [x] **Show calculation chain for schedule items** *(DONE)*
  - Added `getDateCalculationTooltip()` helper function to SupplierProjectDetail
  - Tooltips show anchor type, reference name, and offset calculation
  - Hover over planned date input to see: "Project anchor (2026-01-15) + 7 days"
  - File modified: `src/pages/SupplierProjects/SupplierProjectDetail.tsx`

### 2.3 Batch Status Updates
- [x] **Allow marking multiple items complete at once** *(DONE)*
  - Current: Must update items one-by-one
  - Added selection checkboxes with bulk status selection and apply action
  - Impact: Faster workflow for suppliers with many schedule items
  - File: `src/pages/SupplierProjects/SupplierProjectDetail.tsx`

### 2.4 Filter Tabs for Schedule Items
- [x] **Add filter tabs above schedule table** *(DONE)*
  - Added tabs: All, Incomplete, Due Soon 14d, Overdue
  - Shows counts in each tab
  - Impact: Easier to focus on what needs attention
  - File: `src/pages/SupplierProjects/SupplierProjectDetail.tsx`

### 2.5 Explanatory Info Banners
- [x] **Add "Where progress lives" banner to SupplierProjectDetail** *(DONE)*
  - Added blue info banner explaining data ownership
  - Text: "Planned dates are inherited from project schedule (read-only). Actual dates and status are tracked at the supplier level."
  - File modified: `src/pages/SupplierProjects/SupplierProjectDetail.tsx`

- [x] **Add "Where logic lives" banner to Activity Library** *(DONE)*
  - Added blue info banner explaining template purpose
  - Text: "Templates define schedule structure and offset rules. Milestones with PROJECT_ANCHOR have dates set at the project level. Tasks derive their dates from milestone anchors using offset days."
  - File modified: `src/pages/ActivityLibrary/ActivityLibraryPage.tsx`

### 2.6 Apply Project Preview
- [x] **Show preview of what will be created when applying project** *(DONE)*
  - Added interactive preview section to ApplyProjectDialog
  - Shows activities with green checkmarks (included) or gray X (excluded)
  - Displays applicability rule evaluation with reason text
  - Shows schedule item count per activity and total summary
  - Preview updates live when NMR rank selection changes
  - File modified: `src/pages/Suppliers/SupplierDetail.tsx`

---

## Part 3: Feature Gaps (spec.md Requirements)

### 3.1 Should-Have (Priority)
- [ ] **Activity and schedule item dependencies**
  - Allow defining prerequisites between schedule items
  - Show items as "blocked" when dependencies are incomplete
  - Prevent completing items until dependencies are done
  - Backend: Likely needs migration 006 wired up
  - Frontend: Add dependency selector in schedule item edit forms
  - Files: `electron/handlers.ts`, `src/pages/ActivityLibrary/ActivityLibraryPage.tsx`, `shared/types.ts`

### 3.2 Nice-to-Have (Lower Priority)
- [ ] **Timeline/Gantt visualization**
  - Visual timeline view of project schedule across suppliers
  - Show dependencies visually
  - Complexity: High (consider react-gantt-timeline or similar)

- [ ] **Notifications**
  - Local reminders for overdue/due-soon items
  - Use Electron notifications API
  - Complexity: Medium

- [ ] **Email export**
  - Generate email-friendly report format
  - Complexity: Low

---

## Part 4: Polish & Accessibility

### 4.1 Keyboard Navigation
- [ ] **Add visible focus states**
  - Current: No visible focus rings on inputs
  - Fix: Add focus-visible styles to all interactive elements
  - Add keyboard navigation for table rows
  - Impact: Accessibility compliance, power user efficiency

### 4.2 Loading & Error States
- [ ] **Add error boundaries**
  - Current: Crashes might show React error screen
  - Fix: Add error boundary component with recovery UI
  - Add retry buttons for failed network requests
  - Impact: Graceful error handling

### 4.3 Remove Dead Ends
- [ ] **Fix or hide "coming soon" features**
  - Current: "Notes" tab in SupplierDetail shows "coming soon"
  - Fix: Either implement Notes or hide the tab entirely
  - Impact: No dead-end navigation

---

## Implementation Plan

### Phase 1: Critical Fixes (Highest Impact)
1. Fix Dashboard navigation to go directly to supplier-project
2. Implement toast notifications (replace all alert() calls)
3. Add propagation needed banner to ProjectDetail
4. Add NMR rank badges to supplier-project cards

**Effort:** Medium | **Impact:** High

### Phase 2: Information Clarity
1. Add info banners (Where progress lives, Where logic lives)
2. Add date calculation tooltips/displays
3. Add apply-project preview showing what will be created

**Effort:** Low-Medium | **Impact:** Medium

### Phase 3: Workflow Improvements
1. Add filter tabs to SupplierProjectDetail
2. Simplify schedule item editing (flat view or quick-edit modal)
3. Add batch status updates

**Effort:** Medium | **Impact:** Medium

### Phase 4: Form & Validation
1. Add inline form validation
2. Validate schedule item dependencies during configuration
3. Add error boundaries and retry UI

**Effort:** Medium | **Impact:** Medium

### Phase 5: Dependencies Feature
1. Review and wire up migration 006
2. Add dependency selector to schedule item forms
3. Show blocked status based on incomplete dependencies
4. Update propagation to consider dependencies

**Effort:** High | **Impact:** Medium

### Phase 6: Optional Enhancements
- Timeline/Gantt view
- Notifications
- Email export
- Keyboard navigation polish

**Effort:** High | **Impact:** Low-Medium

---

## Verification Plan

After each phase:
1. **User workflow test**: Complete full workflow (create project → apply to supplier → track progress)
2. **No regressions**: Run `npm run dev` and navigate all pages
3. **Type safety**: Run `npx tsc -p tsconfig.electron.json` for backend
4. **Edge cases**: Test empty states, error states, loading states

---

## Key Files Reference

| Area | File Path |
|------|-----------|
| Dashboard | `src/pages/Dashboard.tsx` |
| Suppliers List | `src/pages/Suppliers/SuppliersList.tsx` |
| Supplier Detail | `src/pages/Suppliers/SupplierDetail.tsx` |
| Projects List | `src/pages/Projects/ProjectsList.tsx` |
| Project Detail | `src/pages/Projects/ProjectDetail.tsx` |
| Supplier Project Detail | `src/pages/SupplierProjects/SupplierProjectDetail.tsx` |
| Activity Library | `src/pages/ActivityLibrary/ActivityLibraryPage.tsx` |
| Propagation Modal | `src/pages/Projects/PropagationPreviewModal.tsx` |
| Reports | `src/pages/Reports/ReportsPage.tsx` |
| Settings | `src/pages/Settings/SettingsPage.tsx` |
| Help | `src/pages/Help/HelpPage.tsx` |
| Types | `shared/types.ts` |
| Backend Handlers | `electron/handlers.ts` |

---

## Top 3 Changes for Maximum Impact

If only 3 changes can be made:

1. **Fix Dashboard Navigation** - Make "Open" go directly to the supplier-project with the item that needs action
2. **Replace alert() with Toasts** - Modern, non-blocking feedback for all user actions
3. **Add Propagation Banner** - Show when project changes need propagating to suppliers

These three changes would significantly improve perceived quality and reduce user confusion.

---

## Next Session Instructions

### Session Date: 2026-01-16

### Phase 1 Status: COMPLETE (4/5 items)

**Completed:**
1. Dashboard navigation fix - navigates to supplier-project detail
2. Toast notification infrastructure - components and hooks created (no alert() calls existed)
3. Propagation warning banner - added to ProjectDetail
4. NMR rank badges - added to supplier-project cards

**Remaining in Critical UX (1.4):**
- Form validation & inline errors - deferred to Phase 4

### Phase 2 Status: COMPLETE (3/3 items)

**Completed:**
1. "Where progress lives" info banner - added to SupplierProjectDetail
2. "Where logic lives" info banner - added to ActivityLibraryPage
3. Date calculation tooltips - added to SupplierProjectDetail (hover over planned date)
4. Apply-project preview - added to SupplierDetail ApplyProjectDialog

### Ready for Phase 3: Workflow Improvements

### Phase 3 Status: IN PROGRESS (2/3 items)

Phase 3 tasks:
1. [x] Add filter tabs to SupplierProjectDetail (All, Incomplete, Due Soon, Overdue)
2. [x] Add batch status updates
3. [ ] Simplify schedule item editing (flat view or quick-edit modal)

### How to Continue

1. **Begin Phase 3** - Focus on simplifying schedule item editing:
   - Add flat view for schedule items or a quick-edit modal

2. **Start the dev server** to verify current changes work:
   ```bash
   npm run dev
   ```

3. **Run type check** after changes:
   ```bash
   npx tsc --noEmit
   ```

4. **Update this file** - Mark items complete as you go

### Quick Reference: Toast Usage (for future use)

```typescript
import { useToast } from '@/hooks/use-toast';

function MyComponent() {
  const { toast } = useToast();

  // Success
  toast({ title: 'Success', description: 'Action completed', variant: 'success' });

  // Error
  toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });

  // Info (default)
  toast({ title: 'Info', description: 'FYI message' });
}
```

### Files Modified During Phase 1

- `shared/types.ts` - Added supplierProjectId to ActionableItem
- `electron/handlers.ts` - Added supplier_project_id to dashboard query
- `src/pages/Dashboard.tsx` - Updated navigation URL
- `src/components/ui/toast.tsx` - NEW: Toast component
- `src/components/ui/toaster.tsx` - NEW: Toaster provider
- `src/hooks/use-toast.ts` - NEW: useToast hook
- `src/App.tsx` - Added Toaster to app root
- `src/pages/Projects/ProjectDetail.tsx` - Added propagation banner + NMR rank column
- `src/pages/Suppliers/SupplierDetail.tsx` - Added NMR rank badge to project cards

### Files Modified During Phase 2

- `src/pages/SupplierProjects/SupplierProjectDetail.tsx` - Added info banner, date calculation tooltips
- `src/pages/ActivityLibrary/ActivityLibraryPage.tsx` - Added info banner
- `src/pages/Suppliers/SupplierDetail.tsx` - Added apply-project preview with applicability evaluation

---

## Active Bug Investigation: Applicability Rules Not Applying

### Issue Description
User reported that an activity with an applicability clause (SUPPLIER_NMR EQ 'B') is not being applied when a supplier-project has NMR rank 'B'.

### Debug Logging Added
Added console.log statements to `electron/handlers.ts` in the following functions:
- `shouldIncludeActivity()` - Logs template ID, context, rules found, enabled status, clauses, and evaluation results
- `compareWithComparator()` - Logs subject, comparator, value, and comparison results

### How to Debug
1. Run `npm run dev`
2. Apply a project to a supplier with NMR rank "B"
3. Check terminal output for lines starting with `[Applicability]`

### Expected Log Output
```
[Applicability] Template ID: X Context: {"supplierNmrRank":"B","partPaRanks":[],...}
[Applicability] Rules found: 1 [{id: Y, enabled: 1, ...}]
[Applicability] Rule: {...} enabled: 1 typeof: number
[Applicability] Clauses for rule Y: [{subject_type: 'SUPPLIER_NMR', comparator: 'EQ', value: 'B'}]
[Applicability Compare] subject: "B" comparator: EQ value: "B"
[Applicability Compare] EQ result: true subject===value: B === B
[Applicability] Rule evaluation result: true
```

### Potential Causes to Investigate
1. **Rule not linked to correct template** - Check that `activity_template_id` in rule matches the template used by the project activity
2. **Rule disabled** - Check `enabled` field is 1, not 0
3. **No clauses created** - Check clauses exist for the rule
4. **NMR rank not passed** - Check `supplierProjectNmrRank` is being sent from frontend
5. **Case sensitivity** - Check if 'B' vs 'b' mismatch
6. **Whitespace** - Check for trailing/leading spaces in value

### Files Modified for Debugging
- `electron/handlers.ts` - Added debug logging to `shouldIncludeActivity()` and `compareWithComparator()`

### Next Steps
1. **Collect debug output** - Run app and capture console logs when applying project
2. **Analyze logs** - Identify where the evaluation fails
3. **Fix root cause** - Based on logs, fix the underlying issue
4. **Remove debug logging** - Once fixed, remove or reduce console.log statements
5. **Add test case** - Consider adding automated test for applicability evaluation

### Cleanup Required
After debugging is complete, remove the console.log statements from:
- `shouldIncludeActivity()` (lines 277-278, 281, 287, 289, 297-299, 305)
- `compareWithComparator()` (lines 188, 190-191, 196-197)
