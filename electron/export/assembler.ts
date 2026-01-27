/**
 * Export data assembly - generates JSON from database
 */

import { query } from '../database';
import type {
  ExportedData,
  ExportOptions,
  ExportedSupplier,
  ExportedProject,
  ExportedActivityTemplate,
  ExportedSettings,
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

function exportActivityTemplates(_ids: number[]): ExportedActivityTemplate[] {
  // TODO: Implement activity template export
  // This will query activity_templates, schedule_items, and applicability rules
  return [];
}

function exportProjects(_ids: number[]): ExportedProject[] {
  // TODO: Implement project export
  // This will query projects, activities, schedule items, and dependencies
  return [];
}

function exportSuppliers(_ids: number[], _options: ExportOptions): ExportedSupplier[] {
  // TODO: Implement supplier export
  // This will query suppliers, location codes, supplier projects, activities, parts
  return [];
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
