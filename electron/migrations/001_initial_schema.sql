-- Initial Schema for Supplier-Project-Activity Tracking Application
-- Phase 1: Core entities and relationships

-- Core Entities
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nmr_rank TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE activity_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  default_anchor_rule TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Project Structure
CREATE TABLE project_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  activity_template_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id)
);

CREATE TABLE project_schedule_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_activity_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('MILESTONE', 'TASK')),
  name TEXT NOT NULL,
  anchor_type TEXT NOT NULL CHECK(anchor_type IN ('FIXED_DATE', 'PROJECT_ANCHOR', 'SUPPLIER_ANCHOR', 'SCHEDULE_ITEM', 'COMPLETION')),
  anchor_ref_id INTEGER,
  offset_days INTEGER,
  fixed_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_activity_id) REFERENCES project_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (anchor_ref_id) REFERENCES project_schedule_items(id)
);

-- Supplier Instances
CREATE TABLE supplier_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  project_version TEXT NOT NULL,
  supplier_anchor_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE supplier_activity_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_project_id INTEGER NOT NULL,
  project_activity_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK(status IN ('Not Started', 'In Progress', 'Blocked', 'Complete', 'Not Required')),
  scope_override TEXT CHECK(scope_override IN ('REQUIRED', 'NOT_REQUIRED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_project_id) REFERENCES supplier_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_activity_id) REFERENCES project_activities(id)
);

CREATE TABLE supplier_schedule_item_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_activity_instance_id INTEGER NOT NULL,
  project_schedule_item_id INTEGER NOT NULL,
  planned_date TEXT,
  actual_date TEXT,
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK(status IN ('Not Started', 'In Progress', 'Blocked', 'Complete', 'Not Required')),
  planned_date_override INTEGER NOT NULL DEFAULT 0,
  scope_override TEXT CHECK(scope_override IN ('REQUIRED', 'NOT_REQUIRED')),
  locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_activity_instance_id) REFERENCES supplier_activity_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (project_schedule_item_id) REFERENCES project_schedule_items(id)
);

-- Parts
CREATE TABLE parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_project_id INTEGER NOT NULL,
  part_number TEXT NOT NULL,
  description TEXT,
  pa_rank TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_project_id) REFERENCES supplier_projects(id) ON DELETE CASCADE,
  UNIQUE(supplier_project_id, part_number)
);

-- Audit Log
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX idx_project_activities_project ON project_activities(project_id);
CREATE INDEX idx_project_schedule_items_activity ON project_schedule_items(project_activity_id);
CREATE INDEX idx_supplier_projects_supplier ON supplier_projects(supplier_id);
CREATE INDEX idx_supplier_projects_project ON supplier_projects(project_id);
CREATE INDEX idx_supplier_activity_instances_supplier_project ON supplier_activity_instances(supplier_project_id);
CREATE INDEX idx_supplier_schedule_item_instances_activity ON supplier_schedule_item_instances(supplier_activity_instance_id);
CREATE INDEX idx_parts_supplier_project ON parts(supplier_project_id);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
