/**
 * Export data assembly - generates JSON from database
 */

import { query, queryOne } from '../database';
import type {
  ExportedData,
  ExportOptions,
  ExportedSupplier,
  ExportedProject,
  ExportedActivityTemplate,
  ExportedSettings,
  ExportedScheduleItem,
  ExportedProjectActivity,
  ExportedSupplierLocationCode,
  ExportedSupplierProject,
  ExportedSupplierActivityInstance,
  ExportedSupplierScheduleItemInstance,
  ExportedPart,
  AnchorType,
  ScheduleItemKind,
} from '@shared/types';

/**
 * Assemble export data based on options
 */
export function assembleExport(options: ExportOptions): ExportedData {
  const exportData: ExportedData = {
    exportMetadata: {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      source: 'SQTS v1.0.0',
      scope: options.scope,
    },
  };

  // Export activity templates
  if (options.activityTemplateIds && options.activityTemplateIds.length > 0) {
    exportData.activityTemplates = exportActivityTemplates(options.activityTemplateIds);
  }

  // Export projects
  if (options.projectIds && options.projectIds.length > 0) {
    exportData.projects = exportProjects(options.projectIds);
  }

  // Export suppliers
  if (options.supplierIds && options.supplierIds.length > 0) {
    exportData.suppliers = exportSuppliers(options.supplierIds, options);
  }

  // Export settings
  if (options.includeSettings) {
    exportData.settings = exportSettings();
  }

  return exportData;
}

function exportActivityTemplates(ids: number[]): ExportedActivityTemplate[] {
  const templates: ExportedActivityTemplate[] = [];

  for (const id of ids) {
    const template = queryOne(
      'SELECT * FROM activity_templates WHERE id = ?',
      [id]
    );

    if (!template) continue;

    // Get schedule items
    const scheduleItemRows = query(
      `SELECT * FROM activity_template_schedule_items
       WHERE activity_template_id = ?
       ORDER BY id`,
      [id]
    );

    const scheduleItems: ExportedScheduleItem[] = scheduleItemRows.map((item: any) => {
      // Find anchor reference name if applicable
      let anchorRef: string | null = null;
      if (item.anchor_ref_id) {
        const anchorItem = queryOne(
          'SELECT name FROM activity_template_schedule_items WHERE id = ?',
          [item.anchor_ref_id]
        );
        anchorRef = anchorItem?.name || null;
      }

      // For relative anchors, ensure offsetDays is a number (default to 0 if null)
      const anchorType = item.anchor_type as AnchorType;
      const offsetDays = (anchorType === 'SCHEDULE_ITEM' || anchorType === 'COMPLETION')
        ? (item.offset_days ?? 0)
        : item.offset_days;

      return {
        name: item.name,
        kind: item.kind as ScheduleItemKind,
        anchorType,
        offsetDays,
        anchorRef,
      };
    });

    // Get applicability rules
    const rule = queryOne(
      'SELECT * FROM activity_template_applicability_rules WHERE activity_template_id = ?',
      [id]
    );

    let applicabilityRules = null;
    if (rule) {
      const clauses = query(
        'SELECT * FROM activity_template_applicability_clauses WHERE rule_id = ?',
        [rule.id]
      );

      applicabilityRules = {
        operator: rule.operator,
        enabled: Boolean(rule.enabled),
        clauses: clauses.map((c: any) => ({
          subjectType: c.subject_type,
          comparator: c.comparator,
          value: c.value,
        })),
      };
    }

    templates.push({
      name: template.name,
      description: template.description,
      category: template.category,
      scheduleItems,
      applicabilityRules,
    });
  }

  return templates;
}

function exportProjects(ids: number[]): ExportedProject[] {
  const projects: ExportedProject[] = [];

  for (const id of ids) {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) continue;

    // Get project activities
    const activityRows = query(
      `SELECT pa.*, at.name as activity_template_name
       FROM project_activities pa
       JOIN activity_templates at ON at.id = pa.activity_template_id
       WHERE pa.project_id = ?
       ORDER BY pa.sort_order`,
      [id]
    );

    const activities: ExportedProjectActivity[] = activityRows.map((activity: any) => {
      // Get schedule items for this activity
      const itemRows = query(
        `SELECT * FROM project_schedule_items
         WHERE project_activity_id = ?
         ORDER BY sort_order`,
        [activity.id]
      );

      const scheduleItems: ExportedScheduleItem[] = itemRows.map((item: any) => {
        // Find anchor reference name if applicable
        let anchorRef: string | null = null;
        if (item.anchor_ref_id) {
          const anchorItem = queryOne(
            'SELECT name FROM project_schedule_items WHERE id = ?',
            [item.anchor_ref_id]
          );
          anchorRef = anchorItem?.name || null;
        }

        // For relative anchors, ensure offsetDays is a number (default to 0 if null)
        const anchorType = item.anchor_type as AnchorType;
        const offsetDays = (anchorType === 'SCHEDULE_ITEM' || anchorType === 'COMPLETION')
          ? (item.offset_days ?? 0)
          : item.offset_days;

        return {
          name: item.name,
          kind: item.kind as ScheduleItemKind,
          anchorType,
          offsetDays,
          anchorRef,
          fixedDate: item.fixed_date,
          sortOrder: item.sort_order,
          overrideDate: item.override_date,
          overrideEnabled: Boolean(item.override_enabled),
        };
      });

      // Get dependencies for this activity
      const depRows = query(
        `SELECT at2.name as depends_on_name
         FROM project_activity_dependencies pad
         JOIN project_activities pa2 ON pa2.id = pad.depends_on_project_activity_id
         JOIN activity_templates at2 ON at2.id = pa2.activity_template_id
         WHERE pad.project_activity_id = ?`,
        [activity.id]
      );

      const dependencies = depRows.map((d: any) => d.depends_on_name);

      return {
        activityTemplateName: activity.activity_template_name,
        sortOrder: activity.sort_order,
        scheduleItems,
        dependencies,
      };
    });

    projects.push({
      name: project.name,
      version: project.version,
      activities,
    });
  }

  return projects;
}

function exportSuppliers(ids: number[], options: ExportOptions): ExportedSupplier[] {
  const suppliers: ExportedSupplier[] = [];

  for (const id of ids) {
    const supplier = queryOne('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) continue;

    // Get location codes
    const locationCodeRows = query(
      'SELECT * FROM supplier_location_codes WHERE supplier_id = ?',
      [id]
    );

    const locationCodes: ExportedSupplierLocationCode[] = locationCodeRows.map((loc: any) => ({
      supplierNumber: loc.supplier_number,
      locationCode: loc.location_code,
    }));

    // Get supplier projects
    const supplierProjectRows = query(
      `SELECT sp.*, p.name as project_name, p.version as project_version
       FROM supplier_projects sp
       JOIN projects p ON p.id = sp.project_id
       WHERE sp.supplier_id = ?`,
      [id]
    );

    const projects: ExportedSupplierProject[] = supplierProjectRows.map((sp: any) => {
      // Get supplier activities for this project
      const activityRows = query(
        `SELECT sai.*, at.name as activity_template_name
         FROM supplier_activity_instances sai
         JOIN project_activities pa ON pa.id = sai.project_activity_id
         JOIN activity_templates at ON at.id = pa.activity_template_id
         WHERE sai.supplier_project_id = ?
         ORDER BY pa.sort_order`,
        [sp.id]
      );

      const activities: ExportedSupplierActivityInstance[] = activityRows.map((activity: any) => {
        // Get schedule items for this activity (if includeScheduleInstances is true)
        let scheduleItems: ExportedSupplierScheduleItemInstance[] = [];
        if (options.includeScheduleInstances) {
          const itemRows = query(
            `SELECT ssii.*, psi.name
             FROM supplier_schedule_item_instances ssii
             JOIN project_schedule_items psi ON psi.id = ssii.project_schedule_item_id
             WHERE ssii.supplier_activity_instance_id = ?
             ORDER BY psi.sort_order`,
            [activity.id]
          );

          scheduleItems = itemRows.map((item: any) => ({
            name: item.name,
            plannedDate: item.planned_date,
            actualDate: item.actual_date,
            status: item.status,
            plannedDateOverride: Boolean(item.planned_date_override),
            scopeOverride: item.scope_override,
            locked: Boolean(item.locked),
          }));
        }

        // Get attachments (if includeAttachments is true)
        let attachments: Array<{ label: string | null; url: string }> = [];
        if (options.includeAttachments) {
          const attachmentRows = query(
            'SELECT * FROM supplier_activity_attachments WHERE supplier_activity_instance_id = ?',
            [activity.id]
          );

          attachments = attachmentRows.map((att: any) => ({
            label: att.label,
            url: att.url,
          }));
        }

        return {
          activityTemplateName: activity.activity_template_name,
          status: activity.status,
          scopeOverride: activity.scope_override,
          scheduleItems,
          attachments,
        };
      });

      // Get parts for this supplier project
      const partRows = query(
        `SELECT parts.*, slc.supplier_number, slc.location_code
         FROM parts
         JOIN supplier_location_codes slc ON slc.id = parts.supplier_location_code_id
         WHERE parts.supplier_project_id = ?
         ORDER BY parts.part_number`,
        [sp.id]
      );

      const parts: ExportedPart[] = partRows.map((part: any) => ({
        supplierNumber: part.supplier_number,
        locationCode: part.location_code,
        partNumber: part.part_number,
        description: part.description,
        paRank: part.pa_rank,
        notes: part.notes,
      }));

      return {
        projectName: sp.project_name,
        projectVersion: sp.project_version,
        nmrRank: sp.supplier_project_nmr_rank,
        activities,
        parts,
      };
    });

    suppliers.push({
      name: supplier.name,
      notes: supplier.notes,
      locationCodes,
      projects,
    });
  }

  return suppliers;
}

function exportSettings(): ExportedSettings {
  // TODO: Query settings from database
  // For now, return defaults
  return {
    nmrRanks: ['A1', 'A2', 'B1', 'B2', 'C1'],
    paRanks: ['Critical', 'High', 'Medium', 'Low'],
    propagationSkipComplete: true,
    propagationSkipLocked: true,
    propagationSkipOverridden: true,
    dateFormat: 'MM/DD/YYYY',
    useBusinessDays: false,
  };
}

/**
 * Full database export
 */
export function exportFullDatabase(): ExportedData {
  // Get all IDs
  const activityTemplates = query('SELECT id FROM activity_templates');
  const projects = query('SELECT id FROM projects');
  const suppliers = query('SELECT id FROM suppliers');

  return assembleExport({
    scope: 'full',
    activityTemplateIds: activityTemplates.map((row: any) => row.id),
    projectIds: projects.map((row: any) => row.id),
    supplierIds: suppliers.map((row: any) => row.id),
    includeScheduleInstances: true,
    includeAttachments: true,
    includeSettings: true,
  });
}
