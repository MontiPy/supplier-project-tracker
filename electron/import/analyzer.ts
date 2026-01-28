/**
 * Import analysis - generates comparison summary for user review
 */

import type { ExportedData, ImportAnalysis, MatchResult } from '@shared/types';
import { matchEntity } from './matcher';

/**
 * Analyze imported data and generate match results
 */
export function analyzeImport(data: ExportedData): ImportAnalysis {
  const matches: MatchResult[] = [];
  const summary: ImportAnalysis['summary'] = {};

  function addMatch(match: MatchResult) {
    matches.push(match);

    if (!summary[match.entityType]) {
      summary[match.entityType] = {
        new: 0,
        modified: 0,
        unchanged: 0,
        errors: 0,
      };
    }

    switch (match.status) {
      case 'NEW':
        summary[match.entityType].new++;
        break;
      case 'MODIFIED':
        summary[match.entityType].modified++;
        break;
      case 'UNCHANGED':
        summary[match.entityType].unchanged++;
        break;
      case 'CONFLICT':
        summary[match.entityType].errors++;
        break;
    }
  }

  // Analyze activity templates
  if (data.activityTemplates) {
    for (const template of data.activityTemplates) {
      const match = matchEntity('activity_template', {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
      });
      addMatch(match);

      // Note: Schedule items and applicability rules would be analyzed separately
      // For now, we're doing a simplified analysis
    }
  }

  // Analyze projects
  if (data.projects) {
    for (const project of data.projects) {
      const match = matchEntity('project', {
        id: project.id,
        name: project.name,
        version: project.version,
      });
      addMatch(match);

      // Analyze project activities
      for (const activity of project.activities || []) {
        const activityMatch = matchEntity('project_activity', {
          projectName: project.name,
          projectVersion: project.version,
          activityTemplateName: activity.activityTemplateName,
          sortOrder: activity.sortOrder,
        });
        addMatch(activityMatch);

        // Analyze project schedule items
        for (const item of activity.scheduleItems || []) {
          const itemMatch = matchEntity('project_schedule_item', {
            projectName: project.name,
            projectVersion: project.version,
            activityTemplateName: activity.activityTemplateName,
            name: item.name,
            kind: item.kind,
            anchorType: item.anchorType,
            offsetDays: item.offsetDays,
            fixedDate: item.fixedDate,
            overrideDate: item.overrideDate,
            overrideEnabled: item.overrideEnabled,
          });
          addMatch(itemMatch);
        }
      }
    }
  }

  // Analyze suppliers
  if (data.suppliers) {
    for (const supplier of data.suppliers) {
      const match = matchEntity('supplier', {
        id: supplier.id,
        name: supplier.name,
        notes: supplier.notes,
      });
      addMatch(match);

      // Analyze location codes
      for (const locationCode of supplier.locationCodes || []) {
        const locationMatch = matchEntity('supplier_location_code', {
          supplierName: supplier.name,
          supplierNumber: locationCode.supplierNumber,
          locationCode: locationCode.locationCode,
        });
        addMatch(locationMatch);
      }

      // Analyze supplier projects
      for (const supplierProject of supplier.projects || []) {
        const supplierProjectMatch = matchEntity('supplier_project', {
          supplierName: supplier.name,
          projectName: supplierProject.projectName,
          projectVersion: supplierProject.projectVersion,
          nmrRank: supplierProject.nmrRank,
        });
        addMatch(supplierProjectMatch);

        // Analyze supplier activities
        for (const activity of supplierProject.activities || []) {
          const activityMatch = matchEntity('supplier_activity_instance', {
            supplierName: supplier.name,
            projectName: supplierProject.projectName,
            projectVersion: supplierProject.projectVersion,
            activityTemplateName: activity.activityTemplateName,
            status: activity.status,
            scopeOverride: activity.scopeOverride,
          });
          addMatch(activityMatch);

          // Analyze supplier schedule items
          for (const item of activity.scheduleItems || []) {
            const itemMatch = matchEntity('supplier_schedule_item_instance', {
              supplierName: supplier.name,
              projectName: supplierProject.projectName,
              projectVersion: supplierProject.projectVersion,
              activityTemplateName: activity.activityTemplateName,
              name: item.name,
              plannedDate: item.plannedDate,
              actualDate: item.actualDate,
              status: item.status,
              plannedDateOverride: item.plannedDateOverride,
              scopeOverride: item.scopeOverride,
              locked: item.locked,
            });
            addMatch(itemMatch);
          }
        }

        // Analyze parts
        for (const part of supplierProject.parts || []) {
          const partMatch = matchEntity('part', {
            supplierName: supplier.name,
            projectName: supplierProject.projectName,
            projectVersion: supplierProject.projectVersion,
            supplierNumber: part.supplierNumber,
            locationCode: part.locationCode,
            partNumber: part.partNumber,
            description: part.description,
            paRank: part.paRank,
            notes: part.notes,
          });
          addMatch(partMatch);
        }
      }
    }
  }

  return { summary, matches };
}

/**
 * Get a human-readable label for a match result
 */
export function getMatchLabel(match: MatchResult): string {
  const key = match.matchKey.split(':')[1]; // Remove entity type prefix
  return key.replace(/\//g, ' / ');
}

/**
 * Filter matches by status
 */
export function filterMatches(matches: MatchResult[], status: MatchResult['status']): MatchResult[] {
  return matches.filter((m) => m.status === status);
}

/**
 * Filter matches by entity type
 */
export function filterMatchesByType(matches: MatchResult[], entityType: string): MatchResult[] {
  return matches.filter((m) => m.entityType === entityType);
}
