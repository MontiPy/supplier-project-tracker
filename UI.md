# UI.md - Page Layout Notes

This document summarizes the current UI layout for each routed page and key dialogs.
Update it as the UI changes.

## Global Layout (src/components/Layout.tsx, src/components/Sidebar.tsx)
- Left sidebar with app title and primary navigation links (Dashboard, Suppliers, Projects, Activity Library, Parts, Reports, Settings, Help).
- Main content area scrolls independently of the sidebar.
(Request) Fix "Settings" and "Help" to the bottom of this sidebar in a separate section.

## Dashboard (src/pages/Dashboard.tsx)
- Header with title and subtitle.
- Summary cards row: Overdue, Due Soon, Blocked, Needs Propagation.
- Filter bar with selects for due range, supplier, project, and status.
- Actionable Items card with table (due date, supplier, project, activity, item, status, flags, action).
- Loading and empty states for the table.
(Request) Please research on the web what a dashboard layout should look like. This current layout seems very minimal.

## Suppliers List (src/pages/Suppliers/SuppliersList.tsx)
- Header with title, subtitle, and New Supplier button.
- Search input with filtered count.
- Table with supplier stats and row click to detail.
- Loading, empty, and no-results states.
- New Supplier dialog with name and notes.
(Request) There is no column for notes. Please add.
(Request) I would like to be able to track Supplier Number and Supplier Location Code. Later, I will track these to part numbers. Suppliers can have multiple number-location codes with the format 123456-01 all numeric.


## Supplier Detail (src/pages/Suppliers/SupplierDetail.tsx)
- Breadcrumb, header with supplier name/notes, Apply Project button.
- Tabs: Projects, Parts, Notes.
  - Projects tab: grid of project cards with version/rank badges, progress bar, overdue/next due stats, status badge, View Details button.
  (Request) I do not need to see version on this card. Please remove. Also it shows an activity name but these contain more than one. This feels unecessary. Please make it clear that the rank badge is the NMR rank.
  - Parts tab: card with CTA to Parts page.
  - Notes tab: placeholder content.
- Apply Project dialog: project select, supplier anchor date, project NMR rank, activity preview list with included/excluded states, and summary count.

## Supplier Project Detail (src/pages/SupplierProjects/SupplierProjectDetail.tsx)
- Breadcrumb, header with project name/version, rank badge, supplier name, and optional supplier-project switcher.
- Project NMR rank selector (when settings available).
- Info banner describing where progress lives.
- Inline summary row: progress bar, overdue count, next due date, status badge.
- Activity cards (accordion):
  - Card header with activity name, status badge, and override selector.
  - Expanded area: filter tabs (all/incomplete/due soon/overdue), bulk selection row, and grouped schedule item table.
  - Schedule table shows milestones and tasks with date inputs, status select, override/lock switches, and item selection checkboxes.
  - Attachments section with list and add form.
- Help footer explaining inherited vs editable fields.
(Request) all accordions should be collapsed by default.

## Projects List (src/pages/Projects/ProjectsList.tsx)
- Header with title, subtitle, and New Project button.
- Search input with filtered count.
- Table with project stats, next due, last updated, and actions.
- Loading, empty, and no-results states.
- New Project dialog (name, version, anchor date).

## Project Detail (src/pages/Projects/ProjectDetail.tsx)
- Breadcrumb, header with project name/version and action buttons.
- Propagation warning banner when suppliers exist.
- Tabs: Activities, Suppliers Applied, Audit Log.
  - Activities tab: list of activity cards with Sync From Template and Configure Dates actions.
  - Suppliers tab: table of applied suppliers with NMR rank, anchor date, created date, View button.
  - Audit tab: list of audit events with payload preview.
- Add Activity dialog and Sync From Template dialog.
- Propagation Preview modal.

## Project Configure Dates (src/pages/Projects/ProjectConfigureDates.tsx)
- Breadcrumb and header with project info and preview propagation button.
- Activity context row with Sync from Template action.
- Info banner describing milestone-driven schedule dates.
- Two-column layout:
  - Left card: milestone date inputs with Clear buttons.
  - Right card: schedule preview table with calculation text and Preview button.
- Footer action bar: Cancel, Save, Propagate.
- Propagation Preview modal.

## Activity Library (src/pages/ActivityLibrary/ActivityLibraryPage.tsx)
- Split layout: left template list panel and right detail panel.
- Left panel: search, template list with counts, create button, empty states.
- Right panel header: template name, category badge, description, updated at, Duplicate/Archive/Save actions.
- Tabs: Schedule Templates, Applicability Rules, Metadata.
  - Schedule tab: info banner, add milestone/task actions, validate button, schedule items table grouped by milestone, empty state.
  - Applicability tab: rule enabled toggle, operator select, clauses table with inline edits, add clause form.
  - Metadata tab: placeholder card.
- Dialogs: create/edit template, delete template, create/edit schedule item, delete schedule item.

## Parts (src/pages/Parts/PartsList.tsx)
- Header with Add Part button.
- Supplier project selector with anchor date summary.
- Parts table with edit/delete actions and empty states.
- Create/Edit Part dialog and Delete confirmation dialog.

## Reports (src/pages/Reports/ReportsPage.tsx)
- Header with Export CSV action.
- Tabs: Overview, Overdue Items, Due Soon, Project Progress, Supplier Progress.
- Overview tab: summary cards plus metric list card.
- Other tabs: data tables with status badges and empty states.

## Settings (src/pages/Settings/SettingsPage.tsx)
- Header, followed by stacked cards:
  - NMR rank chips with add/remove.
  - PA rank chips with add/remove.
  - Status definitions list.
  - Propagation policy toggles.
  - Date format select.
  - Business day toggle.
  - Backup/restore actions (export, import, wipe).
- Footer bar with Reset to Defaults and Save Settings actions.

## Help (src/pages/Help/HelpPage.tsx)
- Static documentation sections for workflow, feature explanations, and definitions.

## Legacy/Unused Pages (not routed in src/App.tsx)
- ActivityTemplatesList (src/pages/ActivityLibrary/ActivityTemplatesList.tsx): table list with CRUD dialogs.
- ActivityTemplateDetailPage (src/pages/ActivityLibrary/ActivityTemplateDetail.tsx): single template detail with schedule table and dialogs.

## Supporting Dialogs (used within pages)
- Add Activity to Project (src/pages/Projects/AddActivityDialog.tsx): select template and submit.
- Add Schedule Item (src/pages/Projects/ScheduleItemDialog.tsx): milestone/task form with anchor settings.
- Edit Schedule Item (src/pages/Projects/EditProjectScheduleItemDialog.tsx): milestone date or task override.
- Propagation Preview (src/pages/Projects/PropagationPreviewModal.tsx): will update vs protected table with apply action.
