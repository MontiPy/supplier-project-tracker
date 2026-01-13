// Scheduler Engine - Date Calculation Logic
// Computes planned dates for schedule items based on anchor rules

import type { ProjectScheduleItem, ScheduleItemWithDates } from '../shared/types.js';

/**
 * Calculate planned dates for all schedule items in an activity
 * Returns array with computed plannedDate for each item
 *
 * @param scheduleItems - Array of project schedule items
 * @param projectAnchorDate - Optional project-wide anchor date (YYYY-MM-DD)
 * @param supplierAnchorDate - Optional supplier-specific anchor date (YYYY-MM-DD)
 * @returns Array of schedule items with computed planned dates
 */
export function calculateScheduleDates(
  scheduleItems: ProjectScheduleItem[],
  projectAnchorDate?: string,
  supplierAnchorDate?: string
): ScheduleItemWithDates[] {
  const resolvedDates = new Map<number, string>(); // itemId -> computed date
  const results: ScheduleItemWithDates[] = [];
  const unprocessed = new Set(scheduleItems.map((item) => item.id));

  let previousUnprocessedCount = unprocessed.size;

  // Process items in waves until no more can be resolved
  while (unprocessed.size > 0) {
    let progress = false;

    for (const item of scheduleItems) {
      if (!unprocessed.has(item.id)) {
        continue; // Already processed
      }

      const plannedDate = calculatePlannedDate(
        item,
        resolvedDates,
        projectAnchorDate,
        supplierAnchorDate
      );

      if (plannedDate !== null) {
        // Successfully computed date
        resolvedDates.set(item.id, plannedDate);
        unprocessed.delete(item.id);
        progress = true;

        results.push({
          ...item,
          plannedDate,
          error: undefined
        });
      }
    }

    // Detect circular dependencies: no progress made
    if (!progress && unprocessed.size > 0) {
      // Add remaining items with error
      for (const item of scheduleItems) {
        if (unprocessed.has(item.id)) {
          results.push({
            ...item,
            plannedDate: null,
            error: 'Cannot compute date - circular dependency or missing anchor'
          });
        }
      }
      break;
    }

    // Safety check: infinite loop prevention
    if (unprocessed.size === previousUnprocessedCount) {
      break;
    }
    previousUnprocessedCount = unprocessed.size;
  }

  // Return results in same order as input
  return scheduleItems.map((item) => {
    const result = results.find((r) => r.id === item.id);
    return result || {
      ...item,
      plannedDate: null,
      error: 'Failed to compute date'
    };
  });
}

/**
 * Calculate planned date for a single schedule item
 * Returns YYYY-MM-DD string or null if cannot compute
 *
 * @param item - Schedule item to compute date for
 * @param resolvedDates - Map of already-computed dates for other items
 * @param projectAnchorDate - Optional project anchor date
 * @param supplierAnchorDate - Optional supplier anchor date
 * @returns Computed date as YYYY-MM-DD string, or null if cannot compute
 */
function calculatePlannedDate(
  item: ProjectScheduleItem,
  resolvedDates: Map<number, string>,
  projectAnchorDate?: string,
  supplierAnchorDate?: string
): string | null {
  switch (item.anchorType) {
    case 'FIXED_DATE':
      return item.fixedDate;

    case 'PROJECT_ANCHOR':
      if (!projectAnchorDate) {
        return null; // No project anchor configured
      }
      if (item.offsetDays === null) {
        return projectAnchorDate; // No offset, use anchor directly
      }
      return addDays(projectAnchorDate, item.offsetDays);

    case 'SUPPLIER_ANCHOR':
      if (!supplierAnchorDate) {
        return null; // No supplier anchor configured
      }
      if (item.offsetDays === null) {
        return supplierAnchorDate; // No offset, use anchor directly
      }
      return addDays(supplierAnchorDate, item.offsetDays);

    case 'SCHEDULE_ITEM':
      if (item.anchorRefId === null) {
        return null; // No reference item specified
      }
      const refDate = resolvedDates.get(item.anchorRefId);
      if (!refDate) {
        return null; // Reference item not yet resolved
      }
      if (item.offsetDays === null) {
        return refDate; // No offset, use reference date directly
      }
      return addDays(refDate, item.offsetDays);

    case 'COMPLETION':
      // Phase 3 - not implemented yet
      return null;

    default:
      return null;
  }
}

/**
 * Add or subtract days from a date string (YYYY-MM-DD)
 * Handles negative offsets correctly
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param offsetDays - Number of days to add (can be negative)
 * @returns New date as YYYY-MM-DD string
 */
function addDays(dateString: string, offsetDays: number): string {
  const date = new Date(dateString + 'T00:00:00'); // Parse as local time
  date.setDate(date.getDate() + offsetDays);

  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Validate schedule items for circular dependencies
 * Returns array of error messages (empty if valid)
 *
 * @param items - Schedule items to validate
 * @returns Array of error messages, empty if valid
 */
export function validateScheduleItems(items: ProjectScheduleItem[]): string[] {
  const errors: string[] = [];

  // Build dependency graph
  const graph = new Map<number, number | null>(); // itemId -> anchorRefId
  for (const item of items) {
    if (item.anchorType === 'SCHEDULE_ITEM') {
      graph.set(item.id, item.anchorRefId);
    } else {
      graph.set(item.id, null);
    }
  }

  // Check for self-references
  for (const item of items) {
    if (item.anchorType === 'SCHEDULE_ITEM' && item.anchorRefId === item.id) {
      errors.push(`Schedule item "${item.name}" (ID ${item.id}) references itself`);
    }
  }

  // Check for circular dependencies using cycle detection
  for (const startItem of items) {
    if (startItem.anchorType !== 'SCHEDULE_ITEM') {
      continue; // No dependency
    }

    const visited = new Set<number>();
    let current: number | null = startItem.id;

    while (current !== null) {
      if (visited.has(current)) {
        // Found a cycle
        errors.push(`Circular dependency detected involving schedule item ID ${startItem.id}`);
        break;
      }

      visited.add(current);
      current = graph.get(current) ?? null;
    }
  }

  return errors;
}
