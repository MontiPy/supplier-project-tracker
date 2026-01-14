-- Settings table for system configuration
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('nmr_ranks', '["A1","A2","B1","B2","C1"]'),
  ('pa_ranks', '["Critical","High","Medium","Low"]'),
  ('propagation_skip_complete', 'true'),
  ('propagation_skip_locked', 'true'),
  ('propagation_skip_overridden', 'true'),
  ('date_format', 'MM/DD/YYYY'),
  ('use_business_days', 'false');

-- Add category and updated_at columns to activity_templates
ALTER TABLE activity_templates ADD COLUMN category TEXT;
ALTER TABLE activity_templates ADD COLUMN updated_at TEXT;

-- Update existing rows to have updated_at set to created_at
UPDATE activity_templates SET updated_at = created_at WHERE updated_at IS NULL;
