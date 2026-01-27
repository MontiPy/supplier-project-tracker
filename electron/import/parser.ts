/**
 * JSON parsing and validation for import functionality
 */

import type { ExportedData } from '@shared/types';

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParseResult {
  success: boolean;
  data?: ExportedData;
  errors: ValidationError[];
}

/**
 * Parse and validate imported JSON file
 */
export function parseImportFile(jsonString: string): ParseResult {
  const errors: ValidationError[] = [];

  try {
    const data = JSON.parse(jsonString) as ExportedData;

    // Validate metadata
    if (!data.exportMetadata) {
      errors.push({
        path: 'exportMetadata',
        message: 'Missing export metadata',
        severity: 'error',
      });
      return { success: false, errors };
    }

    if (!data.exportMetadata.version) {
      errors.push({
        path: 'exportMetadata.version',
        message: 'Missing version in metadata',
        severity: 'error',
      });
    }

    // Validate structure
    validateActivityTemplates(data.activityTemplates, errors);
    validateProjects(data.projects, errors);
    validateSuppliers(data.suppliers, errors);
    validateSettings(data.settings, errors);

    return {
      success: errors.filter((e) => e.severity === 'error').length === 0,
      data,
      errors,
    };
  } catch (error) {
    errors.push({
      path: 'root',
      message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'error',
    });
    return { success: false, errors };
  }
}

function validateActivityTemplates(
  templates: ExportedData['activityTemplates'],
  errors: ValidationError[]
): void {
  if (!templates || templates.length === 0) {
    return; // Optional section
  }

  templates.forEach((template, idx) => {
    const path = `activityTemplates[${idx}]`;

    if (!template.name) {
      errors.push({
        path: `${path}.name`,
        message: 'Activity template name is required',
        severity: 'error',
      });
    }

    if (!template.scheduleItems || template.scheduleItems.length === 0) {
      errors.push({
        path: `${path}.scheduleItems`,
        message: 'Activity template must have at least one schedule item',
        severity: 'warning',
      });
    }

    // Validate schedule items
    template.scheduleItems?.forEach((item, itemIdx) => {
      const itemPath = `${path}.scheduleItems[${itemIdx}]`;

      if (!item.name) {
        errors.push({
          path: `${itemPath}.name`,
          message: 'Schedule item name is required',
          severity: 'error',
        });
      }

      if (!item.kind || !['MILESTONE', 'TASK'].includes(item.kind)) {
        errors.push({
          path: `${itemPath}.kind`,
          message: 'Schedule item kind must be MILESTONE or TASK',
          severity: 'error',
        });
      }

      if (!item.anchorType || !['FIXED_DATE', 'SCHEDULE_ITEM', 'COMPLETION'].includes(item.anchorType)) {
        errors.push({
          path: `${itemPath}.anchorType`,
          message: 'Invalid anchor type',
          severity: 'error',
        });
      }

      // Validate anchor references
      if (item.anchorType === 'SCHEDULE_ITEM' || item.anchorType === 'COMPLETION') {
        if (!item.anchorRef) {
          errors.push({
            path: `${itemPath}.anchorRef`,
            message: `Anchor reference required for ${item.anchorType}`,
            severity: 'error',
          });
        }
        if (item.offsetDays === null || item.offsetDays === undefined) {
          errors.push({
            path: `${itemPath}.offsetDays`,
            message: 'Offset days required for relative anchors',
            severity: 'error',
          });
        }
      }

      if (item.anchorType === 'FIXED_DATE' && item.fixedDate) {
        if (!isValidDate(item.fixedDate)) {
          errors.push({
            path: `${itemPath}.fixedDate`,
            message: 'Invalid date format (expected YYYY-MM-DD)',
            severity: 'error',
          });
        }
      }
    });
  });
}

function validateProjects(projects: ExportedData['projects'], errors: ValidationError[]): void {
  if (!projects || projects.length === 0) {
    return; // Optional section
  }

  projects.forEach((project, idx) => {
    const path = `projects[${idx}]`;

    if (!project.name) {
      errors.push({
        path: `${path}.name`,
        message: 'Project name is required',
        severity: 'error',
      });
    }

    if (!project.version) {
      errors.push({
        path: `${path}.version`,
        message: 'Project version is required',
        severity: 'error',
      });
    }

    // Validate activities
    project.activities?.forEach((activity, actIdx) => {
      const actPath = `${path}.activities[${actIdx}]`;

      if (!activity.activityTemplateName) {
        errors.push({
          path: `${actPath}.activityTemplateName`,
          message: 'Activity template name is required',
          severity: 'error',
        });
      }
    });
  });
}

function validateSuppliers(suppliers: ExportedData['suppliers'], errors: ValidationError[]): void {
  if (!suppliers || suppliers.length === 0) {
    return; // Optional section
  }

  suppliers.forEach((supplier, idx) => {
    const path = `suppliers[${idx}]`;

    if (!supplier.name) {
      errors.push({
        path: `${path}.name`,
        message: 'Supplier name is required',
        severity: 'error',
      });
    }

    // Validate location codes
    supplier.locationCodes?.forEach((loc, locIdx) => {
      const locPath = `${path}.locationCodes[${locIdx}]`;

      if (!loc.supplierNumber) {
        errors.push({
          path: `${locPath}.supplierNumber`,
          message: 'Supplier number is required',
          severity: 'error',
        });
      }

      if (!loc.locationCode) {
        errors.push({
          path: `${locPath}.locationCode`,
          message: 'Location code is required',
          severity: 'error',
        });
      }
    });

    // Validate projects
    supplier.projects?.forEach((proj, projIdx) => {
      const projPath = `${path}.projects[${projIdx}]`;

      if (!proj.projectName) {
        errors.push({
          path: `${projPath}.projectName`,
          message: 'Project name is required',
          severity: 'error',
        });
      }

      if (!proj.projectVersion) {
        errors.push({
          path: `${projPath}.projectVersion`,
          message: 'Project version is required',
          severity: 'error',
        });
      }

      // Validate parts
      proj.parts?.forEach((part, partIdx) => {
        const partPath = `${projPath}.parts[${partIdx}]`;

        if (!part.partNumber) {
          errors.push({
            path: `${partPath}.partNumber`,
            message: 'Part number is required',
            severity: 'error',
          });
        }

        if (!part.supplierNumber) {
          errors.push({
            path: `${partPath}.supplierNumber`,
            message: 'Supplier number is required for part',
            severity: 'error',
          });
        }

        if (!part.locationCode) {
          errors.push({
            path: `${partPath}.locationCode`,
            message: 'Location code is required for part',
            severity: 'error',
          });
        }
      });
    });
  });
}

function validateSettings(settings: ExportedData['settings'], errors: ValidationError[]): void {
  if (!settings) {
    return; // Optional section
  }

  if (settings.nmrRanks && !Array.isArray(settings.nmrRanks)) {
    errors.push({
      path: 'settings.nmrRanks',
      message: 'NMR ranks must be an array',
      severity: 'error',
    });
  }

  if (settings.paRanks && !Array.isArray(settings.paRanks)) {
    errors.push({
      path: 'settings.paRanks',
      message: 'PA ranks must be an array',
      severity: 'error',
    });
  }
}

function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
