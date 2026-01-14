import { ipcMain } from 'electron';
import { query, queryOne, run, toCamelCase } from './database.js';
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
  SyncProjectActivityFromTemplateParams,
  UpdateSupplierActivityInstanceParams,
  UpdateSupplierScheduleItemInstanceParams,
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
  ActivityTemplateScheduleItem,
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
  SupplierWithStats,
  ProjectWithStats,
  ActivityTemplateWithCounts,
  SupplierProjectWithProgress,
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
    const { name, nmrRank, notes } = params;

    const result = run(
      `INSERT INTO suppliers (name, nmr_rank, notes)
       VALUES (?, ?, ?)`,
      [name, nmrRank || null, notes || null]
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
    const { id, name, nmrRank, notes } = params;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (nmrRank !== undefined) {
      updates.push('nmr_rank = ?');
      values.push(nmrRank);
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

    const projectItemByTemplateId = new Map<number, any>();
    for (const projectItemRaw of projectItemsRaw) {
      if (projectItemRaw.template_item_id) {
        projectItemByTemplateId.set(projectItemRaw.template_item_id, projectItemRaw);
      }
    }

    const projectItemIdByTemplateId = new Map<number, number>();

    for (const projectItemRaw of projectItemsRaw) {
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
            projectItemsRaw.length,
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
      `SELECT sp.*, s.name as supplier_name, s.nmr_rank, p.name as project_name, p.project_anchor_date
       FROM supplier_projects sp
       JOIN suppliers s ON sp.supplier_id = s.id
       JOIN projects p ON sp.project_id = p.id
       WHERE sp.id = ?`,
      [id]
    );

    if (!supplierProject) {
      return createErrorResponse(`Supplier project not found: ${id}`);
    }

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

      return {
        ...toCamelCase<SupplierActivityInstance>(activity),
        activityTemplateName: activity.activity_template_name,
        scheduleItems: toCamelCase<SupplierScheduleItemDetail[]>(scheduleItems),
      };
    });

    const result: SupplierProjectDetail = {
      ...toCamelCase<SupplierProject>(supplierProject),
      supplierName: supplierProject.supplier_name,
      projectName: supplierProject.project_name,
      projectAnchorDate: supplierProject.project_anchor_date,
      nmrRank: supplierProject.nmr_rank || null,
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
    const { supplierId, projectId, supplierAnchorDate } = params;

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

    const insertResult = run(
      `INSERT INTO supplier_projects (supplier_id, project_id, project_version, supplier_anchor_date)
       VALUES (?, ?, ?, ?)`,
      [supplierId, projectId, project.version, supplierAnchorDate || null]
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

    for (const activity of projectActivities) {
      const activityInsert = run(
        `INSERT INTO supplier_activity_instances (supplier_project_id, project_activity_id)
         VALUES (?, ?)`,
        [supplierProjectId, activity.id]
      );

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
    const { id, supplierAnchorDate } = params;

    const updates: string[] = [];
    const values: any[] = [];

    if (supplierAnchorDate !== undefined) {
      updates.push('supplier_anchor_date = ?');
      values.push(supplierAnchorDate);
    }

    if (updates.length === 0) {
      return createErrorResponse('No fields to update');
    }

    values.push(id);
    run(`UPDATE supplier_projects SET ${updates.join(', ')} WHERE id = ?`, values);

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
    return createSuccessResponse(toCamelCase<SupplierScheduleItemInstance>(instance));
  } catch (error) {
    console.error('Error updating supplier schedule item instance:', error);
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
    return createSuccessResponse(toCamelCase<Part>(part));
  } catch (error) {
    console.error('Error creating part:', error);
    return createErrorResponse(String(error));
  }
}

function handlePartsUpdate(_event: any, params: UpdatePartParams): APIResponse<Part> {
  try {
    const { id, partNumber, description, paRank, notes } = params;

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

    const part = queryOne('SELECT * FROM parts WHERE id = ?', [id]);
    return createSuccessResponse(toCamelCase<Part>(part));
  } catch (error) {
    console.error('Error updating part:', error);
    return createErrorResponse(String(error));
  }
}

function handlePartsDelete(_event: any, id: number): APIResponse<void> {
  try {
    const result = run('DELETE FROM parts WHERE id = ?', [id]);

    if (result.changes === 0) {
      return createErrorResponse(`Part not found: ${id}`);
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
        s.nmr_rank,
        COUNT(ssi.id) as total_items,
        SUM(CASE WHEN ssi.status = 'Complete' THEN 1 ELSE 0 END) as completed_items,
        SUM(CASE WHEN ssi.planned_date < ? AND ssi.status NOT IN ('Complete', 'Not Required') THEN 1 ELSE 0 END) as overdue_items
       FROM suppliers s
       LEFT JOIN supplier_projects sp ON s.id = sp.supplier_id
       LEFT JOIN supplier_activity_instances sai ON sp.id = sai.supplier_project_id
       LEFT JOIN supplier_schedule_item_instances ssi ON sai.id = ssi.supplier_activity_instance_id
       GROUP BY s.id, s.name, s.nmr_rank
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
        nmrRank: s.nmr_rank,
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

  // Phase 5: Dashboard
  ipcMain.handle('dashboard:get-data', handleDashboardGetData);

  // Phase 5: Reports
  ipcMain.handle('reports:get-overview', handleReportsGetOverview);
  ipcMain.handle('reports:get-supplier-progress', handleReportsGetSupplierProgress);

  // Phase 5: Enhanced list handlers with stats
  ipcMain.handle('suppliers:list-with-stats', handleSuppliersListWithStats);
  ipcMain.handle('projects:list-with-stats', handleProjectsListWithStats);
  ipcMain.handle('activity-templates:list-with-counts', handleActivityTemplatesListWithCounts);
  ipcMain.handle('supplier-projects:list-by-supplier-with-progress', handleSupplierProjectsListBySupplierWithProgress);
  ipcMain.handle('activity-templates:duplicate', handleActivityTemplatesDuplicate);

  console.log('✓ All IPC handlers registered');
}
