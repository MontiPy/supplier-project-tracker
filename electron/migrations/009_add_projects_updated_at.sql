-- Add updated_at column to projects
ALTER TABLE projects ADD COLUMN updated_at TEXT;

-- Backfill existing rows
UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL;
