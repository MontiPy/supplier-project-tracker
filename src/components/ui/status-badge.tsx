import { cn } from '@/lib/utils';

type StatusType =
  | 'Complete'
  | 'In Progress'
  | 'Not Started'
  | 'Blocked'
  | 'Not Required'
  | 'On Track'
  | 'At Risk'
  | 'Behind'
  | 'Late';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md';
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Item status colors
  'Complete': 'bg-green-100 text-green-800 border-green-200',
  'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
  'Not Started': 'bg-gray-100 text-gray-800 border-gray-200',
  'Blocked': 'bg-red-100 text-red-800 border-red-200',
  'Not Required': 'bg-gray-100 text-gray-500 border-gray-200',

  // Overall status colors
  'On Track': 'bg-green-50 text-green-700 border-green-300',
  'At Risk': 'bg-orange-50 text-orange-700 border-orange-300',
  'Behind': 'bg-red-50 text-red-700 border-red-300',

  // Flag colors
  'Late': 'bg-red-100 text-red-800 border-red-300',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-sm',
};

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-md border',
        style,
        sizeStyles[size],
        className
      )}
    >
      {status}
    </span>
  );
}

// Type badge for schedule items (M = Milestone, T = Task)
interface TypeBadgeProps {
  kind: 'MILESTONE' | 'TASK';
  size?: 'sm' | 'md';
  className?: string;
}

export function TypeBadge({ kind, size = 'sm', className }: TypeBadgeProps) {
  const isMilestone = kind === 'MILESTONE';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded',
        isMilestone
          ? 'bg-blue-100 text-blue-700'
          : 'bg-purple-100 text-purple-700',
        size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm',
        className
      )}
    >
      {isMilestone ? 'M' : 'T'}
    </span>
  );
}

// NMR Rank badge
interface RankBadgeProps {
  rank: string | null;
  className?: string;
}

export function RankBadge({ rank, className }: RankBadgeProps) {
  if (!rank) return null;

  // Color based on rank tier
  let style = 'bg-gray-100 text-gray-800 border-gray-200';
  if (rank.startsWith('A')) {
    style = 'bg-green-100 text-green-800 border-green-200';
  } else if (rank.startsWith('B')) {
    style = 'bg-amber-100 text-amber-800 border-amber-200';
  } else if (rank.startsWith('C')) {
    style = 'bg-red-100 text-red-800 border-red-200';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border',
        style,
        className
      )}
    >
      {rank}
    </span>
  );
}

// Category badge for activity templates
interface CategoryBadgeProps {
  category: string | null;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  if (!category) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 border border-blue-200',
        className
      )}
    >
      {category}
    </span>
  );
}

// Version badge
interface VersionBadgeProps {
  version: string;
  className?: string;
}

export function VersionBadge({ version, className }: VersionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 border border-gray-200',
        className
      )}
    >
      {version}
    </span>
  );
}
