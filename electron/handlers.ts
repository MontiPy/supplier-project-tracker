import { ipcMain } from 'electron';
import { query, queryOne, run, toCamelCase } from './database.js';
import { calculateScheduleDates, validateScheduleItems } from './scheduler.js';
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
  CreateProjectActivityParams,
  UpdateProjectActivityParams,
  CreateScheduleItemParams,
  UpdateScheduleItemParams,
  ProjectActivityDetail,
  ProjectDetail,
  ScheduleItemWithDates,
  APIResponse,
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
    const { name, version, defaultAnchorRule } = params;

    const result = run(
      `INSERT INTO projects (name, version, default_anchor_rule)
       VALUES (?, ?, ?)`,
      [name, version, defaultAnchorRule || null]
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
    const { id, name, version, defaultAnchorRule } = params;

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
      `SELECT pa.*, at.name as activity_template_name
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
    const itemsWithDates = calculateScheduleDates(toCamelCase<ProjectScheduleItem[]>(scheduleItems));

    const result: ProjectActivityDetail = {
      ...toCamelCase<ProjectActivity>(activity),
      activityTemplateName: activity.activity_template_name,
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

    const itemsWithDates = calculateScheduleDates(toCamelCase<ProjectScheduleItem[]>(items));

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
    const { projectActivityId, kind, name, anchorType, anchorRefId, offsetDays, fixedDate, sortOrder } =
      params;

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
       (project_activity_id, kind, name, anchor_type, anchor_ref_id, offset_days, fixed_date, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectActivityId,
        kind,
        name,
        anchorType,
        anchorRefId || null,
        offsetDays || null,
        fixedDate || null,
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
    const { id, name, anchorType, anchorRefId, offsetDays, fixedDate, sortOrder } = params;

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
      `SELECT pa.*, at.name as activity_template_name
       FROM project_activities pa
       JOIN activity_templates at ON pa.activity_template_id = at.id
       WHERE pa.project_id = ?
       ORDER BY pa.sort_order`,
      [id]
    );

    // For each activity, get schedule items with computed dates
    const activitiesWithDetails: ProjectActivityDetail[] = activities.map((activity: any) => {
      const scheduleItems = query<ProjectScheduleItem>(
        'SELECT * FROM project_schedule_items WHERE project_activity_id = ? ORDER BY sort_order',
        [activity.id]
      );

      const itemsWithDates = calculateScheduleDates(toCamelCase<ProjectScheduleItem[]>(scheduleItems));

      return {
        ...toCamelCase<ProjectActivity>(activity),
        activityTemplateName: activity.activity_template_name,
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

  // Schedule Items
  ipcMain.handle('schedule-items:list', handleScheduleItemsList);
  ipcMain.handle('schedule-items:get', handleScheduleItemsGet);
  ipcMain.handle('schedule-items:create', handleScheduleItemsCreate);
  ipcMain.handle('schedule-items:update', handleScheduleItemsUpdate);
  ipcMain.handle('schedule-items:delete', handleScheduleItemsDelete);

  console.log('✓ All IPC handlers registered');
}
