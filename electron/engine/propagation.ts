import { query, queryOne, run, toCamelCase } from '../database.js';
import { calculateScheduleDates } from '../scheduler.js';
import type {
  PropagationPreview,
  PropagationResult,
  PropagationChange,
  SupplierScheduleItemInstance,
  ProjectScheduleItem,
} from '../../shared/types.js';

// ============================================================================
// Propagation Engine - Phase 4
// ============================================================================

interface PropagationPolicy {
  skipComplete: boolean;
  skipLocked: boolean;
  skipOverridden: boolean;
  useBusinessDays: boolean;
}

function getPropagationPolicy(): PropagationPolicy {
  const settings = query(
    `SELECT key, value FROM settings
     WHERE key IN ('propagation_skip_complete', 'propagation_skip_locked', 'propagation_skip_overridden', 'use_business_days')`
  );
  const settingsMap: Record<string, string> = {};
  for (const setting of settings) {
    settingsMap[(setting as any).key] = (setting as any).value;
  }

  const skipComplete =
    settingsMap['propagation_skip_complete'] !== undefined
      ? settingsMap['propagation_skip_complete'] === 'true'
      : true;
  const skipLocked =
    settingsMap['propagation_skip_locked'] !== undefined
      ? settingsMap['propagation_skip_locked'] === 'true'
      : true;
  const skipOverridden =
    settingsMap['propagation_skip_overridden'] !== undefined
      ? settingsMap['propagation_skip_overridden'] === 'true'
      : true;
  const useBusinessDays =
    settingsMap['use_business_days'] !== undefined
      ? settingsMap['use_business_days'] === 'true'
      : false;

  return {
    skipComplete,
    skipLocked,
    skipOverridden,
    useBusinessDays,
  };
}

/**
 * Check if an instance should receive propagated changes
 *
 * DO NOT propagate if:
 * - locked === true
 * - plannedDateOverride === true
 * - status === 'Complete'
 *
 * OTHERWISE: propagate
 */
export function shouldPropagateToInstance(
  instance: SupplierScheduleItemInstance,
  policy: PropagationPolicy
): boolean {
  // Don't propagate if locked
  if (policy.skipLocked && instance.locked) {
    return false;
  }

  // Don't propagate if manually overridden
  if (policy.skipOverridden && instance.plannedDateOverride) {
    return false;
  }

  // Don't propagate if complete (optional policy - can be configured)
  if (policy.skipComplete && instance.status === 'Complete') {
    return false;
  }

  return true;
}

/**
 * Get reason why an instance won't be propagated
 */
function getSkipReason(instance: SupplierScheduleItemInstance, policy: PropagationPolicy): string {
  if (policy.skipLocked && instance.locked) {
    return 'Locked';
  }
  if (policy.skipOverridden && instance.plannedDateOverride) {
    return 'Manually overridden';
  }
  if (policy.skipComplete && instance.status === 'Complete') {
    return 'Already complete';
  }
  return 'Unknown';
}

/**
 * Calculate what would change if propagation is applied
 * Returns preview showing affected instances
 */
export function previewPropagation(projectId: number): PropagationPreview {
  // 1. Get project info
  const project = queryOne(
    'SELECT id, name FROM projects WHERE id = ?',
    [projectId]
  );

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // 2. Get all supplier projects for this project
  const supplierProjects = query(
    `SELECT sp.id, sp.supplier_id, sp.supplier_anchor_date, s.name as supplier_name
     FROM supplier_projects sp
     JOIN suppliers s ON s.id = sp.supplier_id
     WHERE sp.project_id = ?`,
    [projectId]
  );

  const willChange: PropagationChange[] = [];
  const wontChange: PropagationChange[] = [];
  const policy = getPropagationPolicy();

  // 3. For each supplier project
  for (const sp of supplierProjects) {
    // Get all schedule item instances for this supplier project
    const instances = query(
      `SELECT
        ssi.id as instance_id,
        ssi.planned_date as current_planned_date,
        ssi.actual_date as actual_date,
        ssi.status,
        ssi.locked,
        ssi.planned_date_override,
        psi.id as project_schedule_item_id,
        psi.name as schedule_item_name,
        at.name as activity_name,
        pa.id as project_activity_id
       FROM supplier_schedule_item_instances ssi
       JOIN supplier_activity_instances sai ON sai.id = ssi.supplier_activity_instance_id
       JOIN project_schedule_items psi ON psi.id = ssi.project_schedule_item_id
       JOIN project_activities pa ON pa.id = psi.project_activity_id
       JOIN activity_templates at ON at.id = pa.activity_template_id
       WHERE sai.supplier_project_id = ?
       ORDER BY pa.sort_order, psi.sort_order`,
      [sp.id]
    );

    // Get all project schedule items for recalculation
    const projectScheduleItems = query<ProjectScheduleItem>(
      `SELECT psi.* FROM project_schedule_items psi
       JOIN project_activities pa ON pa.id = psi.project_activity_id
       WHERE pa.project_id = ?`,
      [projectId]
    );

    // Get project anchor date
    const projectAnchorDate = queryOne(
      'SELECT project_anchor_date FROM projects WHERE id = ?',
      [projectId]
    );

    const actualDates = new Map(
      instances.map((item: any) => [item.project_schedule_item_id, item.actual_date || null])
    );

    // Recalculate all dates
    const recalculated = calculateScheduleDates(
      toCamelCase<ProjectScheduleItem[]>(projectScheduleItems),
      projectAnchorDate?.project_anchor_date || undefined,
      sp.supplier_anchor_date || undefined,
      policy.useBusinessDays,
      actualDates
    );

    // Create lookup map for recalculated dates
    const recalculatedMap = new Map(
      recalculated.map(item => [item.id, item.plannedDate])
    );

    // 4. Compare current vs recalculated dates
    for (const inst of instances) {
      const instance = toCamelCase<SupplierScheduleItemInstance>({
        id: inst.instance_id,
        supplierActivityInstanceId: 0, // Not needed for check
        projectScheduleItemId: inst.project_schedule_item_id,
        plannedDate: inst.current_planned_date,
        actualDate: null,
        status: inst.status,
        plannedDateOverride: Boolean(inst.planned_date_override),
        scopeOverride: null,
        locked: Boolean(inst.locked),
        createdAt: '',
      });

      const newPlannedDate = recalculatedMap.get(inst.project_schedule_item_id) || null;
      const currentPlannedDate = inst.current_planned_date;

      const change: PropagationChange = {
        supplierScheduleItemInstanceId: inst.instance_id,
        supplierName: sp.supplier_name,
        projectName: project.name,
        activityName: inst.activity_name,
        scheduleItemName: inst.schedule_item_name,
        currentPlannedDate,
        newPlannedDate,
      };

      // Check if this instance should be propagated
      if (shouldPropagateToInstance(instance, policy)) {
        // Only include if date actually changes
        if (currentPlannedDate !== newPlannedDate) {
          willChange.push(change);
        }
      } else {
        // Instance is protected
        change.reason = getSkipReason(instance, policy);
        wontChange.push(change);
      }
    }
  }

  return {
    projectId,
    projectName: project.name,
    supplierCount: supplierProjects.length,
    willChange,
    wontChange,
  };
}

/**
 * Apply propagation to all supplier instances
 * Respects locks and overrides
 */
export function propagateChanges(
  projectId: number,
  dryRun: boolean = false
): PropagationResult {
  // 1. Get preview of changes
  const preview = previewPropagation(projectId);

  const updated: PropagationChange[] = [];
  const skipped: PropagationChange[] = preview.wontChange;
  const errors: string[] = [];

  // 2. Apply changes (unless dry run)
  if (!dryRun) {
    for (const change of preview.willChange) {
      try {
        // Update the planned_date for this instance
        run(
          `UPDATE supplier_schedule_item_instances
           SET planned_date = ?
           WHERE id = ?`,
          [change.newPlannedDate, change.supplierScheduleItemInstanceId]
        );

        updated.push(change);
      } catch (error) {
        errors.push(
          `Failed to update instance ${change.supplierScheduleItemInstanceId}: ${String(error)}`
        );
      }
    }
  } else {
    // Dry run: all changes would be applied
    updated.push(...preview.willChange);
  }

  return {
    updated,
    skipped,
    errors,
  };
}
