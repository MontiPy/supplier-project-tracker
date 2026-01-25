-- Add supplier number/location code tracking
CREATE TABLE supplier_location_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  supplier_number TEXT NOT NULL,
  location_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  UNIQUE (supplier_id, supplier_number, location_code)
);

CREATE INDEX idx_supplier_location_codes_supplier
  ON supplier_location_codes(supplier_id);
