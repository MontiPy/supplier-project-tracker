-- Applicability rules for activity templates (PA/NMR based)
CREATE TABLE activity_template_applicability_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_template_id INTEGER NOT NULL,
  operator TEXT NOT NULL DEFAULT 'ALL' CHECK(operator IN ('ALL', 'ANY')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id) ON DELETE CASCADE
);

CREATE TABLE activity_template_applicability_clauses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('SUPPLIER_NMR', 'PART_PA')),
  comparator TEXT NOT NULL CHECK(comparator IN ('IN', 'NOT_IN', 'EQ', 'NEQ', 'GTE', 'LTE')),
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rule_id) REFERENCES activity_template_applicability_rules(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_template_rules_template
  ON activity_template_applicability_rules(activity_template_id);
CREATE INDEX idx_activity_template_rule_clauses_rule
  ON activity_template_applicability_clauses(rule_id);
