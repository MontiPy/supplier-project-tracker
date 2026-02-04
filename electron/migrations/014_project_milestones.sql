-- Add project-level milestones and PROJECT_MILESTONE anchor type
-- Milestones like PA2, PA3, NMR3 are defined at the project level
-- and activity schedule items can reference them via PROJECT_MILESTONE anchor type
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- 1. Create project_milestones table
CREATE TABLE project_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_milestones_project ON project_milestones(project_id);

-- 2. Rebuild project_schedule_items to add project_milestone_id and PROJECT_MILESTONE anchor type
CREATE TABLE project_schedule_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_activity_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('MILESTONE', 'TASK')),
  name TEXT NOT NULL,
  anchor_type TEXT NOT NULL CHECK(anchor_type IN ('FIXED_DATE', 'SCHEDULE_ITEM', 'COMPLETION', 'PROJECT_MILESTONE')),
  anchor_ref_id INTEGER,
  offset_days INTEGER,
  fixed_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  template_item_id INTEGER,
  override_date TEXT,
  override_enabled INTEGER NOT NULL DEFAULT 0,
  project_milestone_id INTEGER,
  FOREIGN KEY (project_activity_id) REFERENCES project_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (anchor_ref_id) REFERENCES project_schedule_items_new(id),
  FOREIGN KEY (project_milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL
);

INSERT INTO project_schedule_items_new (
  id, project_activity_id, kind, name, anchor_type, anchor_ref_id,
  offset_days, fixed_date, sort_order, created_at, template_item_id,
  override_date, override_enabled, project_milestone_id
)
SELECT
  id, project_activity_id, kind, name, anchor_type, anchor_ref_id,
  offset_days, fixed_date, sort_order, created_at, template_item_id,
  override_date, override_enabled, NULL
FROM project_schedule_items;

DROP TABLE project_schedule_items;
ALTER TABLE project_schedule_items_new RENAME TO project_schedule_items;

CREATE INDEX idx_project_schedule_items_activity ON project_schedule_items(project_activity_id);
CREATE INDEX idx_project_schedule_items_milestone ON project_schedule_items(project_milestone_id);

-- 3. Rebuild activity_template_schedule_items to add project_milestone_name and PROJECT_MILESTONE anchor type
CREATE TABLE activity_template_schedule_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_template_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('MILESTONE', 'TASK')),
  name TEXT NOT NULL,
  anchor_type TEXT NOT NULL CHECK(anchor_type IN ('FIXED_DATE', 'SCHEDULE_ITEM', 'COMPLETION', 'PROJECT_MILESTONE')),
  anchor_ref_id INTEGER,
  offset_days INTEGER,
  project_milestone_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (anchor_ref_id) REFERENCES activity_template_schedule_items_new(id)
);

INSERT INTO activity_template_schedule_items_new (
  id, activity_template_id, kind, name, anchor_type, anchor_ref_id,
  offset_days, project_milestone_name, created_at
)
SELECT
  id, activity_template_id, kind, name, anchor_type, anchor_ref_id,
  offset_days, NULL, created_at
FROM activity_template_schedule_items;

DROP TABLE activity_template_schedule_items;
ALTER TABLE activity_template_schedule_items_new RENAME TO activity_template_schedule_items;

COMMIT;
PRAGMA foreign_keys=on;
