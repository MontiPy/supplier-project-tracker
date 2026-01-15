import { app, dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  query,
  queryOne,
  run,
  toCamelCase,
  getDatabasePath,
  runMigrations,
  saveDatabase,
  closeDatabase,
} from './database.js';
import { calculateScheduleDates, validateScheduleItems } from './scheduler.js';
import { previewPropagation, propagateChanges } from './engine/propagation.js';
import type {
  Supplier,
  ActivityTemplate,
  Project,
  ProjectActivity,
  ProjectScheduleItem,
  CreateSupplierParams,
  UpdateSupplierParams,
  CreateActivityTemplateParams,
  UpdateActivityTemplateParams,
  CreateProjectParams,
  UpdateProjectParams,
  ApplySupplierProjectParams,
  UpdateSupplierProjectParams,
  CreateProjectActivityParams,
  UpdateProjectActivityParams,
  CreateScheduleItemParams,
  UpdateScheduleItemParams,
  CreateActivityTemplateScheduleItemParams,
  UpdateActivityTemplateScheduleItemParams,
  UpsertActivityTemplateApplicabilityRuleParams,
  CreateActivityTemplateApplicabilityClauseParams,
  UpdateActivityTemplateApplicabilityClauseParams,
  SyncProjectActivityFromTemplateParams,
  UpdateSupplierActivityInstanceParams,
  UpdateSupplierScheduleItemInstanceParams,
  CreateSupplierActivityAttachmentParams,
  ProjectActivityDetail,
  ProjectDetail,
  ScheduleItemWithDates,
  SupplierProject,
  SupplierProjectDetail,
  SupplierProjectSummary,
  SupplierProjectActivityDetail,
  SupplierScheduleItemDetail,
  SupplierActivityInstance,
  SupplierScheduleItemInstance,
  SupplierActivityAttachment,
  ActivityTemplateScheduleItem,
  ActivityTemplateApplicability,
  ActivityTemplateApplicabilityRule,
  ActivityTemplateApplicabilityClause,
  Part,
  CreatePartParams,
  UpdatePartParams,
  PropagationPreview,
  PropagationResult,
  AuditEvent,
  AuditEventQuery,
  APIResponse,
  // Phase 5: Settings, Dashboard, Reports
  AppSettings,
  UpdateSettingParams,
  DashboardFilters,
  DashboardData,
  DashboardSummary,
  ActionableItem,
  ReportsOverview,
  SupplierProgress,
  ProjectProgress,
  ReportScheduleItem,
  SupplierWithStats,
  ProjectWithStats,
  ActivityTemplateWithCounts,
  SupplierProjectWithProgress,
  FileDialogResult,
} from '../shared/types.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createSuccessResponse<T>(data: T): APIResponse<T> {
  return { success: true, data };
}

function createErrorResponse(error: string): APIResponse {
  return { success: false, error };
}

function formatVersionDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getProjectAnchorDateForActivity(projectActivityId: number): string | null {
  const result = queryOne<{ project_anchor_date: string | null }>(
    `SELECT p.project_anchor_date
     FROM projects p
     JOIN project_activities pa ON pa.project_id = p.id
     WHERE pa.id = ?`,
    [projectActivityId]
  );
  return result?.project_anchor_date ?? null;
}

function getUseBusinessDaysSetting(): boolean {
  const result = queryOne<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['use_business_days']
  );
  return result?.value === 'true';
}

function getPropagationSettings(): {
  skipComplete: boolean;
  skipLocked: boolean;
  skipOverridden: boolean;
} {
  const skipComplete = getSettingValue('propagation_skip_complete');
  const skipLocked = getSettingValue('propagation_skip_locked');
  const skipOverridden = getSettingValue('propagation_skip_overridden');
  return {
    skipComplete: skipComplete !== null ? skipComplete === 'true' : true,
    skipLocked: skipLocked !== null ? skipLocked === 'true' : true,
    skipOverridden: skipOverridden !== null ? skipOverridden === 'true' : true,
  };
}

function getSettingValue(key: string): string | null {
  const result = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return result?.value ?? null;
}

function parseSettingList(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    return [];
  }
  return [];
}

function getRankSettings(): { nmrRanks: string[]; paRanks: string[] } {
  return {
    nmrRanks: parseSettingList(getSettingValue('nmr_ranks')),
    paRanks: parseSettingList(getSettingValue('pa_ranks')),
  };
}

function parseComparatorValues(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      return [];
    }
  }
  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function compareWithComparator(
  subject: string | null,
  comparator: string,
  value: string,
  rankOrder: string[]
): boolean {
  if (!subject) {
    return false;
  }

  switch (comparator) {
    case 'EQ':
      return subject === value;
    case 'NEQ':
      return subject !== value;
    case 'IN': {
      const values = parseComparatorValues(value);
      return values.includes(subject);
    }
    case 'NOT_IN': {
      const values = parseComparatorValues(value);
      return !values.includes(subject);
    }
    case 'GTE':
    case 'LTE': {
      if (rankOrder.length > 0) {
        const subjectIndex = rankOrder.indexOf(subject);
        const valueIndex = rankOrder.indexOf(value);
        if (subjectIndex === -1 || valueIndex === -1) {
          return false;
        }
        return comparator === 'GTE' ? subjectIndex <= valueIndex : subjectIndex >= valueIndex;
      }
      const comparison = subject.localeCompare(value, undefined, { numeric: true });
      return comparator === 'GTE' ? comparison >= 0 : comparison <= 0;
    }
    default:
      return false;
  }
}

interface ApplicabilityContext {
  supplierNmrRank: string | null;
  partPaRanks: string[];
  nmrRanksOrder: string[];
  paRanksOrder: string[];
}

function evaluateApplicabilityRule(
  rule: { operator?: string },
  clauses: Array<{ subject_type: string; comparator: string; value: string }>,
  context: ApplicabilityContext
): boolean {
  if (clauses.length === 0) {
    return true;
  }

  const operator = rule.operator === 'ANY' ? 'ANY' : 'ALL';
  const evaluateClause = (clause: {
    subject_type: string;
    comparator: string;
    value: string;
  }): boolean => {
    if (clause.subject_type === 'SUPPLIER_NMR') {
      return compareWithComparator(
        context.supplierNmrRank,
        clause.comparator,
        clause.value,
        context.nmrRanksOrder
      );
    }
    if (clause.subject_type === 'PART_PA') {
      if (context.partPaRanks.length === 0) {
        return false;
      }
      return context.partPaRanks.some((rank) =>
        compareWithComparator(rank, clause.comparator, clause.value, context.paRanksOrder)
      );
    }
    return false;
  };

  if (operator === 'ANY') {
    return clauses.some((clause) => evaluateClause(clause));
  }

  return clauses.every((clause) => evaluateClause(clause));
}

function shouldIncludeActivity(activityTemplateId: number, context: ApplicabilityContext): boolean {
  const rules = query(
    'SELECT * FROM activity_template_applicability_rules WHERE activity_template_id = ?',
    [activityTemplateId]
  );

  if (rules.length === 0) {
    return true;
  }

  let hasEnabledRule = false;
  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }
    hasEnabledRule = true;
    const clauses = query<{ subject_type: string; comparator: string; value: string }>(
      'SELECT subject_type, comparator, value FROM activity_template_applicability_clauses WHERE rule_id = ?',
      [rule.id]
    );
    if (evaluateApplicabilityRule(rule, clauses, context)) {
      return true;
    }
  }

  return !hasEnabledRule;
}

function evaluateApplicabilityForSupplierProject(supplierProjectId: number): void {
  const supplierProject = queryOne(
    `SELECT sp.*, p.project_anchor_date
     FROM supplier_projects sp
     JOIN projects p ON sp.project_id = p.id
     WHERE sp.id = ?`,
    [supplierProjectId]
  );

  if (!supplierProject) {
    return;
  }

  const partRanks = query<{ pa_rank: string | null }>(
    'SELECT pa_rank FROM parts WHERE supplier_project_id = ?',
    [supplierProjectId]
  )
    .map((row) => row.pa_rank)
    .filter((rank): rank is string => Boolean(rank));

  const { nmrRanks, paRanks } = getRankSettings();
  const supplierNmrRank = supplierProject.supplier_project_nmr_rank ?? null;

  const context: ApplicabilityContext = {
    supplierNmrRank,
    partPaRanks: partRanks,
    nmrRanksOrder: nmrRanks,
    paRanksOrder: paRanks,
  };

  const projectActivities = query(
    'SELECT * FROM project_activities WHERE project_id = ? ORDER BY sort_order',
    [supplierProject.project_id]
  );

  for (const activity of projectActivities) {
    const instance = queryOne(
      'SELECT * FROM supplier_activity_instances WHERE supplier_project_id = ? AND project_activity_id = ?',
      [supplierProjectId, activity.id]
    );

    let include = shouldIncludeActivity(activity.activity_template_id, context);

    if (instance?.scope_override === 'REQUIRED') {
      include = true;
    }
    if (instance?.scope_override === 'NOT_REQUIRED') {
      include = false;
    }

    if (include) {
      if (!instance) {
        const insertResult = run(
          `INSERT INTO supplier_activity_instances
           (supplier_project_id, project_activity_id, status)
           VALUES (?, ?, ?)`,
          [supplierProjectId, activity.id, 'Not Started']
        );
        ensureSupplierScheduleItemsForActivity(
          insertResult.lastInsertRowid,
          activity.id,
          supplierProject.project_anchor_date,
          supplierProject.supplier_anchor_date
        );
      } else {
        if (instance.status === 'Not Required') {
          run('UPDATE supplier_activity_instances SET status = ? WHERE id = ?', [
            'Not Started',
            instance.id,
          ]);
        }
        ensureSupplierScheduleItemsForActivity(
          instance.id,
          activity.id,
          supplierProject.project_anchor_date,
          supplierProject.supplier_anchor_date
        );
      }
    } else {
      if (!instance) {
        run(
          `INSERT INTO supplier_activity_instances
           (supplier_project_id, project_activity_id, status)
           VALUES (?, ?, ?)`,
          [supplierProjectId, activity.id, 'Not Required']
        );
      } else if (instance.status !== 'Not Required') {
        run('UPDATE supplier_activity_instances SET status = ? WHERE id = ?', [
          'Not Required',
          instance.id,
        ]);
      }
    }
  }
}

function reapplyApplicabilityForTemplate(activityTemplateId: number): void {
  const supplierProjects = query<{ id: number }>(
    `SELECT DISTINCT sp.id
     FROM supplier_projects sp
     JOIN project_activities pa ON pa.project_id = sp.project_id
     WHERE pa.activity_template_id = ?`,
    [activityTemplateId]
  );
  for (const project of supplierProjects) {
    evaluateApplicabilityForSupplierProject(project.id);
  }
}

function ensureSupplierScheduleItemsForActivity(
  supplierActivityInstanceId: number,
  projectActivityId: number,
  projectAnchorDate: string | null,
  supplierAnchorDate: string | null
): void {
  const projectItemsRaw = query<ProjectScheduleItem>(
    'SELECT * FROM project_schedule_items WHERE project_activity_id = ? ORDER BY sort_order',
    [projectActivityId]
  );

  if (projectItemsRaw.length === 0) {
    return;
  }

  const existingItems = query<{ project_schedule_item_id: number; actual_date: string | null }>(
    `SELECT project_schedule_item_id, actual_date
     FROM supplier_schedule_item_instances
     WHERE supplier_activity_instance_id = ?`,
    [supplierActivityInstanceId]
  );
  const existingIds = new Set(existingItems.map((item) => item.project_schedule_item_id));
  const actualDates = new Map(
    existingItems.map((item) => [item.project_schedule_item_id, item.actual_date || null])
  );
  const missingItems = projectItemsRaw.filter((item: any) => !existingIds.has(item.id));

  if (missingItems.length === 0) {
    return;
  }

  const useBusinessDays = getUseBusinessDaysSetting();
  const itemsWithDates = calculateScheduleDates(
    toCamelCase<ProjectScheduleItem[]>(projectItemsRaw),
    projectAnchorDate || undefined,
    supplierAnchorDate || undefined,
    useBusinessDays,
    actualDates
  );
  const plannedDateById = new Map(itemsWithDates.map((item) => [item.id, item.plannedDate]));

  for (const missing of missingItems) {
    run(
      `INSERT INTO supplier_schedule_item_instances
       (supplier_activity_instance_id, project_schedule_item_id, planned_date)
       VALUES (?, ?, ?)`,
      [supplierActivityInstanceId, missing.id, plannedDateById.get(missing.id) || null]
    );
  }
}

function recalculateCompletionAnchorsForActivity(supplierActivityInstanceId: number): void {
  const context = queryOne<{
    project_activity_id: number;
    project_anchor_date: string | null;
    supplier_anchor_date: string | null;
  }>(
    `SELECT sai.project_activity_id,
            p.project_anchor_date,
            sp.supplier_anchor_date
     FROM supplier_activity_instances sai
     JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
     JOIN projects p ON sp.project_id = p.id
     WHERE sai.id = ?`,
    [supplierActivityInstanceId]
  );

  if (!context) {
    return;
  }

  const projectItemsRaw = query<ProjectScheduleItem>(
    'SELECT * FROM project_schedule_items WHERE project_activity_id = ? ORDER BY sort_order',
    [context.project_activity_id]
  );

  if (projectItemsRaw.length === 0) {
    return;
  }

  const projectItems = toCamelCase<ProjectScheduleItem[]>(projectItemsRaw);
  const instances = query<{
    id: number;
    project_schedule_item_id: number;
    planned_date: string | null;
    actual_date: string | null;
    planned_date_override: number;
    locked: number;
    status: string;
  }>(
    `SELECT id, project_schedule_item_id, planned_date, actual_date,
            planned_date_override, locked, status
     FROM supplier_schedule_item_instances
     WHERE supplier_activity_instance_id = ?`,
    [supplierActivityInstanceId]
  );

  const actualDates = new Map(
    instances.map((item) => [item.project_schedule_item_id, item.actual_date || null])
  );
  const useBusinessDays = getUseBusinessDaysSetting();
  const recalculated = calculateScheduleDates(
    projectItems,
    context.project_anchor_date || undefined,
    context.supplier_anchor_date || undefined,
    useBusinessDays,
    actualDates
  );
  const recalculatedById = new Map(recalculated.map((item) => [item.id, item.plannedDate]));
  const instancesByProjectId = new Map(instances.map((item) => [item.project_schedule_item_id, item]));
  const settings = getPropagationSettings();

  for (const item of projectItems) {
    if (item.anchorType !== 'COMPLETION') {
      continue;
    }
    const instance = instancesByProjectId.get(item.id);
    if (!instance) {
      continue;
    }
    if (settings.skipLocked && instance.locked) {
      continue;
    }
    if (settings.skipOverridden && instance.planned_date_override) {
      continue;
    }
    if (settings.skipComplete && instance.status === 'Complete') {
      continue;
    }

    const nextPlannedDate = recalculatedById.get(item.id) || null;
    if (instance.planned_date !== nextPlannedDate) {
      run(
        'UPDATE supplier_schedule_item_instances SET planned_date = ? WHERE id = ?',
        [nextPlannedDate, instance.id]
      );
    }
  }
}

// ============================================================================
// Audit Logging Functions (Phase 4)
// ============================================================================

function createAuditEvent(
  entityType: string,
  entityId: number,
  action: string,
  payload: any
): void {
  try {
    run(
      `INSERT INTO audit_events (entity_type, entity_id, action, payload)
       VALUES (?, ?, ?, ?)`,
      [entityType, entityId, action, JSON.stringify(payload)]
    );
  } catch (error) {
    console.error('Error creating audit event:', error);
  }
}

function queryAuditLog(
  entityType: string,
  entityId: number,
  limit: number = 50
): AuditEvent[] {
  const events = query(
    `SELECT * FROM audit_events
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [entityType, entityId, limit]
  );
  return toCamelCase<AuditEvent[]>(events);
}

// ============================================================================
// Suppliers Handlers
// ============================================================================

function handleSuppliersList(): APIResponse<Supplier[]> {
  try {
    const suppliers = query('SELECT * FROM suppliers ORDER BY name');
    return createSuccessResponse(toCamelCase<Supplier[]>(suppliers));
  } catch (error) {
    console.error('Error listing suppliers:', error);
    return createErrorResponse(String(error));
  }
}

function handleSuppliersGet(_event: any, id: number): APIResponse<Supplier> {
  try {
    const supplier = queryOne('SELECT * FROM suppliers WHERE id = ?', [id]);

    if (!supplier) {
      return createErrorResponse(`Supplier not found: ${id}`);
    }

    return createSuccessResponse(toCamelCase<Supplier>(supplier));
  } catch (error) {
    console.error('Error getting supplier:', error);
    return createErrorResponse(String(error));
  }
}

function handleSuppliersCreate(_event: any, params: CreateSupplierParams): APIResponse<Supplier> {
  try {
    const { name, notes } = params;

    const result = run(
      `INSERT INTO suppliers (name, notes)
       VALUES (?, ?)`,
      [name, notes || null]
    );

    const supplier = queryOne('SELECT * FROM suppliers WHERE id = ?', [result.lastInsertRowid]);

    return createSuccessResponse(toCamelCase<Supplier>(supplier));
  } catch (error) {
    console.error('Error creating supplier:', error);
    return createErrorResponse(String(error));
  }
}

function handleSuppliersUpdate(_event: any, params: UpdateSupplierParams): APIResponse<Supplier> {
  try {
    const { id, name, notes } = params;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`, values);

    const supplier = queryOne('SELECT * FROM suppliers WHERE id = ?', [id]);
    return createSuccessResponse(toCamelCase<Supplier>(supplier));
  } catch (error) {
    console.error('Error updating supplier:', error);
    return createErrorResponse(String(error));
  }
}

function handleSuppliersDelete(_event: any, id: number): APIResponse<void> {
  try {
    const result = run('DELETE FROM suppliers WHERE id = ?', [id]);

    if (result.changes === 0) {
      return createErrorResponse(`Supplier not found: ${id}`);
    }

    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Activity Templates Handlers
// ============================================================================

function handleActivityTemplatesList(): APIResponse<ActivityTemplate[]> {
  try {
    const templates = query('SELECT * FROM activity_templates ORDER BY name');
    return createSuccessResponse(toCamelCase<ActivityTemplate[]>(templates));
  } catch (error) {
    console.error('Error listing activity templates:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplatesGet(_event: any, id: number): APIResponse<ActivityTemplate> {
  try {
    const template = queryOne('SELECT * FROM activity_templates WHERE id = ?', [id]);

    if (!template) {
      return createErrorResponse(`Activity template not found: ${id}`);
    }

    return createSuccessResponse(toCamelCase<ActivityTemplate>(template));
  } catch (error) {
    console.error('Error getting activity template:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplatesCreate(
  _event: any,
  params: CreateActivityTemplateParams
): APIResponse<ActivityTemplate> {
  try {
    const { name, description } = params;

    const result = run(
      `INSERT INTO activity_templates (name, description)
       VALUES (?, ?)`,
      [name, description || null]
    );

    const template = queryOne('SELECT * FROM activity_templates WHERE id = ?', [
      result.lastInsertRowid,
    ]);

    return createSuccessResponse(toCamelCase<ActivityTemplate>(template));
  } catch (error) {
    console.error('Error creating activity template:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplatesUpdate(
  _event: any,
  params: UpdateActivityTemplateParams
): APIResponse<ActivityTemplate> {
  try {
    const { id, name, description } = params;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE activity_templates SET ${updates.join(', ')} WHERE id = ?`, values);

    const template = queryOne('SELECT * FROM activity_templates WHERE id = ?', [id]);
    return createSuccessResponse(toCamelCase<ActivityTemplate>(template));
  } catch (error) {
    console.error('Error updating activity template:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplatesDelete(_event: any, id: number): APIResponse<void> {
  try {
    const result = run('DELETE FROM activity_templates WHERE id = ?', [id]);

    if (result.changes === 0) {
      return createErrorResponse(`Activity template not found: ${id}`);
    }

    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting activity template:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Activity Template Schedule Items Handlers
// ============================================================================

function handleActivityTemplateScheduleItemsList(
  _event: any,
  activityTemplateId: number
): APIResponse<ActivityTemplateScheduleItem[]> {
  try {
    const items = query(
      'SELECT * FROM activity_template_schedule_items WHERE activity_template_id = ? ORDER BY id',
      [activityTemplateId]
    );
    return createSuccessResponse(toCamelCase<ActivityTemplateScheduleItem[]>(items));
  } catch (error) {
    console.error('Error listing activity template schedule items:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplateScheduleItemsCreate(
  _event: any,
  params: CreateActivityTemplateScheduleItemParams
): APIResponse<ActivityTemplateScheduleItem> {
  try {
    const { activityTemplateId, kind, name, anchorType, anchorRefId, offsetDays } = params;

    if (anchorType === 'SCHEDULE_ITEM' && !anchorRefId) {
      return createErrorResponse('Anchor reference is required for SCHEDULE_ITEM');
    }

    const result = run(
      `INSERT INTO activity_template_schedule_items
       (activity_template_id, kind, name, anchor_type, anchor_ref_id, offset_days)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [activityTemplateId, kind, name, anchorType, anchorRefId || null, offsetDays || null]
    );

    const item = queryOne('SELECT * FROM activity_template_schedule_items WHERE id = ?', [
      result.lastInsertRowid,
    ]);

    return createSuccessResponse(toCamelCase<ActivityTemplateScheduleItem>(item));
  } catch (error) {
    console.error('Error creating activity template schedule item:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplateScheduleItemsUpdate(
  _event: any,
  params: UpdateActivityTemplateScheduleItemParams
): APIResponse<ActivityTemplateScheduleItem> {
  try {
    const { id, kind, name, anchorType, anchorRefId, offsetDays } = params;

    if (anchorType === 'SCHEDULE_ITEM' && anchorRefId === undefined) {
      return createErrorResponse('Anchor reference is required for SCHEDULE_ITEM');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (kind !== undefined) {
      updates.push('kind = ?');
      values.push(kind);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (anchorType !== undefined) {
      updates.push('anchor_type = ?');
      values.push(anchorType);
    }
    if (anchorRefId !== undefined) {
      updates.push('anchor_ref_id = ?');
      values.push(anchorRefId);
    }
    if (offsetDays !== undefined) {
      updates.push('offset_days = ?');
      values.push(offsetDays);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE activity_template_schedule_items SET ${updates.join(', ')} WHERE id = ?`, values);

    const item = queryOne('SELECT * FROM activity_template_schedule_items WHERE id = ?', [id]);
    return createSuccessResponse(toCamelCase<ActivityTemplateScheduleItem>(item));
  } catch (error) {
    console.error('Error updating activity template schedule item:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplateScheduleItemsDelete(_event: any, id: number): APIResponse<void> {
  try {
    const result = run('DELETE FROM activity_template_schedule_items WHERE id = ?', [id]);

    if (result.changes === 0) {
      return createErrorResponse(`Activity template schedule item not found: ${id}`);
    }

    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting activity template schedule item:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Activity Template Applicability Rules Handlers
// ============================================================================

function handleActivityTemplateApplicabilityGet(
  _event: any,
  activityTemplateId: number
): APIResponse<ActivityTemplateApplicability> {
  try {
    const ruleRaw = queryOne(
      'SELECT * FROM activity_template_applicability_rules WHERE activity_template_id = ?',
      [activityTemplateId]
    );
    if (!ruleRaw) {
      return createSuccessResponse({ rule: null, clauses: [] });
    }
    const clauses = query(
      'SELECT * FROM activity_template_applicability_clauses WHERE rule_id = ? ORDER BY id',
      [ruleRaw.id]
    );
    return createSuccessResponse({
      rule: toCamelCase<ActivityTemplateApplicabilityRule>(ruleRaw),
      clauses: toCamelCase<ActivityTemplateApplicabilityClause[]>(clauses),
    });
  } catch (error) {
    console.error('Error getting activity template applicability:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplateApplicabilityUpsertRule(
  _event: any,
  params: UpsertActivityTemplateApplicabilityRuleParams
): APIResponse<ActivityTemplateApplicabilityRule> {
  try {
    const { activityTemplateId, operator, enabled } = params;

    const existing = queryOne(
      'SELECT * FROM activity_template_applicability_rules WHERE activity_template_id = ?',
      [activityTemplateId]
    );

    if (existing) {
      run(
        `UPDATE activity_template_applicability_rules
         SET operator = ?, enabled = ?
         WHERE id = ?`,
        [operator, enabled ? 1 : 0, existing.id]
      );
      const updated = queryOne(
        'SELECT * FROM activity_template_applicability_rules WHERE id = ?',
        [existing.id]
      );
      reapplyApplicabilityForTemplate(activityTemplateId);
      return createSuccessResponse(toCamelCase<ActivityTemplateApplicabilityRule>(updated));
    }

    const insertResult = run(
      `INSERT INTO activity_template_applicability_rules
       (activity_template_id, operator, enabled)
       VALUES (?, ?, ?)`,
      [activityTemplateId, operator, enabled ? 1 : 0]
    );
    const rule = queryOne(
      'SELECT * FROM activity_template_applicability_rules WHERE id = ?',
      [insertResult.lastInsertRowid]
    );
    reapplyApplicabilityForTemplate(activityTemplateId);
    return createSuccessResponse(toCamelCase<ActivityTemplateApplicabilityRule>(rule));
  } catch (error) {
    console.error('Error upserting activity template applicability rule:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplateApplicabilityDeleteRule(
  _event: any,
  id: number
): APIResponse<void> {
  try {
    const rule = queryOne<{ activity_template_id: number }>(
      'SELECT activity_template_id FROM activity_template_applicability_rules WHERE id = ?',
      [id]
    );
    const result = run('DELETE FROM activity_template_applicability_rules WHERE id = ?', [id]);
    if (result.changes === 0) {
      return createErrorResponse(`Applicability rule not found: ${id}`);
    }
    if (rule) {
      reapplyApplicabilityForTemplate(rule.activity_template_id);
    }
    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting activity template applicability rule:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplateApplicabilityCreateClause(
  _event: any,
  params: CreateActivityTemplateApplicabilityClauseParams
): APIResponse<ActivityTemplateApplicabilityClause> {
  try {
    const { ruleId, subjectType, comparator, value } = params;
    const trimmedValue = value.trim();
    if (trimmedValue === '') {
      return createErrorResponse('Clause value is required');
    }
    const insertResult = run(
      `INSERT INTO activity_template_applicability_clauses
       (rule_id, subject_type, comparator, value)
       VALUES (?, ?, ?, ?)`,
      [ruleId, subjectType, comparator, trimmedValue]
    );
    const clause = queryOne(
      'SELECT * FROM activity_template_applicability_clauses WHERE id = ?',
      [insertResult.lastInsertRowid]
    );
    const rule = queryOne<{ activity_template_id: number }>(
      'SELECT activity_template_id FROM activity_template_applicability_rules WHERE id = ?',
      [ruleId]
    );
    if (rule) {
      reapplyApplicabilityForTemplate(rule.activity_template_id);
    }
    return createSuccessResponse(toCamelCase<ActivityTemplateApplicabilityClause>(clause));
  } catch (error) {
    console.error('Error creating applicability clause:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplateApplicabilityUpdateClause(
  _event: any,
  params: UpdateActivityTemplateApplicabilityClauseParams
): APIResponse<ActivityTemplateApplicabilityClause> {
  try {
    const { id, subjectType, comparator, value } = params;

    const updates: string[] = [];
    const values: any[] = [];

    if (subjectType !== undefined) {
      updates.push('subject_type = ?');
      values.push(subjectType);
    }
    if (comparator !== undefined) {
      updates.push('comparator = ?');
      values.push(comparator);
    }
    if (value !== undefined) {
      const trimmedValue = value.trim();
      if (trimmedValue === '') {
        return createErrorResponse('Clause value is required');
      }
      updates.push('value = ?');
      values.push(trimmedValue);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE activity_template_applicability_clauses SET ${updates.join(', ')} WHERE id = ?`, values);

    const clause = queryOne(
      'SELECT * FROM activity_template_applicability_clauses WHERE id = ?',
      [id]
    );
    const rule = queryOne<{ activity_template_id: number }>(
      `SELECT r.activity_template_id
       FROM activity_template_applicability_clauses c
       JOIN activity_template_applicability_rules r ON c.rule_id = r.id
       WHERE c.id = ?`,
      [id]
    );
    if (rule) {
      reapplyApplicabilityForTemplate(rule.activity_template_id);
    }
    return createSuccessResponse(toCamelCase<ActivityTemplateApplicabilityClause>(clause));
  } catch (error) {
    console.error('Error updating applicability clause:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplateApplicabilityDeleteClause(
  _event: any,
  id: number
): APIResponse<void> {
  try {
    const rule = queryOne<{ activity_template_id: number }>(
      `SELECT r.activity_template_id
       FROM activity_template_applicability_clauses c
       JOIN activity_template_applicability_rules r ON c.rule_id = r.id
       WHERE c.id = ?`,
      [id]
    );
    const result = run('DELETE FROM activity_template_applicability_clauses WHERE id = ?', [id]);
    if (result.changes === 0) {
      return createErrorResponse(`Applicability clause not found: ${id}`);
    }
    if (rule) {
      reapplyApplicabilityForTemplate(rule.activity_template_id);
    }
    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting applicability clause:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Projects Handlers
// ============================================================================

function handleProjectsList(): APIResponse<Project[]> {
  try {
    const projects = query('SELECT * FROM projects ORDER BY name, version');
    return createSuccessResponse(toCamelCase<Project[]>(projects));
  } catch (error) {
    console.error('Error listing projects:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectsGet(_event: any, id: number): APIResponse<Project> {
  try {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);

    if (!project) {
      return createErrorResponse(`Project not found: ${id}`);
    }

    return createSuccessResponse(toCamelCase<Project>(project));
  } catch (error) {
    console.error('Error getting project:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectsCreate(_event: any, params: CreateProjectParams): APIResponse<Project> {
  try {
    const { name, version, defaultAnchorRule, projectAnchorDate } = params;
    const finalVersion =
      version && version.trim() !== '' ? version.trim() : formatVersionDate(new Date());

    const result = run(
      `INSERT INTO projects (name, version, default_anchor_rule, project_anchor_date)
       VALUES (?, ?, ?, ?)`,
      [name, finalVersion, defaultAnchorRule || null, projectAnchorDate || null]
    );

    const project = queryOne('SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);

    return createSuccessResponse(toCamelCase<Project>(project));
  } catch (error) {
    console.error('Error creating project:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectsUpdate(_event: any, params: UpdateProjectParams): APIResponse<Project> {
  try {
    const { id, name, version, defaultAnchorRule, projectAnchorDate } = params;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (version !== undefined) {
      updates.push('version = ?');
      values.push(version);
    }
    if (defaultAnchorRule !== undefined) {
      updates.push('default_anchor_rule = ?');
      values.push(defaultAnchorRule);
    }
    if (projectAnchorDate !== undefined) {
      updates.push('project_anchor_date = ?');
      values.push(projectAnchorDate);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);

    const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
    return createSuccessResponse(toCamelCase<Project>(project));
  } catch (error) {
    console.error('Error updating project:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectsDelete(_event: any, id: number): APIResponse<void> {
  try {
    const result = run('DELETE FROM projects WHERE id = ?', [id]);

    if (result.changes === 0) {
      return createErrorResponse(`Project not found: ${id}`);
    }

    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting project:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Project Activities Handlers
// ============================================================================

function handleProjectActivitiesList(_event: any, projectId: number): APIResponse<ProjectActivity[]> {
  try {
    const activities = query(
      'SELECT * FROM project_activities WHERE project_id = ? ORDER BY sort_order',
      [projectId]
    );
    return createSuccessResponse(toCamelCase<ProjectActivity[]>(activities));
  } catch (error) {
    console.error('Error listing project activities:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectActivitiesGet(_event: any, id: number): APIResponse<ProjectActivityDetail> {
  try {
    const activity = queryOne(
      `SELECT pa.*, at.name as activity_template_name, at.category as activity_template_category
       FROM project_activities pa
       JOIN activity_templates at ON pa.activity_template_id = at.id
       WHERE pa.id = ?`,
      [id]
    );

    if (!activity) {
      return createErrorResponse(`Project activity not found: ${id}`);
    }

    // Get schedule items for this activity
    const scheduleItems = query<ProjectScheduleItem>(
      'SELECT * FROM project_schedule_items WHERE project_activity_id = ? ORDER BY sort_order',
      [id]
    );

    // Calculate dates
    const projectAnchorDate = getProjectAnchorDateForActivity(id);
    const useBusinessDays = getUseBusinessDaysSetting();
    const itemsWithDates = calculateScheduleDates(
      toCamelCase<ProjectScheduleItem[]>(scheduleItems),
      projectAnchorDate || undefined,
      undefined, // supplierAnchorDate
      useBusinessDays
    );

    const result: ProjectActivityDetail = {
      ...toCamelCase<ProjectActivity>(activity),
      activityTemplateName: activity.activity_template_name,
      activityTemplateCategory: activity.activity_template_category || null,
      scheduleItems: itemsWithDates
    };

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error getting project activity:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectActivitiesCreate(
  _event: any,
  params: CreateProjectActivityParams
): APIResponse<ProjectActivity> {
  try {
    const { projectId, activityTemplateId, sortOrder } = params;

    // Determine sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const maxOrder = queryOne<{ max: number | null }>(
        'SELECT MAX(sort_order) as max FROM project_activities WHERE project_id = ?',
        [projectId]
      );
      finalSortOrder = (maxOrder?.max ?? -1) + 1;
    }

    const result = run(
      `INSERT INTO project_activities (project_id, activity_template_id, sort_order)
       VALUES (?, ?, ?)`,
      [projectId, activityTemplateId, finalSortOrder]
    );

    const templateItemsRaw = query(
      'SELECT * FROM activity_template_schedule_items WHERE activity_template_id = ? ORDER BY id',
      [activityTemplateId]
    );

    const projectItemIdByTemplateId = new Map<number, number>();

    templateItemsRaw.forEach((templateItemRaw: any, index) => {
      const projectItemResult = run(
        `INSERT INTO project_schedule_items
         (project_activity_id, template_item_id, kind, name, anchor_type, anchor_ref_id, offset_days, fixed_date, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.lastInsertRowid,
          templateItemRaw.id,
          templateItemRaw.kind,
          templateItemRaw.name,
          templateItemRaw.anchor_type,
          null,
          templateItemRaw.offset_days,
          null,
          index,
        ]
      );

      projectItemIdByTemplateId.set(templateItemRaw.id, projectItemResult.lastInsertRowid);
    });

    // Second pass to wire anchor references
    for (const templateItemRaw of templateItemsRaw) {
      if (!templateItemRaw.anchor_ref_id) {
        continue;
      }
      const projectItemId = projectItemIdByTemplateId.get(templateItemRaw.id);
      const anchorProjectItemId = projectItemIdByTemplateId.get(templateItemRaw.anchor_ref_id);
      if (projectItemId && anchorProjectItemId) {
        run('UPDATE project_schedule_items SET anchor_ref_id = ? WHERE id = ?', [
          anchorProjectItemId,
          projectItemId,
        ]);
      }
    }

    const activity = queryOne('SELECT * FROM project_activities WHERE id = ?', [
      result.lastInsertRowid,
    ]);

    return createSuccessResponse(toCamelCase<ProjectActivity>(activity));
  } catch (error) {
    console.error('Error creating project activity:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectActivitiesUpdate(
  _event: any,
  params: UpdateProjectActivityParams
): APIResponse<ProjectActivity> {
  try {
    const { id, sortOrder } = params;

    if (sortOrder === undefined) {
      return createErrorResponse('No fields to update');
    }

    run('UPDATE project_activities SET sort_order = ? WHERE id = ?', [sortOrder, id]);

    const activity = queryOne('SELECT * FROM project_activities WHERE id = ?', [id]);
    return createSuccessResponse(toCamelCase<ProjectActivity>(activity));
  } catch (error) {
    console.error('Error updating project activity:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectActivitiesDelete(_event: any, id: number): APIResponse<void> {
  try {
    const result = run('DELETE FROM project_activities WHERE id = ?', [id]);

    if (result.changes === 0) {
      return createErrorResponse(`Project activity not found: ${id}`);
    }

    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting project activity:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Project Activities - Sync From Template
// ============================================================================

function handleProjectActivitiesSyncFromTemplate(
  _event: any,
  params: SyncProjectActivityFromTemplateParams
): APIResponse<ProjectActivity> {
  try {
    const { projectActivityId, applyTemplateOffsets } = params;

    const activity = queryOne('SELECT * FROM project_activities WHERE id = ?', [projectActivityId]);
    if (!activity) {
      return createErrorResponse(`Project activity not found: ${projectActivityId}`);
    }

    const templateItemsRaw = query(
      'SELECT * FROM activity_template_schedule_items WHERE activity_template_id = ? ORDER BY id',
      [activity.activity_template_id]
    );

    const projectItemsRaw = query(
      'SELECT * FROM project_schedule_items WHERE project_activity_id = ?',
      [projectActivityId]
    );

    const templateItemIds = new Set(templateItemsRaw.map((item: any) => item.id));
    const projectItemIdsToRemove = projectItemsRaw
      .filter((item: any) => item.template_item_id && !templateItemIds.has(item.template_item_id))
      .map((item: any) => item.id);

    if (projectItemIdsToRemove.length > 0) {
      const placeholders = projectItemIdsToRemove.map(() => '?').join(', ');
      run(
        `DELETE FROM supplier_schedule_item_instances
         WHERE project_schedule_item_id IN (${placeholders})`,
        projectItemIdsToRemove
      );
      run(
        `UPDATE project_schedule_items
         SET anchor_ref_id = NULL
         WHERE project_activity_id = ? AND anchor_ref_id IN (${placeholders})`,
        [projectActivityId, ...projectItemIdsToRemove]
      );
      run(`DELETE FROM project_schedule_items WHERE id IN (${placeholders})`, projectItemIdsToRemove);
    }

    const projectItemIdsToRemoveSet = new Set(projectItemIdsToRemove);
    const remainingProjectItemsRaw = projectItemsRaw.filter(
      (item: any) => !projectItemIdsToRemoveSet.has(item.id)
    );

    const projectItemByTemplateId = new Map<number, any>();
    for (const projectItemRaw of remainingProjectItemsRaw) {
      if (projectItemRaw.template_item_id) {
        projectItemByTemplateId.set(projectItemRaw.template_item_id, projectItemRaw);
      }
    }

    const projectItemIdByTemplateId = new Map<number, number>();

    for (const projectItemRaw of remainingProjectItemsRaw) {
      if (projectItemRaw.template_item_id) {
        projectItemIdByTemplateId.set(projectItemRaw.template_item_id, projectItemRaw.id);
      }
    }

    const newlyCreatedTemplateIds = new Set<number>();

    templateItemsRaw.forEach((templateItemRaw: any) => {
      const existing = projectItemByTemplateId.get(templateItemRaw.id);
      if (!existing) {
        const insertResult = run(
          `INSERT INTO project_schedule_items
           (project_activity_id, template_item_id, kind, name, anchor_type, anchor_ref_id, offset_days, fixed_date, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectActivityId,
            templateItemRaw.id,
            templateItemRaw.kind,
            templateItemRaw.name,
            templateItemRaw.anchor_type,
            null,
            templateItemRaw.offset_days,
            null,
            remainingProjectItemsRaw.length,
          ]
        );
        projectItemIdByTemplateId.set(templateItemRaw.id, insertResult.lastInsertRowid);
        newlyCreatedTemplateIds.add(templateItemRaw.id);
      } else {
        projectItemIdByTemplateId.set(templateItemRaw.id, existing.id);
      }
    });

    if (applyTemplateOffsets) {
      for (const templateItemRaw of templateItemsRaw) {
        const projectItemId = projectItemIdByTemplateId.get(templateItemRaw.id);
        if (!projectItemId) {
          continue;
        }
        run(
          `UPDATE project_schedule_items
           SET name = ?, kind = ?, anchor_type = ?, offset_days = ?
           WHERE id = ?`,
          [
            templateItemRaw.name,
            templateItemRaw.kind,
            templateItemRaw.anchor_type,
            templateItemRaw.offset_days,
            projectItemId,
          ]
        );
      }
    }

    for (const templateItemRaw of templateItemsRaw) {
      if (!templateItemRaw.anchor_ref_id) {
        continue;
      }
      const projectItemId = projectItemIdByTemplateId.get(templateItemRaw.id);
      const anchorProjectItemId = projectItemIdByTemplateId.get(templateItemRaw.anchor_ref_id);
      const shouldUpdateAnchor =
        newlyCreatedTemplateIds.has(templateItemRaw.id) || applyTemplateOffsets;
      if (projectItemId && anchorProjectItemId && shouldUpdateAnchor) {
        run('UPDATE project_schedule_items SET anchor_ref_id = ? WHERE id = ?', [
          anchorProjectItemId,
          projectItemId,
        ]);
      }
    }

    const supplierActivities = query(
      `SELECT sai.id as supplier_activity_instance_id, sp.supplier_anchor_date
       FROM supplier_activity_instances sai
       JOIN supplier_projects sp ON sp.id = sai.supplier_project_id
       WHERE sai.project_activity_id = ?`,
      [projectActivityId]
    );
    const projectAnchorDate = getProjectAnchorDateForActivity(projectActivityId);

    for (const supplierActivity of supplierActivities) {
      ensureSupplierScheduleItemsForActivity(
        supplierActivity.supplier_activity_instance_id,
        projectActivityId,
        projectAnchorDate,
        supplierActivity.supplier_anchor_date || null
      );
    }

    return createSuccessResponse(toCamelCase<ProjectActivity>(activity));
  } catch (error) {
    console.error('Error syncing project activity from template:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Schedule Items Handlers
// ============================================================================

function handleScheduleItemsList(
  _event: any,
  projectActivityId: number
): APIResponse<ScheduleItemWithDates[]> {
  try {
    const items = query<ProjectScheduleItem>(
      'SELECT * FROM project_schedule_items WHERE project_activity_id = ? ORDER BY sort_order',
      [projectActivityId]
    );

    const projectAnchorDate = getProjectAnchorDateForActivity(projectActivityId);
    const useBusinessDays = getUseBusinessDaysSetting();
    const itemsWithDates = calculateScheduleDates(
      toCamelCase<ProjectScheduleItem[]>(items),
      projectAnchorDate || undefined,
      undefined, // supplierAnchorDate
      useBusinessDays
    );

    return createSuccessResponse(itemsWithDates);
  } catch (error) {
    console.error('Error listing schedule items:', error);
    return createErrorResponse(String(error));
  }
}

function handleScheduleItemsGet(_event: any, id: number): APIResponse<ProjectScheduleItem> {
  try {
    const item = queryOne('SELECT * FROM project_schedule_items WHERE id = ?', [id]);

    if (!item) {
      return createErrorResponse(`Schedule item not found: ${id}`);
    }

    return createSuccessResponse(toCamelCase<ProjectScheduleItem>(item));
  } catch (error) {
    console.error('Error getting schedule item:', error);
    return createErrorResponse(String(error));
  }
}

function handleScheduleItemsCreate(
  _event: any,
  params: CreateScheduleItemParams
): APIResponse<ProjectScheduleItem> {
  try {
    const {
      projectActivityId,
      kind,
      name,
      anchorType,
      anchorRefId,
      offsetDays,
      fixedDate,
      sortOrder,
      templateItemId,
      overrideDate,
      overrideEnabled,
    } = params;

    // Validate anchor type requirements
    if (anchorType === 'FIXED_DATE' && !fixedDate) {
      return createErrorResponse('Fixed date is required for FIXED_DATE anchor type');
    }
    if (anchorType === 'SCHEDULE_ITEM' && !anchorRefId) {
      return createErrorResponse('Anchor reference ID is required for SCHEDULE_ITEM anchor type');
    }

    // Determine sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const maxOrder = queryOne<{ max: number | null }>(
        'SELECT MAX(sort_order) as max FROM project_schedule_items WHERE project_activity_id = ?',
        [projectActivityId]
      );
      finalSortOrder = (maxOrder?.max ?? -1) + 1;
    }

    const result = run(
      `INSERT INTO project_schedule_items
       (project_activity_id, template_item_id, kind, name, anchor_type, anchor_ref_id, offset_days, fixed_date, override_date, override_enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectActivityId,
        templateItemId || null,
        kind,
        name,
        anchorType,
        anchorRefId || null,
        offsetDays || null,
        fixedDate || null,
        overrideDate || null,
        overrideEnabled ? 1 : 0,
        finalSortOrder,
      ]
    );

    // Validate for circular dependencies
    const allItems = query<ProjectScheduleItem>(
      'SELECT * FROM project_schedule_items WHERE project_activity_id = ?',
      [projectActivityId]
    );
    const errors = validateScheduleItems(toCamelCase<ProjectScheduleItem[]>(allItems));
    if (errors.length > 0) {
      // Rollback by deleting the just-created item
      run('DELETE FROM project_schedule_items WHERE id = ?', [result.lastInsertRowid]);
      return createErrorResponse(`Validation failed: ${errors.join(', ')}`);
    }

    const supplierActivities = query(
      `SELECT sai.id as supplier_activity_instance_id, sp.supplier_anchor_date
       FROM supplier_activity_instances sai
       JOIN supplier_projects sp ON sp.id = sai.supplier_project_id
       WHERE sai.project_activity_id = ?`,
      [projectActivityId]
    );
    if (supplierActivities.length > 0) {
      const projectAnchorDate = getProjectAnchorDateForActivity(projectActivityId);
      for (const supplierActivity of supplierActivities) {
        ensureSupplierScheduleItemsForActivity(
          supplierActivity.supplier_activity_instance_id,
          projectActivityId,
          projectAnchorDate,
          supplierActivity.supplier_anchor_date || null
        );
      }
    }

    const item = queryOne('SELECT * FROM project_schedule_items WHERE id = ?', [
      result.lastInsertRowid,
    ]);

    return createSuccessResponse(toCamelCase<ProjectScheduleItem>(item));
  } catch (error) {
    console.error('Error creating schedule item:', error);
    return createErrorResponse(String(error));
  }
}

function handleScheduleItemsUpdate(
  _event: any,
  params: UpdateScheduleItemParams
): APIResponse<ProjectScheduleItem> {
  try {
    const { id, name, anchorType, anchorRefId, offsetDays, fixedDate, sortOrder, overrideDate, overrideEnabled } =
      params;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (anchorType !== undefined) {
      updates.push('anchor_type = ?');
      values.push(anchorType);

      // Validate anchor type requirements
      if (anchorType === 'FIXED_DATE' && fixedDate === undefined) {
        return createErrorResponse('Fixed date is required for FIXED_DATE anchor type');
      }
      if (anchorType === 'SCHEDULE_ITEM' && anchorRefId === undefined) {
        return createErrorResponse('Anchor reference ID is required for SCHEDULE_ITEM anchor type');
      }
    }
    if (anchorRefId !== undefined) {
      updates.push('anchor_ref_id = ?');
      values.push(anchorRefId);
    }
    if (offsetDays !== undefined) {
      updates.push('offset_days = ?');
      values.push(offsetDays);
    }
    if (fixedDate !== undefined) {
      updates.push('fixed_date = ?');
      values.push(fixedDate);
    }
    if (overrideDate !== undefined) {
      updates.push('override_date = ?');
      values.push(overrideDate);
    }
    if (overrideEnabled !== undefined) {
      updates.push('override_enabled = ?');
      values.push(overrideEnabled ? 1 : 0);
    }
    if (sortOrder !== undefined) {
      updates.push('sort_order = ?');
      values.push(sortOrder);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE project_schedule_items SET ${updates.join(', ')} WHERE id = ?`, values);

    // Validate for circular dependencies
    const itemRaw = queryOne('SELECT * FROM project_schedule_items WHERE id = ?', [id]);
    if (itemRaw) {
      const allItems = query<ProjectScheduleItem>(
        'SELECT * FROM project_schedule_items WHERE project_activity_id = ?',
        [itemRaw.project_activity_id]
      );
      const errors = validateScheduleItems(toCamelCase<ProjectScheduleItem[]>(allItems));
      if (errors.length > 0) {
        return createErrorResponse(`Validation failed: ${errors.join(', ')}`);
      }
    }

    const item = queryOne('SELECT * FROM project_schedule_items WHERE id = ?', [id]);

    return createSuccessResponse(toCamelCase<ProjectScheduleItem>(item));
  } catch (error) {
    console.error('Error updating schedule item:', error);
    return createErrorResponse(String(error));
  }
}

function handleScheduleItemsDelete(_event: any, id: number): APIResponse<void> {
  try {
    const result = run('DELETE FROM project_schedule_items WHERE id = ?', [id]);

    if (result.changes === 0) {
      return createErrorResponse(`Schedule item not found: ${id}`);
    }

    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting schedule item:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Supplier Projects Handlers
// ============================================================================

function handleSupplierProjectsList(): APIResponse<SupplierProjectSummary[]> {
  try {
    const supplierProjects = query(
      `SELECT sp.*, s.name as supplier_name, p.name as project_name, p.project_anchor_date
       FROM supplier_projects sp
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       ORDER BY s.name, p.name, sp.project_version`
    );
    return createSuccessResponse(toCamelCase<SupplierProjectSummary[]>(supplierProjects));
  } catch (error) {
    console.error('Error listing supplier projects:', error);
    return createErrorResponse(String(error));
  }
}

function handleSupplierProjectsListBySupplier(
  _event: any,
  supplierId: number
): APIResponse<SupplierProjectSummary[]> {
  try {
    const supplierProjects = query(
      `SELECT sp.*, s.name as supplier_name, p.name as project_name, p.project_anchor_date
       FROM supplier_projects sp
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       WHERE sp.supplier_id = ?
       ORDER BY p.name, sp.project_version`,
      [supplierId]
    );
    return createSuccessResponse(toCamelCase<SupplierProjectSummary[]>(supplierProjects));
  } catch (error) {
    console.error('Error listing supplier projects:', error);
    return createErrorResponse(String(error));
  }
}

function handleSupplierProjectsGetDetail(
  _event: any,
  id: number
): APIResponse<SupplierProjectDetail> {
  try {
    const supplierProject = queryOne(
      `SELECT sp.*, s.name as supplier_name, p.name as project_name, p.project_anchor_date
       FROM supplier_projects sp
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       WHERE sp.id = ?`,
      [id]
    );

    if (!supplierProject) {
      return createErrorResponse(`Supplier project not found: ${id}`);
    }

    const projectAnchorDate = supplierProject.project_anchor_date || null;
    const supplierAnchorDate = supplierProject.supplier_anchor_date || null;

    const activities = query(
      `SELECT sai.*, at.name as activity_template_name
       FROM supplier_activity_instances sai
       JOIN project_activities pa ON sai.project_activity_id = pa.id
       JOIN activity_templates at ON pa.activity_template_id = at.id
       WHERE sai.supplier_project_id = ?
       ORDER BY pa.sort_order`,
      [id]
    );

    const activitiesWithDetails: SupplierProjectActivityDetail[] = activities.map((activity: any) => {
      ensureSupplierScheduleItemsForActivity(
        activity.id,
        activity.project_activity_id,
        projectAnchorDate,
        supplierAnchorDate
      );
      const scheduleItems = query(
        `SELECT psi.*, ssi.id as supplier_schedule_item_id,
                ssi.planned_date, ssi.actual_date, ssi.status,
                ssi.planned_date_override, ssi.scope_override, ssi.locked
         FROM supplier_schedule_item_instances ssi
         JOIN project_schedule_items psi ON ssi.project_schedule_item_id = psi.id
         WHERE ssi.supplier_activity_instance_id = ?
         ORDER BY psi.sort_order`,
        [activity.id]
      );
      const attachments = query(
        `SELECT * FROM supplier_activity_attachments
         WHERE supplier_activity_instance_id = ?
         ORDER BY created_at`,
        [activity.id]
      );

      return {
        ...toCamelCase<SupplierActivityInstance>(activity),
        activityTemplateName: activity.activity_template_name,
        scheduleItems: toCamelCase<SupplierScheduleItemDetail[]>(scheduleItems),
        attachments: toCamelCase<SupplierActivityAttachment[]>(attachments),
      };
    });

    const result: SupplierProjectDetail = {
      ...toCamelCase<SupplierProject>(supplierProject),
      supplierName: supplierProject.supplier_name,
      projectName: supplierProject.project_name,
      projectAnchorDate: supplierProject.project_anchor_date,
      activities: activitiesWithDetails,
    };

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error getting supplier project detail:', error);
    return createErrorResponse(String(error));
  }
}

function handleSupplierProjectsApply(
  _event: any,
  params: ApplySupplierProjectParams
): APIResponse<SupplierProject> {
  try {
    const { supplierId, projectId, supplierAnchorDate, supplierProjectNmrRank } = params;

    const supplier = queryOne('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
    if (!supplier) {
      return createErrorResponse(`Supplier not found: ${supplierId}`);
    }

    const project = queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return createErrorResponse(`Project not found: ${projectId}`);
    }

    const existing = queryOne(
      'SELECT * FROM supplier_projects WHERE supplier_id = ? AND project_id = ?',
      [supplierId, projectId]
    );
    if (existing) {
      return createErrorResponse('Project already applied to this supplier');
    }

    const normalizedNmrRank =
      supplierProjectNmrRank && supplierProjectNmrRank.trim() !== ''
        ? supplierProjectNmrRank.trim()
        : null;
    const contextNmrRank = normalizedNmrRank ?? null;

    const insertResult = run(
      `INSERT INTO supplier_projects
       (supplier_id, project_id, project_version, supplier_anchor_date, supplier_project_nmr_rank)
       VALUES (?, ?, ?, ?, ?)`,
      [supplierId, projectId, project.version, supplierAnchorDate || null, normalizedNmrRank]
    );

    const supplierProjectId =
      insertResult.lastInsertRowid ||
      queryOne<{ id: number }>(
        'SELECT id FROM supplier_projects WHERE supplier_id = ? AND project_id = ? ORDER BY id DESC LIMIT 1',
        [supplierId, projectId]
      )?.id ||
      0;

    if (!supplierProjectId) {
      return createErrorResponse('Failed to create supplier project');
    }

    const projectActivities = query(
      'SELECT * FROM project_activities WHERE project_id = ? ORDER BY sort_order',
      [projectId]
    );

    const { nmrRanks, paRanks } = getRankSettings();
    const context: ApplicabilityContext = {
      supplierNmrRank: contextNmrRank,
      partPaRanks: [],
      nmrRanksOrder: nmrRanks,
      paRanksOrder: paRanks,
    };

    for (const activity of projectActivities) {
      const includeActivity = shouldIncludeActivity(activity.activity_template_id, context);
      const activityStatus = includeActivity ? 'Not Started' : 'Not Required';
      const activityInsert = run(
        `INSERT INTO supplier_activity_instances
         (supplier_project_id, project_activity_id, status)
         VALUES (?, ?, ?)`,
        [supplierProjectId, activity.id, activityStatus]
      );

      if (!includeActivity) {
        continue;
      }

      const scheduleItems = query<ProjectScheduleItem>(
        'SELECT * FROM project_schedule_items WHERE project_activity_id = ? ORDER BY sort_order',
        [activity.id]
      );

      const useBusinessDays = getUseBusinessDaysSetting();
      const itemsWithDates = calculateScheduleDates(
        toCamelCase<ProjectScheduleItem[]>(scheduleItems),
        project.project_anchor_date || undefined,
        supplierAnchorDate || undefined,
        useBusinessDays
      );

      for (const item of itemsWithDates) {
        run(
          `INSERT INTO supplier_schedule_item_instances
           (supplier_activity_instance_id, project_schedule_item_id, planned_date)
           VALUES (?, ?, ?)`,
          [activityInsert.lastInsertRowid, item.id, item.plannedDate]
        );
      }
    }

    const supplierProject = queryOne('SELECT * FROM supplier_projects WHERE id = ?', [
      supplierProjectId,
    ]);

    return createSuccessResponse(toCamelCase<SupplierProject>(supplierProject));
  } catch (error) {
    console.error('Error applying project to supplier:', error);
    return createErrorResponse(String(error));
  }
}

function handleSupplierProjectsUpdate(
  _event: any,
  params: UpdateSupplierProjectParams
): APIResponse<SupplierProject> {
  try {
    const { id, supplierAnchorDate, supplierProjectNmrRank } = params;

    const updates: string[] = [];
    const values: any[] = [];

    if (supplierAnchorDate !== undefined) {
      updates.push('supplier_anchor_date = ?');
      values.push(supplierAnchorDate);
    }
    if (supplierProjectNmrRank !== undefined) {
      const normalizedNmrRank =
        supplierProjectNmrRank && supplierProjectNmrRank.trim() !== ''
          ? supplierProjectNmrRank.trim()
          : null;
      updates.push('supplier_project_nmr_rank = ?');
      values.push(normalizedNmrRank);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE supplier_projects SET ${updates.join(', ')} WHERE id = ?`, values);

    if (supplierProjectNmrRank !== undefined) {
      evaluateApplicabilityForSupplierProject(id);
    }

    const supplierProject = queryOne('SELECT * FROM supplier_projects WHERE id = ?', [id]);
    return createSuccessResponse(toCamelCase<SupplierProject>(supplierProject));
  } catch (error) {
    console.error('Error updating supplier project:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Supplier Activity Instances Handlers
// ============================================================================

function handleSupplierActivityInstancesUpdate(
  _event: any,
  params: UpdateSupplierActivityInstanceParams
): APIResponse<SupplierActivityInstance> {
  try {
    const { id, status, scopeOverride } = params;
    const existing = queryOne<{
      scope_override: string | null;
      project_id: number;
      supplier_project_id: number;
      supplier_name: string;
      project_name: string;
      activity_name: string;
    }>(
      `SELECT sai.scope_override,
              sp.project_id,
              sp.id as supplier_project_id,
              s.name as supplier_name,
              p.name as project_name,
              at.name as activity_name
       FROM supplier_activity_instances sai
       JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       JOIN project_activities pa ON sai.project_activity_id = pa.id
       JOIN activity_templates at ON pa.activity_template_id = at.id
       WHERE sai.id = ?`,
      [id]
    );

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (scopeOverride !== undefined) {
      updates.push('scope_override = ?');
      values.push(scopeOverride);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE supplier_activity_instances SET ${updates.join(', ')} WHERE id = ?`, values);

    const instance = queryOne('SELECT * FROM supplier_activity_instances WHERE id = ?', [id]);
    if (scopeOverride !== undefined && existing?.project_id) {
      createAuditEvent('project', existing.project_id, 'activity-override', {
        supplierProjectId: existing.supplier_project_id,
        supplierName: existing.supplier_name,
        projectName: existing.project_name,
        activityName: existing.activity_name,
        previousScopeOverride: existing.scope_override,
        nextScopeOverride: scopeOverride,
      });
    }
    if (scopeOverride !== undefined && instance?.supplier_project_id) {
      evaluateApplicabilityForSupplierProject(instance.supplier_project_id);
    }
    return createSuccessResponse(toCamelCase<SupplierActivityInstance>(instance));
  } catch (error) {
    console.error('Error updating supplier activity instance:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Supplier Schedule Item Instances Handlers
// ============================================================================

function handleSupplierScheduleItemInstancesUpdate(
  _event: any,
  params: UpdateSupplierScheduleItemInstanceParams
): APIResponse<SupplierScheduleItemInstance> {
  try {
    const { id, plannedDate, actualDate, status, plannedDateOverride, scopeOverride, locked } =
      params;
    const existing = queryOne<{
      planned_date: string | null;
      planned_date_override: number;
      scope_override: string | null;
      locked: number;
      project_id: number;
      supplier_project_id: number;
      supplier_name: string;
      project_name: string;
      activity_name: string;
      schedule_item_name: string;
      supplier_activity_instance_id: number;
    }>(
      `SELECT ssi.planned_date,
              ssi.planned_date_override,
              ssi.scope_override,
              ssi.locked,
              ssi.supplier_activity_instance_id,
              sp.project_id,
              sp.id as supplier_project_id,
              s.name as supplier_name,
              p.name as project_name,
              at.name as activity_name,
              psi.name as schedule_item_name
       FROM supplier_schedule_item_instances ssi
       JOIN supplier_activity_instances sai ON ssi.supplier_activity_instance_id = sai.id
       JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       JOIN project_activities pa ON sai.project_activity_id = pa.id
       JOIN activity_templates at ON pa.activity_template_id = at.id
       JOIN project_schedule_items psi ON ssi.project_schedule_item_id = psi.id
       WHERE ssi.id = ?`,
      [id]
    );

    const updates: string[] = [];
    const values: any[] = [];

    if (plannedDate !== undefined) {
      updates.push('planned_date = ?');
      values.push(plannedDate);
    }
    if (actualDate !== undefined) {
      updates.push('actual_date = ?');
      values.push(actualDate);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (plannedDateOverride !== undefined) {
      updates.push('planned_date_override = ?');
      values.push(plannedDateOverride ? 1 : 0);
    }
    if (scopeOverride !== undefined) {
      updates.push('scope_override = ?');
      values.push(scopeOverride);
    }
    if (locked !== undefined) {
      updates.push('locked = ?');
      values.push(locked ? 1 : 0);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE supplier_schedule_item_instances SET ${updates.join(', ')} WHERE id = ?`, values);

    const instance = queryOne('SELECT * FROM supplier_schedule_item_instances WHERE id = ?', [id]);
    const nextPlannedDate =
      plannedDate !== undefined ? plannedDate : existing?.planned_date ?? null;
    const nextPlannedDateOverride =
      plannedDateOverride !== undefined
        ? plannedDateOverride
        : existing?.planned_date_override === 1;
    const nextScopeOverride =
      scopeOverride !== undefined ? scopeOverride : existing?.scope_override ?? null;
    const nextLocked = locked !== undefined ? locked : existing?.locked === 1;

    const plannedOverrideChanged =
      plannedDateOverride !== undefined &&
      existing?.planned_date_override !== (plannedDateOverride ? 1 : 0);
    const lockChanged =
      locked !== undefined && existing?.locked !== (locked ? 1 : 0);
    const scopeOverrideChanged =
      scopeOverride !== undefined && existing?.scope_override !== scopeOverride;
    const plannedDateChanged =
      plannedDate !== undefined && existing?.planned_date !== plannedDate;

    if (
      existing?.project_id &&
      (plannedOverrideChanged || lockChanged || scopeOverrideChanged || plannedDateChanged)
    ) {
      createAuditEvent('project', existing.project_id, 'schedule-item-override', {
        supplierProjectId: existing.supplier_project_id,
        supplierName: existing.supplier_name,
        projectName: existing.project_name,
        activityName: existing.activity_name,
        scheduleItemName: existing.schedule_item_name,
        previousPlannedDate: existing.planned_date,
        nextPlannedDate,
        previousPlannedDateOverride: existing.planned_date_override === 1,
        nextPlannedDateOverride,
        previousScopeOverride: existing.scope_override,
        nextScopeOverride,
        previousLocked: existing.locked === 1,
        nextLocked,
      });
    }
    if (
      (actualDate !== undefined || plannedDateOverride !== undefined) &&
      existing?.supplier_activity_instance_id
    ) {
      recalculateCompletionAnchorsForActivity(existing.supplier_activity_instance_id);
    }
    return createSuccessResponse(toCamelCase<SupplierScheduleItemInstance>(instance));
  } catch (error) {
    console.error('Error updating supplier schedule item instance:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Supplier Activity Attachments Handlers
// ============================================================================

function handleSupplierActivityAttachmentsList(
  _event: any,
  supplierActivityInstanceId: number
): APIResponse<SupplierActivityAttachment[]> {
  try {
    const attachments = query(
      `SELECT * FROM supplier_activity_attachments
       WHERE supplier_activity_instance_id = ?
       ORDER BY created_at`,
      [supplierActivityInstanceId]
    );
    return createSuccessResponse(toCamelCase<SupplierActivityAttachment[]>(attachments));
  } catch (error) {
    console.error('Error listing supplier activity attachments:', error);
    return createErrorResponse(String(error));
  }
}

function handleSupplierActivityAttachmentsCreate(
  _event: any,
  params: CreateSupplierActivityAttachmentParams
): APIResponse<SupplierActivityAttachment> {
  try {
    const { supplierActivityInstanceId, label, url } = params;
    if (!url || url.trim() === '') {
      return createErrorResponse('URL is required');
    }

    const result = run(
      `INSERT INTO supplier_activity_attachments
       (supplier_activity_instance_id, label, url)
       VALUES (?, ?, ?)`,
      [supplierActivityInstanceId, label || null, url.trim()]
    );

    const attachment = queryOne(
      'SELECT * FROM supplier_activity_attachments WHERE id = ?',
      [result.lastInsertRowid]
    );
    return createSuccessResponse(toCamelCase<SupplierActivityAttachment>(attachment));
  } catch (error) {
    console.error('Error creating supplier activity attachment:', error);
    return createErrorResponse(String(error));
  }
}

function handleSupplierActivityAttachmentsDelete(_event: any, id: number): APIResponse<void> {
  try {
    run('DELETE FROM supplier_activity_attachments WHERE id = ?', [id]);
    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting supplier activity attachment:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Parts Handlers
// ============================================================================

function handlePartsList(_event: any, supplierProjectId: number): APIResponse<Part[]> {
  try {
    const parts = query(
      'SELECT * FROM parts WHERE supplier_project_id = ? ORDER BY part_number',
      [supplierProjectId]
    );
    return createSuccessResponse(toCamelCase<Part[]>(parts));
  } catch (error) {
    console.error('Error listing parts:', error);
    return createErrorResponse(String(error));
  }
}

function handlePartsCreate(_event: any, params: CreatePartParams): APIResponse<Part> {
  try {
    const { supplierProjectId, partNumber, description, paRank, notes } = params;

    const result = run(
      `INSERT INTO parts (supplier_project_id, part_number, description, pa_rank, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [supplierProjectId, partNumber, description || null, paRank || null, notes || null]
    );

    const part = queryOne('SELECT * FROM parts WHERE id = ?', [result.lastInsertRowid]);
    evaluateApplicabilityForSupplierProject(supplierProjectId);
    return createSuccessResponse(toCamelCase<Part>(part));
  } catch (error) {
    console.error('Error creating part:', error);
    return createErrorResponse(String(error));
  }
}

function handlePartsUpdate(_event: any, params: UpdatePartParams): APIResponse<Part> {
  try {
    const { id, partNumber, description, paRank, notes } = params;
    const existingPart = queryOne<{ supplier_project_id: number }>(
      'SELECT supplier_project_id FROM parts WHERE id = ?',
      [id]
    );

    const updates: string[] = [];
    const values: any[] = [];

    if (partNumber !== undefined) {
      updates.push('part_number = ?');
      values.push(partNumber);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (paRank !== undefined) {
      updates.push('pa_rank = ?');
      values.push(paRank);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE parts SET ${updates.join(', ')} WHERE id = ?`, values);

    if (existingPart) {
      evaluateApplicabilityForSupplierProject(existingPart.supplier_project_id);
    }

    const part = queryOne('SELECT * FROM parts WHERE id = ?', [id]);
    return createSuccessResponse(toCamelCase<Part>(part));
  } catch (error) {
    console.error('Error updating part:', error);
    return createErrorResponse(String(error));
  }
}

function handlePartsDelete(_event: any, id: number): APIResponse<void> {
  try {
    const existingPart = queryOne<{ supplier_project_id: number }>(
      'SELECT supplier_project_id FROM parts WHERE id = ?',
      [id]
    );
    const result = run('DELETE FROM parts WHERE id = ?', [id]);

    if (result.changes === 0) {
      return createErrorResponse(`Part not found: ${id}`);
    }

    if (existingPart) {
      evaluateApplicabilityForSupplierProject(existingPart.supplier_project_id);
    }

    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error deleting part:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Projects - Composite Detail Handler
// ============================================================================

function handleProjectsGetDetail(_event: any, id: number): APIResponse<ProjectDetail> {
  try {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);

    if (!project) {
      return createErrorResponse(`Project not found: ${id}`);
    }

    // Get all activities for this project
    const activities = query(
      `SELECT pa.*, at.name as activity_template_name, at.category as activity_template_category
       FROM project_activities pa
       JOIN activity_templates at ON pa.activity_template_id = at.id
       WHERE pa.project_id = ?
       ORDER BY pa.sort_order`,
      [id]
    );

    // For each activity, get schedule items with computed dates
    const projectAnchorDate = project.project_anchor_date ?? null;
    const useBusinessDays = getUseBusinessDaysSetting();
    const activitiesWithDetails: ProjectActivityDetail[] = activities.map((activity: any) => {
      const scheduleItems = query<ProjectScheduleItem>(
        'SELECT * FROM project_schedule_items WHERE project_activity_id = ? ORDER BY sort_order',
        [activity.id]
      );

      const itemsWithDates = calculateScheduleDates(
        toCamelCase<ProjectScheduleItem[]>(scheduleItems),
        projectAnchorDate,
        undefined, // supplierAnchorDate
        useBusinessDays
      );

      return {
        ...toCamelCase<ProjectActivity>(activity),
        activityTemplateName: activity.activity_template_name,
        activityTemplateCategory: activity.activity_template_category || null,
        scheduleItems: itemsWithDates
      };
    });

    const result: ProjectDetail = {
      ...toCamelCase<Project>(project),
      activities: activitiesWithDetails
    };

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error getting project detail:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Phase 4: Propagation + Audit Handlers
// ============================================================================

function handleProjectsPreviewPropagation(
  _event: any,
  projectId: number
): APIResponse<PropagationPreview> {
  try {
    const preview = previewPropagation(projectId);
    return createSuccessResponse(preview);
  } catch (error) {
    console.error('Error previewing propagation:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectsPropagateChanges(
  _event: any,
  projectId: number
): APIResponse<PropagationResult> {
  try {
    const result = propagateChanges(projectId, false);

    // Create audit event for the propagation
    createAuditEvent('project', projectId, 'propagate', {
      updated: result.updated.length,
      skipped: result.skipped.length,
      timestamp: new Date().toISOString(),
    });

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error propagating changes:', error);
    return createErrorResponse(String(error));
  }
}

function handleAuditList(
  _event: any,
  params: AuditEventQuery
): APIResponse<AuditEvent[]> {
  try {
    const events = queryAuditLog(
      params.entityType,
      params.entityId,
      params.limit
    );
    return createSuccessResponse(events);
  } catch (error) {
    console.error('Error listing audit events:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Phase 5: Settings Handlers
// ============================================================================

function handleSettingsGetAll(): APIResponse<AppSettings> {
  try {
    const settings = query('SELECT * FROM settings');
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[(s as any).key] = (s as any).value;
    }

    const result: AppSettings = {
      nmrRanks: JSON.parse(settingsMap['nmr_ranks'] || '[]'),
      paRanks: JSON.parse(settingsMap['pa_ranks'] || '[]'),
      propagationSkipComplete: settingsMap['propagation_skip_complete'] === 'true',
      propagationSkipLocked: settingsMap['propagation_skip_locked'] === 'true',
      propagationSkipOverridden: settingsMap['propagation_skip_overridden'] === 'true',
      dateFormat: (settingsMap['date_format'] || 'MM/DD/YYYY') as AppSettings['dateFormat'],
      useBusinessDays: settingsMap['use_business_days'] === 'true',
    };

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error getting settings:', error);
    return createErrorResponse(String(error));
  }
}

function handleSettingsUpdate(_event: any, params: UpdateSettingParams): APIResponse<void> {
  try {
    const { key, value } = params;
    run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
      [key, value, value]
    );
    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error updating setting:', error);
    return createErrorResponse(String(error));
  }
}

async function handleSettingsExportDatabase(): Promise<APIResponse<FileDialogResult>> {
  try {
    const dbPath = await getDatabasePath();
    const defaultName = `supplier-tracking-backup-${formatVersionDate(new Date())}.db`;
    const defaultPath = path.join(app.getPath('documents'), defaultName);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Database',
      defaultPath,
      filters: [
        { name: 'SQLite Database', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) {
      return createSuccessResponse({ canceled: true });
    }

    const outputPath = path.extname(filePath).toLowerCase() === '.db' ? filePath : `${filePath}.db`;
    saveDatabase();
    fs.copyFileSync(dbPath, outputPath);

    return createSuccessResponse({ canceled: false, path: outputPath });
  } catch (error) {
    console.error('Error exporting database:', error);
    return createErrorResponse(String(error));
  }
}

async function handleSettingsImportDatabase(): Promise<APIResponse<FileDialogResult>> {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Database',
      properties: ['openFile'],
      filters: [
        { name: 'SQLite Database', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return createSuccessResponse({ canceled: true });
    }

    const sourcePath = filePaths[0];
    const dbPath = await getDatabasePath();

    closeDatabase();
    fs.copyFileSync(sourcePath, dbPath);
    await runMigrations();

    return createSuccessResponse({ canceled: false, path: sourcePath });
  } catch (error) {
    console.error('Error importing database:', error);
    return createErrorResponse(String(error));
  }
}

async function handleSettingsWipeDatabase(): Promise<APIResponse<void>> {
  try {
    const dbPath = await getDatabasePath();
    closeDatabase();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    await runMigrations();
    return createSuccessResponse(undefined);
  } catch (error) {
    console.error('Error wiping database:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Phase 5: Dashboard Handlers
// ============================================================================

function handleDashboardGetData(_event: any, filters: DashboardFilters): APIResponse<DashboardData> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dueRange = filters.dueRange || 14;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + dueRange);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.supplierId) {
      conditions.push('sp.supplier_id = ?');
      params.push(filters.supplierId);
    }
    if (filters.projectId) {
      conditions.push('sp.project_id = ?');
      params.push(filters.projectId);
    }
    if (filters.status) {
      conditions.push('ssi.status = ?');
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

    // Get summary counts
    const overdueCount = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM supplier_schedule_item_instances ssi
       JOIN supplier_activity_instances sai ON ssi.supplier_activity_instance_id = sai.id
       JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
       WHERE ssi.planned_date < ? AND ssi.status NOT IN ('Complete', 'Not Required') ${whereClause}`,
      [today, ...params]
    )?.count || 0;

    const dueSoonCount = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM supplier_schedule_item_instances ssi
       JOIN supplier_activity_instances sai ON ssi.supplier_activity_instance_id = sai.id
       JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
       WHERE ssi.planned_date >= ? AND ssi.planned_date <= ? AND ssi.status NOT IN ('Complete', 'Not Required') ${whereClause}`,
      [today, futureDateStr, ...params]
    )?.count || 0;

    const blockedCount = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM supplier_schedule_item_instances ssi
       JOIN supplier_activity_instances sai ON ssi.supplier_activity_instance_id = sai.id
       JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
       WHERE ssi.status = 'Blocked' ${whereClause}`,
      [...params]
    )?.count || 0;

    // Count projects needing propagation (simplified - projects with date changes)
    const needsPropagationCount = 0; // TODO: Implement propagation detection

    const summary: DashboardSummary = {
      overdue: overdueCount,
      dueSoon: dueSoonCount,
      blocked: blockedCount,
      needsPropagation: needsPropagationCount,
    };

    // Get actionable items
    const items = query(
      `SELECT
        ssi.id as supplier_schedule_item_instance_id,
        ssi.planned_date as due_date,
        s.id as supplier_id,
        s.name as supplier_name,
        p.id as project_id,
        p.name as project_name,
        at.name as activity_name,
        psi.name as item_name,
        psi.kind as item_kind,
        ssi.status,
        CASE WHEN ssi.planned_date < ? AND ssi.status NOT IN ('Complete', 'Not Required') THEN 1 ELSE 0 END as is_late
       FROM supplier_schedule_item_instances ssi
       JOIN supplier_activity_instances sai ON ssi.supplier_activity_instance_id = sai.id
       JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       JOIN project_activities pa ON sai.project_activity_id = pa.id
       JOIN activity_templates at ON pa.activity_template_id = at.id
       JOIN project_schedule_items psi ON ssi.project_schedule_item_id = psi.id
       WHERE ssi.status NOT IN ('Complete', 'Not Required')
         AND ssi.planned_date IS NOT NULL
         AND ssi.planned_date <= ?
         ${whereClause}
       ORDER BY ssi.planned_date ASC
       LIMIT 100`,
      [today, futureDateStr, ...params]
    );

    const actionableItems: ActionableItem[] = items.map((item: any, index: number) => ({
      id: index,
      supplierScheduleItemInstanceId: item.supplier_schedule_item_instance_id,
      dueDate: item.due_date,
      supplierId: item.supplier_id,
      supplierName: item.supplier_name,
      projectId: item.project_id,
      projectName: item.project_name,
      activityName: item.activity_name,
      itemName: item.item_name,
      itemKind: item.item_kind,
      status: item.status,
      isLate: item.is_late === 1,
    }));

    return createSuccessResponse({ summary, actionableItems });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Phase 5: Reports Handlers
// ============================================================================

function handleReportsGetOverview(): APIResponse<ReportsOverview> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const total = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM supplier_schedule_item_instances'
    )?.count || 0;

    const completed = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM supplier_schedule_item_instances WHERE status = 'Complete'`
    )?.count || 0;

    const overdue = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM supplier_schedule_item_instances
       WHERE planned_date < ? AND status NOT IN ('Complete', 'Not Required')`,
      [today]
    )?.count || 0;

    const dueSoon = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM supplier_schedule_item_instances
       WHERE planned_date >= ? AND planned_date <= ? AND status NOT IN ('Complete', 'Not Required')`,
      [today, futureDateStr]
    )?.count || 0;

    return createSuccessResponse({
      overdueCount: overdue,
      dueSoonCount: dueSoon,
      overallCompletionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalItems: total,
      completedItems: completed,
    });
  } catch (error) {
    console.error('Error getting reports overview:', error);
    return createErrorResponse(String(error));
  }
}

function handleReportsGetSupplierProgress(): APIResponse<SupplierProgress[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const suppliers = query(
      `SELECT
        s.id as supplier_id,
        s.name as supplier_name,
        COUNT(ssi.id) as total_items,
        SUM(CASE WHEN ssi.status = 'Complete' THEN 1 ELSE 0 END) as completed_items,
        SUM(CASE WHEN ssi.planned_date < ? AND ssi.status NOT IN ('Complete', 'Not Required') THEN 1 ELSE 0 END) as overdue_items
       FROM suppliers s
       LEFT JOIN supplier_projects sp ON s.id = sp.supplier_id
       LEFT JOIN supplier_activity_instances sai ON sp.id = sai.supplier_project_id
       LEFT JOIN supplier_schedule_item_instances ssi ON sai.id = ssi.supplier_activity_instance_id
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      [today]
    );

    const result: SupplierProgress[] = suppliers.map((s: any) => {
      const progressPercent = s.total_items > 0 ? Math.round((s.completed_items / s.total_items) * 100) : 0;
      let status: 'On Track' | 'At Risk' | 'Behind' = 'On Track';
      if (s.overdue_items > 0) {
        status = 'Behind';
      } else if (progressPercent < 50) {
        status = 'At Risk';
      }

      return {
        supplierId: s.supplier_id,
        supplierName: s.supplier_name,
        totalItems: s.total_items || 0,
        completedItems: s.completed_items || 0,
        overdueItems: s.overdue_items || 0,
        progressPercent,
        status,
      };
    });

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error getting supplier progress:', error);
    return createErrorResponse(String(error));
  }
}

function handleReportsGetProjectProgress(): APIResponse<ProjectProgress[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const projects = query(
      `SELECT
        p.id as project_id,
        p.name as project_name,
        p.version as project_version,
        COUNT(DISTINCT sp.id) as supplier_count,
        COUNT(ssi.id) as total_items,
        SUM(CASE WHEN ssi.status = 'Complete' THEN 1 ELSE 0 END) as completed_items,
        SUM(CASE WHEN ssi.planned_date < ? AND ssi.status NOT IN ('Complete', 'Not Required') THEN 1 ELSE 0 END) as overdue_items
       FROM projects p
       LEFT JOIN supplier_projects sp ON p.id = sp.project_id
       LEFT JOIN supplier_activity_instances sai ON sp.id = sai.supplier_project_id
       LEFT JOIN supplier_schedule_item_instances ssi ON sai.id = ssi.supplier_activity_instance_id
       GROUP BY p.id, p.name, p.version
       ORDER BY p.name, p.version`,
      [today]
    );

    const result: ProjectProgress[] = projects.map((p: any) => {
      const totalItems = p.total_items || 0;
      const completedItems = p.completed_items || 0;
      const overdueItems = p.overdue_items || 0;
      const progressPercent =
        totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      let status: 'On Track' | 'At Risk' | 'Behind' = 'On Track';
      if (overdueItems > 0) {
        status = 'Behind';
      } else if (progressPercent < 50) {
        status = 'At Risk';
      }

      return {
        projectId: p.project_id,
        projectName: p.project_name,
        projectVersion: p.project_version,
        supplierCount: p.supplier_count || 0,
        totalItems,
        completedItems,
        overdueItems,
        progressPercent,
        status,
      };
    });

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error getting project progress:', error);
    return createErrorResponse(String(error));
  }
}

function handleReportsGetOverdueItems(): APIResponse<ReportScheduleItem[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const items = query(
      `SELECT
        ssi.id as supplier_schedule_item_instance_id,
        ssi.planned_date as due_date,
        s.id as supplier_id,
        s.name as supplier_name,
        p.id as project_id,
        p.name as project_name,
        at.name as activity_name,
        psi.name as item_name,
        psi.kind as item_kind,
        ssi.status,
        CAST(julianday(ssi.planned_date) - julianday(?) AS INTEGER) as days_until_due
       FROM supplier_schedule_item_instances ssi
       JOIN supplier_activity_instances sai ON ssi.supplier_activity_instance_id = sai.id
       JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       JOIN project_activities pa ON sai.project_activity_id = pa.id
       JOIN activity_templates at ON pa.activity_template_id = at.id
       JOIN project_schedule_items psi ON ssi.project_schedule_item_id = psi.id
       WHERE ssi.planned_date < ? AND ssi.status NOT IN ('Complete', 'Not Required')
       ORDER BY ssi.planned_date ASC
       LIMIT 200`,
      [today, today]
    );

    const result: ReportScheduleItem[] = items.map((item: any) => ({
      supplierScheduleItemInstanceId: item.supplier_schedule_item_instance_id,
      dueDate: item.due_date,
      supplierId: item.supplier_id,
      supplierName: item.supplier_name,
      projectId: item.project_id,
      projectName: item.project_name,
      activityName: item.activity_name,
      itemName: item.item_name,
      itemKind: item.item_kind,
      status: item.status,
      daysUntilDue: Number(item.days_until_due) || 0,
    }));

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error getting overdue items:', error);
    return createErrorResponse(String(error));
  }
}

function handleReportsGetDueSoonItems(): APIResponse<ReportScheduleItem[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const items = query(
      `SELECT
        ssi.id as supplier_schedule_item_instance_id,
        ssi.planned_date as due_date,
        s.id as supplier_id,
        s.name as supplier_name,
        p.id as project_id,
        p.name as project_name,
        at.name as activity_name,
        psi.name as item_name,
        psi.kind as item_kind,
        ssi.status,
        CAST(julianday(ssi.planned_date) - julianday(?) AS INTEGER) as days_until_due
       FROM supplier_schedule_item_instances ssi
       JOIN supplier_activity_instances sai ON ssi.supplier_activity_instance_id = sai.id
       JOIN supplier_projects sp ON sai.supplier_project_id = sp.id
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       JOIN project_activities pa ON sai.project_activity_id = pa.id
       JOIN activity_templates at ON pa.activity_template_id = at.id
       JOIN project_schedule_items psi ON ssi.project_schedule_item_id = psi.id
       WHERE ssi.planned_date >= ? AND ssi.planned_date <= ?
         AND ssi.status NOT IN ('Complete', 'Not Required')
       ORDER BY ssi.planned_date ASC
       LIMIT 200`,
      [today, today, futureDateStr]
    );

    const result: ReportScheduleItem[] = items.map((item: any) => ({
      supplierScheduleItemInstanceId: item.supplier_schedule_item_instance_id,
      dueDate: item.due_date,
      supplierId: item.supplier_id,
      supplierName: item.supplier_name,
      projectId: item.project_id,
      projectName: item.project_name,
      activityName: item.activity_name,
      itemName: item.item_name,
      itemKind: item.item_kind,
      status: item.status,
      daysUntilDue: Number(item.days_until_due) || 0,
    }));

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error getting due soon items:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Phase 5: Enhanced List Handlers with Stats
// ============================================================================

function handleSuppliersListWithStats(): APIResponse<SupplierWithStats[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const suppliers = query(
      `SELECT
        s.*,
        COUNT(DISTINCT sp.id) as active_projects,
        SUM(CASE WHEN ssi.planned_date < ? AND ssi.status NOT IN ('Complete', 'Not Required') THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN ssi.planned_date >= ? AND ssi.planned_date <= ? AND ssi.status NOT IN ('Complete', 'Not Required') THEN 1 ELSE 0 END) as due_soon_count
       FROM suppliers s
       LEFT JOIN supplier_projects sp ON s.id = sp.supplier_id
       LEFT JOIN supplier_activity_instances sai ON sp.id = sai.supplier_project_id
       LEFT JOIN supplier_schedule_item_instances ssi ON sai.id = ssi.supplier_activity_instance_id
       GROUP BY s.id
       ORDER BY s.name`,
      [today, today, futureDateStr]
    );

    const result: SupplierWithStats[] = suppliers.map((s: any) => {
      let status: 'On Track' | 'At Risk' | 'Behind' = 'On Track';
      if (s.overdue_count > 0) {
        status = 'Behind';
      } else if (s.due_soon_count > 3) {
        status = 'At Risk';
      }

      return {
        ...toCamelCase<Supplier>(s),
        activeProjects: s.active_projects || 0,
        overdueCount: s.overdue_count || 0,
        dueSoonCount: s.due_soon_count || 0,
        status,
      };
    });

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error listing suppliers with stats:', error);
    return createErrorResponse(String(error));
  }
}

function handleProjectsListWithStats(): APIResponse<ProjectWithStats[]> {
  try {
    const projects = query(
      `SELECT
        p.*,
        COUNT(DISTINCT pa.id) as activity_count,
        COUNT(DISTINCT sp.id) as supplier_count,
        MIN(CASE WHEN ssi.status NOT IN ('Complete', 'Not Required') THEN ssi.planned_date END) as next_due,
        MAX(p.created_at) as last_updated
       FROM projects p
       LEFT JOIN project_activities pa ON p.id = pa.project_id
       LEFT JOIN supplier_projects sp ON p.id = sp.project_id
       LEFT JOIN supplier_activity_instances sai ON sp.id = sai.supplier_project_id
       LEFT JOIN supplier_schedule_item_instances ssi ON sai.id = ssi.supplier_activity_instance_id
       GROUP BY p.id
       ORDER BY p.name, p.version`
    );

    const result: ProjectWithStats[] = projects.map((p: any) => ({
      ...toCamelCase<Project>(p),
      activityCount: p.activity_count || 0,
      supplierCount: p.supplier_count || 0,
      nextDue: p.next_due || null,
      nextDueDate: p.next_due || null, // alias for nextDue
      lastUpdated: p.last_updated || null,
    }));

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error listing projects with stats:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplatesListWithCounts(): APIResponse<ActivityTemplateWithCounts[]> {
  try {
    const templates = query(
      `SELECT
        at.*,
        SUM(CASE WHEN atsi.kind = 'MILESTONE' THEN 1 ELSE 0 END) as milestone_count,
        SUM(CASE WHEN atsi.kind = 'TASK' THEN 1 ELSE 0 END) as task_count
       FROM activity_templates at
       LEFT JOIN activity_template_schedule_items atsi ON at.id = atsi.activity_template_id
       GROUP BY at.id
       ORDER BY at.name`
    );

    const result: ActivityTemplateWithCounts[] = templates.map((t: any) => ({
      ...toCamelCase<ActivityTemplate>(t),
      milestoneCount: t.milestone_count || 0,
      taskCount: t.task_count || 0,
    }));

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error listing activity templates with counts:', error);
    return createErrorResponse(String(error));
  }
}

function handleSupplierProjectsListBySupplierWithProgress(
  _event: any,
  supplierId: number
): APIResponse<SupplierProjectWithProgress[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const supplierProjects = query(
      `SELECT
        sp.*,
        s.name as supplier_name,
        p.name as project_name,
        p.project_anchor_date,
        at.name as activity_name,
        COUNT(ssi.id) as total_items,
        SUM(CASE WHEN ssi.status = 'Complete' THEN 1 ELSE 0 END) as completed_items,
        SUM(CASE WHEN ssi.planned_date < ? AND ssi.status NOT IN ('Complete', 'Not Required') THEN 1 ELSE 0 END) as overdue_items,
        MIN(CASE WHEN ssi.status NOT IN ('Complete', 'Not Required') THEN ssi.planned_date END) as next_due
       FROM supplier_projects sp
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       LEFT JOIN supplier_activity_instances sai ON sp.id = sai.supplier_project_id
       LEFT JOIN project_activities pa ON sai.project_activity_id = pa.id
       LEFT JOIN activity_templates at ON pa.activity_template_id = at.id
       LEFT JOIN supplier_schedule_item_instances ssi ON sai.id = ssi.supplier_activity_instance_id
       WHERE sp.supplier_id = ?
       GROUP BY sp.id
       ORDER BY p.name, sp.project_version`,
      [today, supplierId]
    );

    const result: SupplierProjectWithProgress[] = supplierProjects.map((sp: any) => {
      const totalItems = sp.total_items || 0;
      const completedItems = sp.completed_items || 0;
      const overdueItems = sp.overdue_items || 0;
      const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      let status: 'On Track' | 'At Risk' | 'Behind' = 'On Track';
      if (overdueItems > 0) {
        status = 'Behind';
      } else if (totalItems > 0 && (completedItems / totalItems) < 0.5) {
        status = 'At Risk';
      }

      return {
        ...toCamelCase<SupplierProjectSummary>({
          ...sp,
          supplier_name: sp.supplier_name,
          project_name: sp.project_name,
          project_anchor_date: sp.project_anchor_date,
        }),
        supplierName: sp.supplier_name,
        projectName: sp.project_name,
        projectAnchorDate: sp.project_anchor_date,
        activityName: sp.activity_name || null,
        totalItems,
        completedItems,
        overdueItems,
        overdueCount: overdueItems, // alias for overdueItems
        progressPercent,
        nextDue: sp.next_due || null,
        nextDueDate: sp.next_due || null, // alias for nextDue
        status,
      };
    });

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error listing supplier projects with progress:', error);
    return createErrorResponse(String(error));
  }
}

function handleActivityTemplatesDuplicate(_event: any, id: number): APIResponse<ActivityTemplate> {
  try {
    const original = queryOne('SELECT * FROM activity_templates WHERE id = ?', [id]);
    if (!original) {
      return createErrorResponse(`Activity template not found: ${id}`);
    }

    // Create duplicate template
    const result = run(
      `INSERT INTO activity_templates (name, description, category, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [`${original.name} (Copy)`, original.description, original.category]
    );

    // Copy schedule items
    const scheduleItems = query(
      'SELECT * FROM activity_template_schedule_items WHERE activity_template_id = ? ORDER BY id',
      [id]
    );

    const oldToNewIdMap = new Map<number, number>();

    // First pass: create items without anchor refs
    for (const item of scheduleItems) {
      const itemResult = run(
        `INSERT INTO activity_template_schedule_items
         (activity_template_id, kind, name, anchor_type, anchor_ref_id, offset_days)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [result.lastInsertRowid, (item as any).kind, (item as any).name, (item as any).anchor_type, (item as any).offset_days]
      );
      oldToNewIdMap.set((item as any).id, itemResult.lastInsertRowid);
    }

    // Second pass: update anchor refs
    for (const item of scheduleItems) {
      if ((item as any).anchor_ref_id) {
        const newId = oldToNewIdMap.get((item as any).id);
        const newAnchorRefId = oldToNewIdMap.get((item as any).anchor_ref_id);
        if (newId && newAnchorRefId) {
          run('UPDATE activity_template_schedule_items SET anchor_ref_id = ? WHERE id = ?', [
            newAnchorRefId,
            newId,
          ]);
        }
      }
    }

    const template = queryOne('SELECT * FROM activity_templates WHERE id = ?', [
      result.lastInsertRowid,
    ]);

    return createSuccessResponse(toCamelCase<ActivityTemplate>(template));
  } catch (error) {
    console.error('Error duplicating activity template:', error);
    return createErrorResponse(String(error));
  }
}

// ============================================================================
// Register All Handlers
// ============================================================================

export function registerHandlers(): void {
  // Suppliers
  ipcMain.handle('suppliers:list', handleSuppliersList);
  ipcMain.handle('suppliers:get', handleSuppliersGet);
  ipcMain.handle('suppliers:create', handleSuppliersCreate);
  ipcMain.handle('suppliers:update', handleSuppliersUpdate);
  ipcMain.handle('suppliers:delete', handleSuppliersDelete);

  // Activity Templates
  ipcMain.handle('activity-templates:list', handleActivityTemplatesList);
  ipcMain.handle('activity-templates:get', handleActivityTemplatesGet);
  ipcMain.handle('activity-templates:create', handleActivityTemplatesCreate);
  ipcMain.handle('activity-templates:update', handleActivityTemplatesUpdate);
  ipcMain.handle('activity-templates:delete', handleActivityTemplatesDelete);
  ipcMain.handle(
    'activity-template-schedule-items:list',
    handleActivityTemplateScheduleItemsList
  );
  ipcMain.handle(
    'activity-template-schedule-items:create',
    handleActivityTemplateScheduleItemsCreate
  );
  ipcMain.handle(
    'activity-template-schedule-items:update',
    handleActivityTemplateScheduleItemsUpdate
  );
  ipcMain.handle(
    'activity-template-schedule-items:delete',
    handleActivityTemplateScheduleItemsDelete
  );
  ipcMain.handle(
    'activity-template-applicability:get',
    handleActivityTemplateApplicabilityGet
  );
  ipcMain.handle(
    'activity-template-applicability:upsert-rule',
    handleActivityTemplateApplicabilityUpsertRule
  );
  ipcMain.handle(
    'activity-template-applicability:delete-rule',
    handleActivityTemplateApplicabilityDeleteRule
  );
  ipcMain.handle(
    'activity-template-applicability:create-clause',
    handleActivityTemplateApplicabilityCreateClause
  );
  ipcMain.handle(
    'activity-template-applicability:update-clause',
    handleActivityTemplateApplicabilityUpdateClause
  );
  ipcMain.handle(
    'activity-template-applicability:delete-clause',
    handleActivityTemplateApplicabilityDeleteClause
  );

  // Projects
  ipcMain.handle('projects:list', handleProjectsList);
  ipcMain.handle('projects:get', handleProjectsGet);
  ipcMain.handle('projects:create', handleProjectsCreate);
  ipcMain.handle('projects:update', handleProjectsUpdate);
  ipcMain.handle('projects:delete', handleProjectsDelete);
  ipcMain.handle('projects:get-detail', handleProjectsGetDetail);

  // Project Activities
  ipcMain.handle('project-activities:list', handleProjectActivitiesList);
  ipcMain.handle('project-activities:get', handleProjectActivitiesGet);
  ipcMain.handle('project-activities:create', handleProjectActivitiesCreate);
  ipcMain.handle('project-activities:update', handleProjectActivitiesUpdate);
  ipcMain.handle('project-activities:delete', handleProjectActivitiesDelete);
  ipcMain.handle(
    'project-activities:sync-from-template',
    handleProjectActivitiesSyncFromTemplate
  );

  // Schedule Items
  ipcMain.handle('schedule-items:list', handleScheduleItemsList);
  ipcMain.handle('schedule-items:get', handleScheduleItemsGet);
  ipcMain.handle('schedule-items:create', handleScheduleItemsCreate);
  ipcMain.handle('schedule-items:update', handleScheduleItemsUpdate);
  ipcMain.handle('schedule-items:delete', handleScheduleItemsDelete);

  // Supplier Projects
  ipcMain.handle('supplier-projects:list', handleSupplierProjectsList);
  ipcMain.handle('supplier-projects:list-by-supplier', handleSupplierProjectsListBySupplier);
  ipcMain.handle('supplier-projects:get-detail', handleSupplierProjectsGetDetail);
  ipcMain.handle('supplier-projects:apply', handleSupplierProjectsApply);
  ipcMain.handle('supplier-projects:update', handleSupplierProjectsUpdate);

  // Supplier Activity Instances
  ipcMain.handle('supplier-activity-instances:update', handleSupplierActivityInstancesUpdate);

  // Supplier Schedule Item Instances
  ipcMain.handle('supplier-schedule-item-instances:update', handleSupplierScheduleItemInstancesUpdate);

  // Supplier Activity Attachments
  ipcMain.handle('supplier-activity-attachments:list', handleSupplierActivityAttachmentsList);
  ipcMain.handle('supplier-activity-attachments:create', handleSupplierActivityAttachmentsCreate);
  ipcMain.handle('supplier-activity-attachments:delete', handleSupplierActivityAttachmentsDelete);

  // Parts
  ipcMain.handle('parts:list', handlePartsList);
  ipcMain.handle('parts:create', handlePartsCreate);
  ipcMain.handle('parts:update', handlePartsUpdate);
  ipcMain.handle('parts:delete', handlePartsDelete);

  // Phase 4: Propagation + Audit
  ipcMain.handle('projects:preview-propagation', handleProjectsPreviewPropagation);
  ipcMain.handle('projects:propagate-changes', handleProjectsPropagateChanges);
  ipcMain.handle('audit:list', handleAuditList);

  // Phase 5: Settings
  ipcMain.handle('settings:get-all', handleSettingsGetAll);
  ipcMain.handle('settings:update', handleSettingsUpdate);
  ipcMain.handle('settings:export-database', handleSettingsExportDatabase);
  ipcMain.handle('settings:import-database', handleSettingsImportDatabase);
  ipcMain.handle('settings:wipe-database', handleSettingsWipeDatabase);

  // Phase 5: Dashboard
  ipcMain.handle('dashboard:get-data', handleDashboardGetData);

  // Phase 5: Reports
  ipcMain.handle('reports:get-overview', handleReportsGetOverview);
  ipcMain.handle('reports:get-supplier-progress', handleReportsGetSupplierProgress);
  ipcMain.handle('reports:get-project-progress', handleReportsGetProjectProgress);
  ipcMain.handle('reports:get-overdue-items', handleReportsGetOverdueItems);
  ipcMain.handle('reports:get-due-soon-items', handleReportsGetDueSoonItems);

  // Phase 5: Enhanced list handlers with stats
  ipcMain.handle('suppliers:list-with-stats', handleSuppliersListWithStats);
  ipcMain.handle('projects:list-with-stats', handleProjectsListWithStats);
  ipcMain.handle('activity-templates:list-with-counts', handleActivityTemplatesListWithCounts);
  ipcMain.handle('supplier-projects:list-by-supplier-with-progress', handleSupplierProjectsListBySupplierWithProgress);
  ipcMain.handle('activity-templates:duplicate', handleActivityTemplatesDuplicate);

  console.log('✓ All IPC handlers registered');
}
