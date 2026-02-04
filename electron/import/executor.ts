/**
 * Import execution - applies analyzed changes to the database
 */

import type {
  ExportedData,
  ImportAnalysis,
  MatchResult,
  ExportedActivityTemplate,
  ExportedProject,
  ExportedSupplier,
} from '@shared/types';
import { run, queryOne, saveDatabase } from '../database';

/**
 * Map to track created entities and their database IDs
 * Key format: "entityType:naturalKey"
 */
const entityIdMap = new Map<string, number>();

/**
 * Apply import changes to the database
 */
export function executeImport(data: ExportedData, analysis: ImportAnalysis): { success: boolean; error?: string } {
  try {
    // Clear the ID map for this import
    entityIdMap.clear();

    // Process entities in dependency order
    // 1. Activity Templates (standalone)
    if (data.activityTemplates) {
      for (const template of data.activityTemplates) {
        const match = findMatch(analysis, 'activity_template', `template:${template.name}`);
        if (match && (match.status === 'NEW' || match.status === 'MODIFIED')) {
          processActivityTemplate(template, match);
        }
      }
    }

    // 2. Projects (standalone)
    if (data.projects) {
      for (const project of data.projects) {
        const match = findMatch(analysis, 'project', `project:${project.name}/${project.version}`);
        if (match && (match.status === 'NEW' || match.status === 'MODIFIED')) {
          processProject(project, match);
        }
      }
    }

    // 3. Suppliers and their hierarchy
    if (data.suppliers) {
      for (const supplier of data.suppliers) {
        const match = findMatch(analysis, 'supplier', `supplier:${supplier.name}`);
        if (match && (match.status === 'NEW' || match.status === 'MODIFIED')) {
          processSupplier(supplier, match, analysis);
        }
      }
    }

    // Save database after all changes
    saveDatabase();

    return { success: true };
  } catch (error) {
    console.error('Import execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during import',
    };
  }
}

/**
 * Find a match result by entity type and match key
 */
function findMatch(analysis: ImportAnalysis, entityType: string, matchKey: string): MatchResult | undefined {
  return analysis.matches.find((m) => m.entityType === entityType && m.matchKey === matchKey);
}

/**
 * Process an activity template
 */
function processActivityTemplate(template: ExportedActivityTemplate, match: MatchResult): void {
  let templateId: number;

  if (match.status === 'NEW') {
    // Create new activity template
    const result = run(
      'INSERT INTO activity_templates (name, description, category) VALUES (?, ?, ?)',
      [template.name, template.description, template.category]
    );
    templateId = result.lastInsertRowid as number;
  } else {
    // Update existing activity template
    templateId = match.existingId!;
    run('UPDATE activity_templates SET description = ?, category = ? WHERE id = ?', [
      template.description,
      template.category,
      templateId,
    ]);
  }

  // Store the ID mapping
  entityIdMap.set(`activity_template:${template.name}`, templateId);

  // Process schedule items (delete and recreate for simplicity)
  run('DELETE FROM activity_template_schedule_items WHERE activity_template_id = ?', [templateId]);

  if (template.scheduleItems && template.scheduleItems.length > 0) {
    for (let i = 0; i < template.scheduleItems.length; i++) {
      const item = template.scheduleItems[i];

      // Find anchor reference ID if applicable
      let anchorRefId: number | null = null;
      if (item.anchorRef && (item.anchorType === 'SCHEDULE_ITEM' || item.anchorType === 'COMPLETION')) {
        const anchorItem = queryOne(
          'SELECT id FROM activity_template_schedule_items WHERE activity_template_id = ? AND name = ?',
          [templateId, item.anchorRef]
        );
        anchorRefId = anchorItem?.id || null;
      }

      run(
        `INSERT INTO activity_template_schedule_items
         (activity_template_id, kind, name, anchor_type, anchor_ref_id, offset_days, sort_order, project_milestone_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [templateId, item.kind, item.name, item.anchorType, anchorRefId, item.offsetDays, i, item.projectMilestoneName || null]
      );
    }
  }

  // Process applicability rules
  run('DELETE FROM activity_template_applicability_clauses WHERE activity_template_id = ?', [templateId]);
  run('DELETE FROM activity_template_applicability_rules WHERE activity_template_id = ?', [templateId]);

  if (template.applicabilityRules && template.applicabilityRules.enabled) {
    const ruleResult = run(
      'INSERT INTO activity_template_applicability_rules (activity_template_id, operator, enabled) VALUES (?, ?, ?)',
      [templateId, template.applicabilityRules.operator, 1]
    );
    const ruleId = ruleResult.lastInsertRowid as number;

    for (const clause of template.applicabilityRules.clauses || []) {
      run(
        `INSERT INTO activity_template_applicability_clauses
         (activity_template_applicability_rule_id, activity_template_id, subject_type, comparator, value)
         VALUES (?, ?, ?, ?, ?)`,
        [ruleId, templateId, clause.subjectType, clause.comparator, clause.value]
      );
    }
  }
}

/**
 * Process a project
 */
function processProject(project: ExportedProject, match: MatchResult): void {
  let projectId: number;

  if (match.status === 'NEW') {
    // Create new project
    const result = run('INSERT INTO projects (name, version) VALUES (?, ?)', [project.name, project.version]);
    projectId = result.lastInsertRowid as number;
  } else {
    // Update existing project (name and version are natural keys, so nothing to update)
    projectId = match.existingId!;
  }

  // Store the ID mapping
  entityIdMap.set(`project:${project.name}/${project.version}`, projectId);

  // Process project milestones (delete and recreate for simplicity)
  run('DELETE FROM project_milestones WHERE project_id = ?', [projectId]);

  if (project.milestones && project.milestones.length > 0) {
    for (const ms of project.milestones) {
      run(
        'INSERT INTO project_milestones (project_id, name, date, sort_order) VALUES (?, ?, ?, ?)',
        [projectId, ms.name, ms.date, ms.sortOrder]
      );
    }
  }

  // Process project activities (delete and recreate for simplicity)
  run('DELETE FROM project_schedule_items WHERE project_activity_id IN (SELECT id FROM project_activities WHERE project_id = ?)', [projectId]);
  run('DELETE FROM project_activity_dependencies WHERE project_activity_id IN (SELECT id FROM project_activities WHERE project_id = ?)', [projectId]);
  run('DELETE FROM project_activities WHERE project_id = ?', [projectId]);

  if (project.activities && project.activities.length > 0) {
    for (const activity of project.activities) {
      // Find activity template ID
      const activityTemplate = queryOne('SELECT id FROM activity_templates WHERE name = ?', [
        activity.activityTemplateName,
      ]);
      if (!activityTemplate) {
        console.warn(`Activity template not found: ${activity.activityTemplateName}`);
        continue;
      }

      // Create project activity
      const activityResult = run(
        'INSERT INTO project_activities (project_id, activity_template_id, sort_order) VALUES (?, ?, ?)',
        [projectId, activityTemplate.id, activity.sortOrder]
      );
      const activityId = activityResult.lastInsertRowid as number;

      // Process schedule items
      if (activity.scheduleItems && activity.scheduleItems.length > 0) {
        for (let i = 0; i < activity.scheduleItems.length; i++) {
          const item = activity.scheduleItems[i];

          // Find anchor reference ID if applicable
          let anchorRefId: number | null = null;
          if (item.anchorRef && (item.anchorType === 'SCHEDULE_ITEM' || item.anchorType === 'COMPLETION')) {
            const anchorItem = queryOne(
              'SELECT id FROM project_schedule_items WHERE project_activity_id = ? AND name = ?',
              [activityId, item.anchorRef]
            );
            anchorRefId = anchorItem?.id || null;
          }

          // Resolve project milestone name to ID if applicable
          let projectMilestoneId: number | null = null;
          if (item.anchorType === 'PROJECT_MILESTONE' && item.projectMilestoneName) {
            const milestone = queryOne(
              'SELECT id FROM project_milestones WHERE project_id = ? AND name = ?',
              [projectId, item.projectMilestoneName]
            );
            projectMilestoneId = milestone?.id || null;
          }

          run(
            `INSERT INTO project_schedule_items
             (project_activity_id, kind, name, anchor_type, anchor_ref_id, offset_days, fixed_date, sort_order, override_date, override_enabled, project_milestone_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              activityId,
              item.kind,
              item.name,
              item.anchorType,
              anchorRefId,
              item.offsetDays,
              item.fixedDate,
              i,
              item.overrideDate,
              item.overrideEnabled ? 1 : 0,
              projectMilestoneId,
            ]
          );
        }
      }
    }

    // Process dependencies (second pass after all activities are created)
    for (const activity of project.activities) {
      if (activity.dependencies && activity.dependencies.length > 0) {
        // Find this activity's ID
        const activityTemplate = queryOne('SELECT id FROM activity_templates WHERE name = ?', [
          activity.activityTemplateName,
        ]);
        const projectActivity = queryOne(
          'SELECT id FROM project_activities WHERE project_id = ? AND activity_template_id = ?',
          [projectId, activityTemplate?.id]
        );

        if (projectActivity) {
          for (const depName of activity.dependencies) {
            // Find dependency activity ID
            const depTemplate = queryOne('SELECT id FROM activity_templates WHERE name = ?', [depName]);
            const depActivity = queryOne(
              'SELECT id FROM project_activities WHERE project_id = ? AND activity_template_id = ?',
              [projectId, depTemplate?.id]
            );

            if (depActivity) {
              run(
                'INSERT INTO project_activity_dependencies (project_activity_id, depends_on_project_activity_id) VALUES (?, ?)',
                [projectActivity.id, depActivity.id]
              );
            }
          }
        }
      }
    }
  }
}

/**
 * Process a supplier and its hierarchy
 */
function processSupplier(supplier: ExportedSupplier, match: MatchResult, analysis: ImportAnalysis): void {
  let supplierId: number;

  if (match.status === 'NEW') {
    // Create new supplier
    const result = run('INSERT INTO suppliers (name, notes) VALUES (?, ?)', [supplier.name, supplier.notes]);
    supplierId = result.lastInsertRowid as number;
  } else {
    // Update existing supplier
    supplierId = match.existingId!;
    run('UPDATE suppliers SET name = ?, notes = ? WHERE id = ?', [supplier.name, supplier.notes, supplierId]);
  }

  // Store the ID mapping
  entityIdMap.set(`supplier:${supplier.name}`, supplierId);

  // Process location codes
  if (supplier.locationCodes) {
    for (const locationCode of supplier.locationCodes) {
      const lcMatch = findMatch(
        analysis,
        'supplier_location_code',
        `location:${supplier.name}/${locationCode.supplierNumber}/${locationCode.locationCode}`
      );

      if (lcMatch && lcMatch.status === 'NEW') {
        run(
          'INSERT INTO supplier_location_codes (supplier_id, supplier_number, location_code) VALUES (?, ?, ?)',
          [supplierId, locationCode.supplierNumber, locationCode.locationCode]
        );
      }
      // Note: Location codes are rarely updated, so we skip MODIFIED case
    }
  }

  // Process supplier projects
  if (supplier.projects) {
    for (const supplierProject of supplier.projects) {
      const spMatch = findMatch(
        analysis,
        'supplier_project',
        `supplier_project:${supplier.name}/${supplierProject.projectName}/${supplierProject.projectVersion}`
      );

      if (spMatch && (spMatch.status === 'NEW' || spMatch.status === 'MODIFIED')) {
        processSupplierProject(supplierId, supplier.name, supplierProject, spMatch, analysis);
      }
    }
  }
}

/**
 * Process a supplier project and its hierarchy
 */
function processSupplierProject(
  supplierId: number,
  supplierName: string,
  supplierProject: any,
  match: MatchResult,
  analysis: ImportAnalysis
): void {
  // Find project ID
  const project = queryOne('SELECT id FROM projects WHERE name = ? AND version = ?', [
    supplierProject.projectName,
    supplierProject.projectVersion,
  ]);
  if (!project) {
    console.warn(`Project not found: ${supplierProject.projectName}/${supplierProject.projectVersion}`);
    return;
  }

  let supplierProjectId: number;

  if (match.status === 'NEW') {
    // Create new supplier project
    const result = run(
      'INSERT INTO supplier_projects (supplier_id, project_id, supplier_project_nmr_rank) VALUES (?, ?, ?)',
      [supplierId, project.id, supplierProject.nmrRank]
    );
    supplierProjectId = result.lastInsertRowid as number;
  } else {
    // Update existing supplier project
    supplierProjectId = match.existingId!;
    run('UPDATE supplier_projects SET supplier_project_nmr_rank = ? WHERE id = ?', [
      supplierProject.nmrRank,
      supplierProjectId,
    ]);
  }

  // Process supplier activities
  if (supplierProject.activities) {
    for (const activity of supplierProject.activities) {
      const actMatch = findMatch(
        analysis,
        'supplier_activity_instance',
        `supplier_activity:${supplierName}/${supplierProject.projectName}/${supplierProject.projectVersion}/${activity.activityTemplateName}`
      );

      if (actMatch && (actMatch.status === 'NEW' || actMatch.status === 'MODIFIED')) {
        processSupplierActivity(supplierProjectId, supplierName, supplierProject, activity, actMatch, analysis);
      }
    }
  }

  // Process parts
  if (supplierProject.parts) {
    for (const part of supplierProject.parts) {
      const partMatch = findMatch(
        analysis,
        'part',
        `part:${supplierName}/${supplierProject.projectName}/${supplierProject.projectVersion}/${part.supplierNumber}/${part.locationCode}/${part.partNumber}`
      );

      if (partMatch && (partMatch.status === 'NEW' || partMatch.status === 'MODIFIED')) {
        // Find supplier location code ID
        const locationCode = queryOne(
          'SELECT id FROM supplier_location_codes WHERE supplier_id = ? AND supplier_number = ? AND location_code = ?',
          [supplierId, part.supplierNumber, part.locationCode]
        );

        if (locationCode) {
          if (partMatch.status === 'NEW') {
            run(
              `INSERT INTO parts (supplier_project_id, supplier_location_code_id, part_number, description, pa_rank, notes)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [supplierProjectId, locationCode.id, part.partNumber, part.description, part.paRank, part.notes]
            );
          } else {
            run('UPDATE parts SET description = ?, pa_rank = ?, notes = ? WHERE id = ?', [
              part.description,
              part.paRank,
              part.notes,
              partMatch.existingId!,
            ]);
          }
        }
      }
    }
  }
}

/**
 * Process a supplier activity instance
 */
function processSupplierActivity(
  supplierProjectId: number,
  supplierName: string,
  supplierProject: any,
  activity: any,
  match: MatchResult,
  analysis: ImportAnalysis
): void {
  // Find project activity ID
  const activityTemplate = queryOne('SELECT id FROM activity_templates WHERE name = ?', [
    activity.activityTemplateName,
  ]);
  const project = queryOne('SELECT id FROM projects WHERE name = ? AND version = ?', [
    supplierProject.projectName,
    supplierProject.projectVersion,
  ]);
  const projectActivity = queryOne(
    'SELECT id FROM project_activities WHERE project_id = ? AND activity_template_id = ?',
    [project?.id, activityTemplate?.id]
  );

  if (!projectActivity) {
    console.warn(`Project activity not found for: ${activity.activityTemplateName}`);
    return;
  }

  let activityInstanceId: number;

  if (match.status === 'NEW') {
    // Create new supplier activity instance
    const result = run(
      'INSERT INTO supplier_activity_instances (supplier_project_id, project_activity_id, status, scope_override) VALUES (?, ?, ?, ?)',
      [supplierProjectId, projectActivity.id, activity.status, activity.scopeOverride]
    );
    activityInstanceId = result.lastInsertRowid as number;
  } else {
    // Update existing supplier activity instance
    activityInstanceId = match.existingId!;
    run('UPDATE supplier_activity_instances SET status = ?, scope_override = ? WHERE id = ?', [
      activity.status,
      activity.scopeOverride,
      activityInstanceId,
    ]);
  }

  // Process schedule item instances
  if (activity.scheduleItems) {
    for (const item of activity.scheduleItems) {
      const itemMatch = findMatch(
        analysis,
        'supplier_schedule_item_instance',
        `supplier_item:${supplierName}/${supplierProject.projectName}/${supplierProject.projectVersion}/${activity.activityTemplateName}/${item.name}`
      );

      if (itemMatch && (itemMatch.status === 'NEW' || itemMatch.status === 'MODIFIED')) {
        // Find project schedule item ID
        const projectScheduleItem = queryOne(
          'SELECT id FROM project_schedule_items WHERE project_activity_id = ? AND name = ?',
          [projectActivity.id, item.name]
        );

        if (projectScheduleItem) {
          if (itemMatch.status === 'NEW') {
            run(
              `INSERT INTO supplier_schedule_item_instances
               (supplier_activity_instance_id, project_schedule_item_id, planned_date, actual_date, status, planned_date_override, scope_override, locked)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                activityInstanceId,
                projectScheduleItem.id,
                item.plannedDate,
                item.actualDate,
                item.status,
                item.plannedDateOverride ? 1 : 0,
                item.scopeOverride,
                item.locked ? 1 : 0,
              ]
            );
          } else {
            run(
              `UPDATE supplier_schedule_item_instances
               SET planned_date = ?, actual_date = ?, status = ?, planned_date_override = ?, scope_override = ?, locked = ?
               WHERE id = ?`,
              [
                item.plannedDate,
                item.actualDate,
                item.status,
                item.plannedDateOverride ? 1 : 0,
                item.scopeOverride,
                item.locked ? 1 : 0,
                itemMatch.existingId!,
              ]
            );
          }
        }
      }
    }
  }

  // Process attachments (delete and recreate for simplicity)
  run('DELETE FROM supplier_activity_attachments WHERE supplier_activity_instance_id = ?', [activityInstanceId]);

  if (activity.attachments && activity.attachments.length > 0) {
    for (const attachment of activity.attachments) {
      run(
        'INSERT INTO supplier_activity_attachments (supplier_activity_instance_id, label, url) VALUES (?, ?, ?)',
        [activityInstanceId, attachment.label, attachment.url]
      );
    }
  }
}
