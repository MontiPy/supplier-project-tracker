-- Project Templates
-- Create reusable templates with milestones and activities for quick project setup

PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- Project templates table
CREATE TABLE project_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Template milestones (denormalized for simplicity)
CREATE TABLE project_template_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES project_templates(id) ON DELETE CASCADE
);

CREATE INDEX idx_template_milestones_template ON project_template_milestones(template_id);

-- Template activities (references activity_template_id, not duplicating data)
CREATE TABLE project_template_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  activity_template_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES project_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id) ON DELETE CASCADE,
  UNIQUE(template_id, activity_template_id)
);

CREATE INDEX idx_template_activities_template ON project_template_activities(template_id);

COMMIT;
PRAGMA foreign_keys=on;
