-- Activity and schedule item dependencies
CREATE TABLE project_activity_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_activity_id INTEGER NOT NULL,
  depends_on_project_activity_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_activity_id) REFERENCES project_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_project_activity_id) REFERENCES project_activities(id) ON DELETE CASCADE,
  UNIQUE(project_activity_id, depends_on_project_activity_id)
);

CREATE TABLE project_schedule_item_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_schedule_item_id INTEGER NOT NULL,
  depends_on_item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_schedule_item_id) REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_item_id) REFERENCES project_schedule_items(id) ON DELETE CASCADE,
  UNIQUE(project_schedule_item_id, depends_on_item_id)
);

-- Attachments/links for supplier activity instances
CREATE TABLE supplier_activity_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_activity_instance_id INTEGER NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_activity_instance_id) REFERENCES supplier_activity_instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_activity_dependencies_activity
  ON project_activity_dependencies(project_activity_id);
CREATE INDEX idx_project_schedule_item_dependencies_item
  ON project_schedule_item_dependencies(project_schedule_item_id);
CREATE INDEX idx_supplier_activity_attachments_instance
  ON supplier_activity_attachments(supplier_activity_instance_id);
