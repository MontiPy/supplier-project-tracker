-- Activity template schedule items and project-level overrides
CREATE TABLE activity_template_schedule_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_template_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('MILESTONE', 'TASK')),
  name TEXT NOT NULL,
  anchor_type TEXT NOT NULL CHECK(anchor_type IN ('FIXED_DATE', 'PROJECT_ANCHOR', 'SUPPLIER_ANCHOR', 'SCHEDULE_ITEM', 'COMPLETION')),
  anchor_ref_id INTEGER,
  offset_days INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (anchor_ref_id) REFERENCES activity_template_schedule_items(id)
);

ALTER TABLE project_schedule_items ADD COLUMN template_item_id INTEGER;
ALTER TABLE project_schedule_items ADD COLUMN override_date TEXT;
ALTER TABLE project_schedule_items ADD COLUMN override_enabled INTEGER NOT NULL DEFAULT 0;
