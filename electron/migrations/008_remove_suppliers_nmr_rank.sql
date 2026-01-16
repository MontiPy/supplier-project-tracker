-- Remove obsolete suppliers.nmr_rank column
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

CREATE TABLE suppliers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO suppliers_new (id, name, notes, created_at)
SELECT id, name, notes, created_at
FROM suppliers;

DROP TABLE suppliers;
ALTER TABLE suppliers_new RENAME TO suppliers;

COMMIT;
PRAGMA foreign_keys=on;
