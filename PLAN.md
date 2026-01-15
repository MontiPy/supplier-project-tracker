# Completion Plan

This plan captures the gaps vs spec.md and an implementation order to close them.

## Checklist
- [x] MVP: Settings export/import (backup) and a nuclear wipe option for all data, both in Settings.
- [x] MVP: Applicability rules (PA/NMR + management overrides) to include/exclude activities at apply time and on rank changes.
- [x] MVP: Support per-supplier-project NMR rank (override supplier default; used for applicability rules).
- [x] MVP: Backup export/import of the local database (UI + IPC + file picker).
- [x] MVP: Search and filters for suppliers/projects/activity templates beyond the dashboard filters.
- [x] MVP: Propagation respects settings (skip complete/locked/overridden, use business days).
- [x] MVP: Supplier schedule item controls for status (Blocked/Not Required), planned date override, and lock/unlock.
- [x] MVP: Schedule item UI enhancements (status dropdown + milestone task collapse).
- [x] MVP: Audit log renders stored payloads and captures override events.
- [ ] Should: Activity and schedule item dependencies.
- [x] Should: Reports by project across suppliers and an overdue list view.
- [x] Should: Attachments or links on supplier activity instances.
- [x] Should: Completion anchors recalculate planned dates from actual completions.
- [ ] Nice: Gantt/timeline, notifications, richer CSV/email exports.
- [x] UX: Add Parts to navigation and link Supplier detail Parts tab to Parts view.

## Implementation Plan
### Phase 0 - Quick fixes and alignment [x]
- Fix audit log rendering to show stored payloads.
- Add Parts to the sidebar and link the Supplier detail Parts tab to the Parts page (or embed the list).

### Phase 1 - Data model updates [x]
- Add migrations for applicability rules (activity template rule definitions + clauses).
- Add supplier-project NMR rank override (column + backfill from supplier default).
- Add migrations for activity dependencies and optional attachment metadata (URL + label).

### Phase 2 - Applicability rules engine [x]
- Implement rule evaluation using supplier-project NMR rank and part PA rank.
- Apply rules during supplier project creation; set activity status to Not Required for excluded items.
- Add management overrides to force activities required/not required on a supplier project.
- Re-evaluate when ranks change and mark activities as Not Required without deleting history.

### Phase 3 - Propagation and item controls [x]
- Wire propagation behavior to settings (skip complete/locked/overridden, business days).
- Add UI controls for status, planned date overrides, and locks at the supplier schedule item level.
- Add schedule item status dropdowns and collapse/expand milestones to roll up tasks.
- Update propagation preview and audit logging for overrides.

### Phase 4 - Backup and restore [x]
- Add Settings UI actions for export, import, and nuclear wipe of all data (confirmations required).
- IPC handlers for export/import of the local database.
- UI entry point in Settings (or Help) with file picker and confirmation prompts.

### Phase 5 - Reporting and search [x]
- Add per-project progress reporting across suppliers and overdue list views.
- Add search/filter inputs to Suppliers, Projects, and Activity Library lists.

### Phase 6 - Optional enhancements [ ]
- [x] Implement attachment links on supplier activities.
- [x] Support completion anchors for schedule items (planned dates from actual completion).
- [ ] Add timeline view if still needed.


