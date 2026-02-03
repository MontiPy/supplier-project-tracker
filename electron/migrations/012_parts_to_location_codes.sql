-- Migration 012: Link parts to supplier_location_codes instead of supplier_projects
-- This enables parts to be associated with specific supplier locations

-- Step 1: Add new foreign key column to parts (nullable initially for data migration)
ALTER TABLE parts ADD COLUMN supplier_location_code_id INTEGER REFERENCES supplier_location_codes(id) ON DELETE CASCADE;

-- Step 2: Create index for new FK
CREATE INDEX idx_parts_supplier_location_code ON parts(supplier_location_code_id);

-- Step 3: Migrate existing parts data
-- For each part, create or find a default location code for its supplier_project

-- First, create a temporary mapping of supplier_project_id to a default location code
-- We'll create a default location code for each supplier if one doesn't exist
WITH supplier_project_suppliers AS (
  SELECT DISTINCT
    sp.id AS supplier_project_id,
    sp.supplier_id,
    s.name AS supplier_name
  FROM supplier_projects sp
  JOIN suppliers s ON s.id = sp.supplier_id
  WHERE sp.id IN (SELECT DISTINCT supplier_project_id FROM parts)
)
INSERT OR IGNORE INTO supplier_location_codes (supplier_id, supplier_number, location_code)
SELECT
  supplier_id,
  'DEFAULT',
  'DEFAULT'
FROM supplier_project_suppliers;

-- Step 4: Update all existing parts to reference the default location code
UPDATE parts
SET supplier_location_code_id = (
  SELECT slc.id
  FROM supplier_projects sp
  JOIN supplier_location_codes slc ON slc.supplier_id = sp.supplier_id
  WHERE sp.id = parts.supplier_project_id
    AND slc.supplier_number = 'DEFAULT'
    AND slc.location_code = 'DEFAULT'
  LIMIT 1
)
WHERE supplier_location_code_id IS NULL;

-- Step 5: Verify all parts have been migrated
-- If any parts still have NULL supplier_location_code_id, the migration failed
-- Note: We keep supplier_project_id for now to maintain backward compatibility
-- It can be removed in a future migration after confirming all integrations work

-- Step 6: Update the unique constraint to use the new relationship
-- Drop the old unique constraint on (supplier_project_id, part_number)
-- Create new unique constraint on (supplier_location_code_id, part_number)
-- Note: SQLite doesn't support DROP CONSTRAINT directly, so we need to recreate the table

-- Create new parts table with updated constraints
CREATE TABLE parts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_project_id INTEGER NOT NULL,
  supplier_location_code_id INTEGER NOT NULL,
  part_number TEXT NOT NULL,
  description TEXT,
  pa_rank TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_project_id) REFERENCES supplier_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_location_code_id) REFERENCES supplier_location_codes(id) ON DELETE CASCADE,
  UNIQUE(supplier_location_code_id, part_number)
);

-- Copy data from old table
INSERT INTO parts_new (id, supplier_project_id, supplier_location_code_id, part_number, description, pa_rank, notes, created_at)
SELECT id, supplier_project_id, supplier_location_code_id, part_number, description, pa_rank, notes, created_at
FROM parts;

-- Drop old table and rename new one
DROP TABLE parts;
ALTER TABLE parts_new RENAME TO parts;

-- Recreate indexes
CREATE INDEX idx_parts_supplier_project ON parts(supplier_project_id);
CREATE INDEX idx_parts_supplier_location_code ON parts(supplier_location_code_id);
