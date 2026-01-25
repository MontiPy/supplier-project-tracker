// Scheduler Engine - Date Calculation Logic
// Computes planned dates for schedule items based on anchor rules

import type { ProjectScheduleItem, ScheduleItemWithDates } from '../shared/types.js';

/**
 * Calculate planned dates for all schedule items in an activity
 * Returns array with computed plannedDate for each item
 *
 * @param scheduleItems - Array of project schedule items
 * @param useBusinessDays - If true, offset days skip weekends (Sat/Sun)
 * @returns Array of schedule items with computed planned dates
 */
export function calculateScheduleDates(
  scheduleItems: ProjectScheduleItem[],
  useBusinessDays: boolean = false,
  actualDates?: Map<number, string | null>
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
        useBusinessDays,
        actualDates
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
 * @param useBusinessDays - If true, offset days skip weekends
 * @returns Computed date as YYYY-MM-DD string, or null if cannot compute
 */
function calculatePlannedDate(
  item: ProjectScheduleItem,
  resolvedDates: Map<number, string>,
  useBusinessDays: boolean = false,
  actualDates?: Map<number, string | null>
): string | null {
  if (item.overrideEnabled && item.overrideDate) {
    return item.overrideDate;
  }

  switch (item.anchorType) {
    case 'FIXED_DATE':
      return item.fixedDate;

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
      return addDays(refDate, item.offsetDays, useBusinessDays);

    case 'COMPLETION':
      if (item.anchorRefId === null) {
        return null;
      }
      if (!actualDates) {
        return null;
      }
      const completionDate = actualDates.get(item.anchorRefId) || null;
      if (!completionDate) {
        return null;
      }
      if (item.offsetDays === null) {
        return completionDate;
      }
      return addDays(completionDate, item.offsetDays, useBusinessDays);

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
 * @param useBusinessDays - If true, skip weekends (Sat=6, Sun=0)
 * @returns New date as YYYY-MM-DD string
 */
function addDays(dateString: string, offsetDays: number, useBusinessDays: boolean = false): string {
  const date = new Date(dateString + 'T00:00:00'); // Parse as local time

  if (!useBusinessDays) {
    // Simple calendar days
    date.setDate(date.getDate() + offsetDays);
  } else {
    // Business days - skip weekends
    const direction = offsetDays >= 0 ? 1 : -1;
    let remaining = Math.abs(offsetDays);

    while (remaining > 0) {
      date.setDate(date.getDate() + direction);
      const dayOfWeek = date.getDay();
      // Skip Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remaining--;
      }
    }
  }

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
