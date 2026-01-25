-- Remove project/supplier anchor dates and anchor types
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- Preserve supplier-specific planned dates that depended on supplier anchors
UPDATE supplier_schedule_item_instances
SET planned_date_override = 1
WHERE project_schedule_item_id IN (
  SELECT id FROM project_schedule_items WHERE anchor_type = 'SUPPLIER_ANCHOR'
);

-- Rebuild activity_template_schedule_items without PROJECT_ANCHOR/SUPPLIER_ANCHOR
CREATE TABLE activity_template_schedule_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_template_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('MILESTONE', 'TASK')),
  name TEXT NOT NULL,
  anchor_type TEXT NOT NULL CHECK(anchor_type IN ('FIXED_DATE', 'SCHEDULE_ITEM', 'COMPLETION')),
  anchor_ref_id INTEGER,
  offset_days INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (anchor_ref_id) REFERENCES activity_template_schedule_items_new(id)
);

INSERT INTO activity_template_schedule_items_new (
  id,
  activity_template_id,
  kind,
  name,
  anchor_type,
  anchor_ref_id,
  offset_days,
  created_at
)
SELECT
  id,
  activity_template_id,
  kind,
  name,
  CASE
    WHEN anchor_type IN ('PROJECT_ANCHOR', 'SUPPLIER_ANCHOR') THEN 'FIXED_DATE'
    ELSE anchor_type
  END,
  CASE
    WHEN anchor_type IN ('PROJECT_ANCHOR', 'SUPPLIER_ANCHOR') THEN NULL
    ELSE anchor_ref_id
  END,
  CASE
    WHEN anchor_type IN ('PROJECT_ANCHOR', 'SUPPLIER_ANCHOR') THEN NULL
    ELSE offset_days
  END,
  created_at
FROM activity_template_schedule_items;

DROP TABLE activity_template_schedule_items;
ALTER TABLE activity_template_schedule_items_new RENAME TO activity_template_schedule_items;

-- Rebuild project_schedule_items without PROJECT_ANCHOR/SUPPLIER_ANCHOR
CREATE TABLE project_schedule_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_activity_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('MILESTONE', 'TASK')),
  name TEXT NOT NULL,
  anchor_type TEXT NOT NULL CHECK(anchor_type IN ('FIXED_DATE', 'SCHEDULE_ITEM', 'COMPLETION')),
  anchor_ref_id INTEGER,
  offset_days INTEGER,
  fixed_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  template_item_id INTEGER,
  override_date TEXT,
  override_enabled INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project_activity_id) REFERENCES project_activities(id) ON DELETE CASCADE,
  FOREIGN KEY (anchor_ref_id) REFERENCES project_schedule_items_new(id)
);

INSERT INTO project_schedule_items_new (
  id,
  project_activity_id,
  kind,
  name,
  anchor_type,
  anchor_ref_id,
  offset_days,
  fixed_date,
  sort_order,
  created_at,
  template_item_id,
  override_date,
  override_enabled
)
SELECT
  psi.id,
  psi.project_activity_id,
  psi.kind,
  psi.name,
  CASE
    WHEN psi.anchor_type IN ('PROJECT_ANCHOR', 'SUPPLIER_ANCHOR') THEN 'FIXED_DATE'
    ELSE psi.anchor_type
  END,
  CASE
    WHEN psi.anchor_type IN ('PROJECT_ANCHOR', 'SUPPLIER_ANCHOR') THEN NULL
    ELSE psi.anchor_ref_id
  END,
  CASE
    WHEN psi.anchor_type IN ('PROJECT_ANCHOR', 'SUPPLIER_ANCHOR') THEN NULL
    ELSE psi.offset_days
  END,
  CASE
    WHEN psi.anchor_type = 'PROJECT_ANCHOR' THEN
      CASE
        WHEN p.project_anchor_date IS NULL THEN NULL
        WHEN psi.offset_days IS NULL THEN p.project_anchor_date
        ELSE date(p.project_anchor_date, printf('%+d days', psi.offset_days))
      END
    WHEN psi.anchor_type = 'SUPPLIER_ANCHOR' THEN NULL
    ELSE psi.fixed_date
  END,
  psi.sort_order,
  psi.created_at,
  psi.template_item_id,
  psi.override_date,
  psi.override_enabled
FROM project_schedule_items psi
JOIN project_activities pa ON pa.id = psi.project_activity_id
JOIN projects p ON p.id = pa.project_id;

DROP TABLE project_schedule_items;
ALTER TABLE project_schedule_items_new RENAME TO project_schedule_items;

-- Rebuild projects without project_anchor_date
CREATE TABLE projects_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  default_anchor_rule TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

INSERT INTO projects_new (id, name, version, default_anchor_rule, created_at, updated_at)
SELECT id, name, version, default_anchor_rule, created_at, updated_at
FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

-- Rebuild supplier_projects without supplier_anchor_date
CREATE TABLE supplier_projects_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  project_version TEXT NOT NULL,
  supplier_project_nmr_rank TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

INSERT INTO supplier_projects_new (
  id,
  supplier_id,
  project_id,
  project_version,
  supplier_project_nmr_rank,
  created_at
)
SELECT
  id,
  supplier_id,
  project_id,
  project_version,
  supplier_project_nmr_rank,
  created_at
FROM supplier_projects;

DROP TABLE supplier_projects;
ALTER TABLE supplier_projects_new RENAME TO supplier_projects;

-- Recreate indexes dropped during table rebuilds
CREATE INDEX idx_project_schedule_items_activity ON project_schedule_items(project_activity_id);
CREATE INDEX idx_supplier_projects_supplier ON supplier_projects(supplier_id);
CREATE INDEX idx_supplier_projects_project ON supplier_projects(project_id);

COMMIT;
PRAGMA foreign_keys=on;
