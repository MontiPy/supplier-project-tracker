-- Activity template version tracking for sync detection
-- Track when templates change to show "out of sync" indicators

-- Add version tracking columns to project_activities
ALTER TABLE project_activities ADD COLUMN template_version INTEGER DEFAULT 1;

-- Backfill existing project activities
UPDATE project_activities SET template_version = 1 WHERE template_version IS NULL;

-- Create version tracking table for templates
CREATE TABLE IF NOT EXISTS activity_template_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_template_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id) ON DELETE CASCADE
);

-- Backfill existing templates with version 1
INSERT INTO activity_template_versions (activity_template_id, version_number)
SELECT id, 1 FROM activity_templates;

-- Add settings for auto-propagation
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('auto_propagate_template_changes', 'false'),
  ('auto_propagate_to_suppliers', 'false');
