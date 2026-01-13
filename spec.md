# Supplier–Project–Activity Tracking App (Local Single-User) — Project Spec

**Project name (working):** Supplier Project Tracker  
**Doc version:** 1.1  
**Date:** 2026-01-12  
**Audience:** You (solo user) + coding agents (Claude Code / Gemini / similar)

---

## 1) Problem Statement

You want a **single-user, local** application to track **supplier progress** against **projects** and **project activities**. Projects are built from **activity templates**, then applied to multiple suppliers. You need:

- A **polished UI** that is fast and easy to navigate.
- The ability to define **offset-based milestone dates** (relative scheduling).
- **Propagation rules**: if a project’s dates change, supplier instances update accordingly (unless explicitly overridden).
- **Conditional task assignment** based on:
  - **Part Approval ranking** (“PA”) for each Part
  - **Supplier New Model Review ranking** (“NMR”) for each Supplier
  - Management-selected special procedures/activities

Parts are unique to a supplier+project context (unique part numbers) and **are not shared** across projects or suppliers.

---

## 2) Users & Operating Model

- **Primary user:** You (single user)
- **Deployment:** Local desktop app (offline-first)
- **Data:** Local database with export/import for backup

---

## 3) Core Concepts & Definitions

### 3.1 Supplier
An external supplier entity.

**Key fields**
- Name
- NMR ranking (e.g., A/B/C, 1/2/3 — configurable)
- Notes, contacts (optional)

### 3.2 Project (Template-like instance)
A reusable definition that includes a set of required activities and default schedule rules.

**Key fields**
- Project name
- Version
- Default anchor rule (optional)
- Activity set (project activities derived from activity templates)

### 3.3 Activity Template (Global)
A library of activities/procedures management can add over time.

**Key fields**
- Activity name
- Description
- Default schedule structure (optional)
- Dependency rules (optional)
- Applicability rules (see §6)

### 3.4 Project Activity (Activity applied to a specific Project)
When an Activity Template is added to a Project, it becomes a **Project Activity** with project-specific configuration.

**Key fields**
- Activity Template reference
- **Schedule items** (milestones and tasks with fixed dates or offset rules)
- Dependencies within the project (optional)
- Required vs optional (may be conditional)
- Default status (Not Started)

### 3.5 Supplier Project (Project applied to a Supplier)
When a Project is applied to a Supplier, it creates a Supplier Project instance.

**Key fields**
- Supplier reference
- Project reference + project version
- Supplier-specific anchor date (optional)
- Progress summary
- Override behavior flags (see §7)

### 3.6 Supplier Activity Instance (Project Activity applied to Supplier Project)
This is what you actively track per supplier.

**Key fields**
- Supplier Project reference
- Project Activity reference
- Planned dates (computed from schedule items)
- Actual dates (entered by user)
- Status (Not Started / In Progress / Blocked / Complete / Not Required)
- Comments, attachments (optional)
- Override flags (date override, scope override, lock)

### 3.7 Part
A Part is created under a supplier+project context and has a unique part number.

**Key fields**
- Part number (alpha-numeric)
- Description
- PA ranking (Part Approval ranking)
- Associated supplier + supplier project
- Notes

### 3.8 Schedule Item (Milestone or Task)
A **Schedule Item** is a dated checkpoint that belongs to a Project Activity. Items can represent:
- **Milestones** (e.g., “NMR Milestone 2 Due”)
- **Tasks** (e.g., “Submit”)

Each schedule item date can be:
- a **fixed date** (set at the project level), or
- computed via an **offset rule** from an anchor (see §7.1)

This explicitly supports: “Task = Milestone due date - 14 days”.

---

## 4) Key Workflows (User Flows)

### Flow A — Set up the libraries
1. Create Suppliers (and set NMR ranking).
2. Create Activity Templates (global library).
3. (Optional) Create rule sets for applicability (PA/NMR conditions).

### Flow B — Create a new Project
1. Create Project (name, default anchor rule optional).
2. Add Activities by selecting from Activity Templates.
3. For each Project Activity, define its schedule items:
   - milestones with fixed dates or offset rules
   - tasks with fixed dates or offset rules
   - dependencies (optional)
   - applicability rules (optional)
4. Save Project as versioned (v1, v2…).

### Flow C — Apply Project to Suppliers
1. Select a Project version.
2. Select Suppliers to apply it to.
3. For each supplier application:
   - optionally set a supplier-specific anchor date (if the project uses it)
   - system generates Supplier Project and Supplier Activity Instances
   - schedule items are computed for each supplier instance
   - activities included may vary by supplier based on rules + manual selection

### Flow D — Track progress per supplier
1. Open Supplier Project dashboard.
2. Update activity instance status/dates (including individual milestone/task actual dates).
3. See progress % and upcoming dates.
4. Use filters: overdue, due soon, blocked, by activity type.

### Flow E — Update project dates and propagate
1. Update project schedule items (e.g., change Milestone 2 due date).
2. System propagates the change to all supplier instances **that are not overridden/locked**.
3. System recalculates dependent schedule items (e.g., Submit = Milestone 2 due - 14 days).

### Flow F — Management adds a new Activity Template after projects exist
1. Add new Activity Template to the library.
2. For new Projects: it becomes available immediately.
3. For existing Projects:
   - optionally add to the Project (creates new Project Activity)
   - optionally push to supplier projects using the same propagation logic
4. For existing Supplier Projects:
   - manual add supported (select activity → create instance)
   - optional bulk-add across selected suppliers

---

## 5) Requirements

### 5.1 Must-Have (MVP)
- CRUD: Suppliers, Projects, Activity Templates, Parts
- Apply Project to multiple Suppliers
- Track per-supplier activity status + planned/actual dates
- Support **schedule items** inside an activity (milestones + tasks)
- Offset-based scheduling for milestones/tasks
- Propagation: project date/rule changes update supplier instances (with override rules)
- Conditional inclusion of activities based on PA and NMR rankings + management selection
- Search + filters (overdue, due soon, supplier, project, activity)
- Local persistence (SQLite) + export/import backup

### 5.2 Should-Have
- Dependencies between activities and/or schedule items (cannot start until prerequisites complete)
- Basic reporting:
  - per supplier progress
  - per project progress across suppliers
  - overdue lists
- Audit log (what changed, when) at least for schedule propagation & overrides
- Attachments or links (lightweight) per activity instance

### 5.3 Nice-to-Have
- Gantt / timeline visualization
- Email/CSV export of status reports
- Notifications (local reminders) for due soon/overdue
- Configurable ranking scales and rule builder UI

---

## 6) Applicability Rules (PA + NMR + Management Overrides)

Activities can be included/excluded by rules:

### 6.1 Ranking Inputs
- **Part PA ranking** (per part)
- **Supplier NMR ranking** (per supplier)

### 6.2 Rule Types
- **Supplier-based rule:** Activity required only if supplier NMR meets criteria.
- **Part-based rule:** Activity required only if part PA meets criteria.
- **Combined rule:** Activity required only if both conditions true.
- **Management selection:** Activity optionally forced on/off per Supplier Project or per Part.

### 6.3 Rule Evaluation Timing
- At Supplier Project creation: evaluate rules and create instances.
- When rankings change: system can re-evaluate and suggest changes:
  - add missing required activities
  - mark now-unneeded activities as “Not Required” (do not delete; preserve history)

---

## 7) Schedule & Propagation Rules

### 7.1 Anchors and Planned Dates
Planned dates are derived from **Schedule Items** using one of these anchor types:

- **Fixed Date**: explicit date set at the project level (e.g., Milestone 2 due = 2022-02-02)
- **Project Anchor**: “Day 0” for the project (optional)
- **Supplier Project Anchor**: supplier-specific “Day 0” (optional; used when suppliers run on different timelines)
- **Milestone Date Anchor**: anchor a task/milestone to another schedule item’s planned date  
  - example: `Submit = (Milestone 2 Due) + (-14 days)`
- **Dependency / Completion Anchor**: anchor to a prerequisite’s completion (optional)
  - example: `Milestone 3 = (Milestone 2 Actual Completion) + 28 days`

**Key point:** your use case is supported via **Milestone Date Anchor** (task relative to a milestone due date).

### 7.2 Propagation Behavior
When Project schedule items or rules change:
- Supplier schedule items recompute planned dates **unless**:
  - the instance has **date override = true**
  - the instance is marked **locked**
  - (default policy) the instance is **Completed** (configurable)
- System records propagation event in audit log.

### 7.3 Override Model
Each Supplier schedule item (milestone/task) may have:
- `plannedDateOverride`: user-set planned date
- `scopeOverride`: activity forced required/not-required for this supplier project
- `lock`: prevents future propagation changes

---

## 7.4 Worked Example — NMR Milestones & Submit Task
**Project Activity:** NMR

- **Milestone 2 Due** = **Fixed Date: 2022-02-02**
- **Submit** = **Anchor: Milestone 2 Due + (-14 days)** → **2022-01-19**
- **Milestone 3 Due** = **Fixed Date: 2022-03-02**

Two suppliers are on the same project:
- When you update **Milestone 2 Due** on the project (e.g., 2022-02-02 → 2022-02-16),
  - both suppliers’ planned **Milestone 2 Due** updates
  - both suppliers’ **Submit** updates automatically (now 2022-02-02)
  - any supplier schedule items marked overridden/locked remain unchanged

---

## 8) Data Model (Suggested)

> This is a logical model; implementation may vary.

- `Supplier(id, name, nmrRank, ...)`
- `ActivityTemplate(id, name, description, ...)`
- `Project(id, name, version, defaultAnchorRule, ...)`
- `ProjectActivity(id, projectId, activityTemplateId, applicabilityRules, ...)`

### Schedule Items (recommended)
Model milestones and tasks uniformly:

- `ProjectScheduleItem(id, projectActivityId, kind, name, anchorType, anchorRefId, offsetDays, fixedDate, sortOrder, ...)`
  - `kind`: MILESTONE | TASK
  - `anchorType`: FIXED_DATE | PROJECT_ANCHOR | SUPPLIER_ANCHOR | SCHEDULE_ITEM | COMPLETION
  - `anchorRefId`: points to another schedule item when `anchorType = SCHEDULE_ITEM`

Supplier instances mirror this:

- `SupplierProject(id, supplierId, projectId, projectVersion, supplierAnchorDate, ...)`
- `SupplierActivityInstance(id, supplierProjectId, projectActivityId, status, ...)`
- `SupplierScheduleItemInstance(id, supplierActivityInstanceId, projectScheduleItemId, plannedDate, actualDate, status, overrides..., ...)`

Other:
- `Part(id, supplierProjectId, partNumber, paRank, ...)`
- `AuditEvent(id, entityType, entityId, action, payload, createdAt)`

**Important constraint:** Parts are not shared across suppliers/projects; keep them scoped to a Supplier Project.

---

## 9) UI / UX Spec (Layout + Screens)

### Navigation (left sidebar)
- Dashboard
- Suppliers
- Projects
- Activity Library
- Parts
- Reports
- Settings

### 9.1 Dashboard (Home)
- “At a glance” cards:
  - Overdue schedule items
  - Due in next 7/14/30 days
  - Blocked items
- Quick filters: supplier, project, rank

### 9.2 Suppliers
- List + search + filter by NMR
- Supplier detail:
  - supplier profile + notes
  - table of Supplier Projects
  - within a Supplier Project: activity list → expand to show schedule items (milestones/tasks)

### 9.3 Projects
- Project list + versions
- Project builder:
  - add activities from library
  - define schedule items (milestones/tasks)
  - set fixed dates or anchor+offset rules
  - define applicability rules
  - “Apply to suppliers” action
- “Propagation preview” dialog (before applying schedule changes)
  - shows which supplier instances will change vs remain overridden

### 9.4 Activity Library
- List of Activity Templates
- Create/edit templates
- Tagging / categories (optional)

### 9.5 Parts
- Parts are viewed within Supplier Projects by default
- Ability to create parts (unique part numbers)
- Display PA ranking and show which activities become required due to PA

### 9.6 Reports
- “By supplier” and “By project”
- Export CSV (should-have)

### 9.7 UI Principles
- Fast list views (virtualized tables if needed)
- Strong filters and quick search
- Clear visual states for overdue / due soon / blocked / complete
- Minimal clicks: 2–3 to reach any supplier’s schedule item list

---

## 10) Technology & Architecture (Recommended)

### 10.1 App Type
**Local desktop app with polished UI**: **Electron + React + TypeScript**

### 10.2 Persistence
- SQLite local DB  
- ORM optional (Drizzle / Prisma / Kysely) or direct queries

### 10.3 Core Modules
- Data layer (DB, migrations, backup/export)
- Rules engine (PA/NMR applicability)
- Scheduler (anchor/offset computation, dependency computation)
- Propagation engine (diff + apply with overrides)
- UI (tables, detail panels, dialogs, timelines)

### 10.4 DevTools Behavior
By default, DevTools should **not** open on app launch.  
If you want it in dev mode, gate it behind an environment flag (e.g., `isDev`) and/or a keyboard shortcut.

---

## 11) Acceptance Criteria

A build is “done enough” when you can:

1. Create Suppliers with NMR ranks.
2. Create Activity Templates.
3. Create a Project and attach activities with schedule items:
   - fixed milestone dates
   - milestone-relative task offsets (e.g., -14 days)
4. Apply that Project to multiple suppliers and see per-supplier schedules.
5. Create Parts under a supplier project and set PA ranks.
6. See activities included/excluded based on PA/NMR rules.
7. Update project schedule items and propagate changes:
   - non-overridden supplier instances update
   - overridden/locked instances do not
   - propagation is auditable
8. Use search/filters to find overdue and due-soon items.
9. Export/import backup file.

---

## 12) Open Decisions (Safe Defaults)

If not specified, implement these defaults:
- Statuses: Not Started, In Progress, Blocked, Complete, Not Required
- Propagation policy: do not modify **Completed** items; do not modify **Locked** items
- Rankings: store as configurable enumerations but ship with a simple numeric scale (1–5)
- Rule logic: simple AND/OR conditions with a small rule builder; allow manual overrides everywhere

---

## 13) Agent Handoff Notes (for Claude Code / similar)

- Treat this document as the **source of truth**.
- Prioritize a polished UI and correct propagation behavior.
- Build iteratively:
  1) data model + CRUD  
  2) project builder (schedule items)  
  3) supplier application + instance generation  
  4) propagation engine + overrides  
  5) rules engine (PA/NMR)  
  6) reporting + refinements  

---

*End of spec.*
