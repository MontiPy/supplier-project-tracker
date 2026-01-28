/**
 * Duplicate detection and matching logic for imports
 */

import { queryOne, toCamelCase } from '../database';
import type { MatchResult, MatchStatus } from '@shared/types';

/**
 * Map entity type to database table name
 */
function getTableName(entityType: string): string {
  const tableMap: Record<string, string> = {
    supplier: 'suppliers',
    supplier_location_code: 'supplier_location_codes',
    activity_template: 'activity_templates',
    project: 'projects',
    project_activity: 'project_activities',
    project_schedule_item: 'project_schedule_items',
    supplier_project: 'supplier_projects',
    supplier_activity_instance: 'supplier_activity_instances',
    supplier_schedule_item_instance: 'supplier_schedule_item_instances',
    part: 'parts',
  };
  return tableMap[entityType] || entityType;
}

/**
 * Generate match key for an entity based on natural keys
 */
export function generateMatchKey(entityType: string, data: any): string {
  switch (entityType) {
    case 'supplier':
      return `supplier:${data.name}`;

    case 'supplier_location_code':
      return `location:${data.supplierName}/${data.supplierNumber}/${data.locationCode}`;

    case 'activity_template':
      return `template:${data.name}`;

    case 'project':
      return `project:${data.name}/${data.version}`;

    case 'project_activity':
      return `proj_activity:${data.projectName}/${data.projectVersion}/${data.activityTemplateName}`;

    case 'project_schedule_item':
      return `proj_item:${data.projectName}/${data.projectVersion}/${data.activityTemplateName}/${data.name}`;

    case 'supplier_project':
      return `supplier_project:${data.supplierName}/${data.projectName}/${data.projectVersion}`;

    case 'supplier_activity_instance':
      return `supplier_activity:${data.supplierName}/${data.projectName}/${data.projectVersion}/${data.activityTemplateName}`;

    case 'supplier_schedule_item_instance':
      return `supplier_item:${data.supplierName}/${data.projectName}/${data.projectVersion}/${data.activityTemplateName}/${data.name}`;

    case 'part':
      return `part:${data.supplierName}/${data.projectName}/${data.projectVersion}/${data.supplierNumber}/${data.locationCode}/${data.partNumber}`;

    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Find existing entity by match key
 * Prefers ID-based matching when ID is present in import data (for re-imports)
 * Falls back to natural key matching for external imports
 */
export function findExistingEntity(entityType: string, _matchKey: string, data: any): any | null {
  try {
    // Try ID-based matching first if ID is present (re-import from same database)
    if (data.id !== undefined && data.id !== null) {
      const byId = queryOne(`SELECT * FROM ${getTableName(entityType)} WHERE id = ?`, [data.id]);
      if (byId) {
        return toCamelCase(byId);
      }
    }

    // Fall back to natural key matching (external imports or ID not found)
    let result: any = null;
    switch (entityType) {
      case 'supplier':
        result = queryOne('SELECT * FROM suppliers WHERE name = ?', [data.name]);
        break;

      case 'supplier_location_code':
        result = queryOne(
          `SELECT slc.* FROM supplier_location_codes slc
           JOIN suppliers s ON s.id = slc.supplier_id
           WHERE s.name = ? AND slc.supplier_number = ? AND slc.location_code = ?`,
          [data.supplierName, data.supplierNumber, data.locationCode]
        );
        break;

      case 'activity_template':
        result = queryOne('SELECT * FROM activity_templates WHERE name = ?', [data.name]);
        break;

      case 'project':
        result = queryOne('SELECT * FROM projects WHERE name = ? AND version = ?', [data.name, data.version]);
        break;

      case 'project_activity':
        result = queryOne(
          `SELECT pa.* FROM project_activities pa
           JOIN projects p ON p.id = pa.project_id
           JOIN activity_templates at ON at.id = pa.activity_template_id
           WHERE p.name = ? AND p.version = ? AND at.name = ?`,
          [data.projectName, data.projectVersion, data.activityTemplateName]
        );
        break;

      case 'project_schedule_item':
        result = queryOne(
          `SELECT psi.* FROM project_schedule_items psi
           JOIN project_activities pa ON pa.id = psi.project_activity_id
           JOIN projects p ON p.id = pa.project_id
           JOIN activity_templates at ON at.id = pa.activity_template_id
           WHERE p.name = ? AND p.version = ? AND at.name = ? AND psi.name = ?`,
          [data.projectName, data.projectVersion, data.activityTemplateName, data.name]
        );
        break;

      case 'supplier_project':
        result = queryOne(
          `SELECT sp.* FROM supplier_projects sp
           JOIN suppliers s ON s.id = sp.supplier_id
           JOIN projects p ON p.id = sp.project_id
           WHERE s.name = ? AND p.name = ? AND p.version = ?`,
          [data.supplierName, data.projectName, data.projectVersion]
        );
        break;

      case 'supplier_activity_instance':
        result = queryOne(
          `SELECT sai.* FROM supplier_activity_instances sai
           JOIN supplier_projects sp ON sp.id = sai.supplier_project_id
           JOIN suppliers s ON s.id = sp.supplier_id
           JOIN projects p ON p.id = sp.project_id
           JOIN project_activities pa ON pa.id = sai.project_activity_id
           JOIN activity_templates at ON at.id = pa.activity_template_id
           WHERE s.name = ? AND p.name = ? AND p.version = ? AND at.name = ?`,
          [data.supplierName, data.projectName, data.projectVersion, data.activityTemplateName]
        );
        break;

      case 'supplier_schedule_item_instance':
        result = queryOne(
          `SELECT ssii.* FROM supplier_schedule_item_instances ssii
           JOIN supplier_activity_instances sai ON sai.id = ssii.supplier_activity_instance_id
           JOIN supplier_projects sp ON sp.id = sai.supplier_project_id
           JOIN suppliers s ON s.id = sp.supplier_id
           JOIN projects p ON p.id = sp.project_id
           JOIN project_activities pa ON pa.id = sai.project_activity_id
           JOIN activity_templates at ON at.id = pa.activity_template_id
           JOIN project_schedule_items psi ON psi.id = ssii.project_schedule_item_id
           WHERE s.name = ? AND p.name = ? AND p.version = ? AND at.name = ? AND psi.name = ?`,
          [data.supplierName, data.projectName, data.projectVersion, data.activityTemplateName, data.name]
        );
        break;

      case 'part':
        result = queryOne(
          `SELECT parts.* FROM parts
           JOIN supplier_location_codes slc ON slc.id = parts.supplier_location_code_id
           JOIN supplier_projects sp ON sp.id = parts.supplier_project_id
           JOIN suppliers s ON s.id = sp.supplier_id
           JOIN projects p ON p.id = sp.project_id
           WHERE s.name = ? AND p.name = ? AND p.version = ?
             AND slc.supplier_number = ? AND slc.location_code = ?
             AND parts.part_number = ?`,
          [
            data.supplierName,
            data.projectName,
            data.projectVersion,
            data.supplierNumber,
            data.locationCode,
            data.partNumber,
          ]
        );
        break;

      default:
        result = null;
        break;
    }

    // Convert snake_case database columns to camelCase before returning
    return result ? toCamelCase(result) : null;
  } catch (error) {
    console.error(`Error finding existing ${entityType}:`, error);
    return null;
  }
}

/**
 * Fields used for natural key matching but not stored as columns in database
 * These are denormalized reference fields and should not be compared
 */
const REFERENCE_FIELDS = new Set([
  'projectName',
  'projectVersion',
  'activityTemplateName',
  'supplierName',
  'supplierNumber',
  'locationCode',
  'partNumber',
]);

/**
 * Compare two entities and determine if they're identical or modified
 */
export function compareEntities(_entityType: string, existing: any, incoming: any): MatchStatus {
  // For now, do a simple field-by-field comparison
  // In the future, we could have entity-specific comparison logic

  // Only compare fields that exist in the INCOMING data (not database-only fields)
  // Exclude:
  // - 'id' (used for matching)
  // - 'created_at' (auto-generated)
  // - Reference fields used for natural key matching but not actual DB columns
  const incomingKeys = Object.keys(incoming).filter(
    (k) => !['id', 'created_at'].includes(k) && !REFERENCE_FIELDS.has(k)
  );

  // Check if any field has changed
  for (const key of incomingKeys) {
    const existingValue = existing[key];
    const incomingValue = incoming[key];

    // Handle null/undefined equivalence
    if (existingValue !== incomingValue) {
      if (!(existingValue == null && incomingValue == null)) {
        return 'MODIFIED';
      }
    }
  }

  return 'UNCHANGED';
}

/**
 * Get detailed changes between two entities
 */
export function getEntityChanges(
  existing: any,
  incoming: any
): Array<{ field: string; oldValue: any; newValue: any }> {
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // Only compare fields that exist in the INCOMING data (ignore database-only fields)
  // Exclude reference fields used for matching but not actual DB columns
  const incomingKeys = Object.keys(incoming).filter(
    (k) => !['id', 'created_at'].includes(k) && !REFERENCE_FIELDS.has(k)
  );

  for (const key of incomingKeys) {
    const existingValue = existing[key];
    const incomingValue = incoming[key];

    if (existingValue !== incomingValue) {
      if (!(existingValue == null && incomingValue == null)) {
        changes.push({
          field: key,
          oldValue: existingValue,
          newValue: incomingValue,
        });
      }
    }
  }

  return changes;
}

/**
 * Match a single entity against the database
 */
export function matchEntity(entityType: string, incomingData: any): MatchResult {
  const matchKey = generateMatchKey(entityType, incomingData);
  const existing = findExistingEntity(entityType, matchKey, incomingData);

  if (!existing) {
    return {
      matchKey,
      status: 'NEW',
      entityType,
      incomingData,
    };
  }

  const status = compareEntities(entityType, existing, incomingData);

  if (status === 'UNCHANGED') {
    return {
      matchKey,
      status: 'UNCHANGED',
      entityType,
      existingId: existing.id,
      incomingData,
      existingData: existing,
    };
  }

  // MODIFIED
  const changes = getEntityChanges(existing, incomingData);

  return {
    matchKey,
    status: 'MODIFIED',
    entityType,
    existingId: existing.id,
    incomingData,
    existingData: existing,
    changes,
  };
}
