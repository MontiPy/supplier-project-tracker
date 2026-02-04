import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TemplateSyncStatus } from '@shared/types';

interface SyncStatusBadgeProps {
  activityTemplateId: number;
  onRefresh?: () => void;
}

export function SyncStatusBadge({ activityTemplateId, onRefresh }: SyncStatusBadgeProps) {
  const [status, setStatus] = useState<TemplateSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, [activityTemplateId, onRefresh]);

  async function loadStatus() {
    setLoading(true);
    const result = await window.sqts.activityTemplates.getSyncStatus(activityTemplateId);
    if (result.success && result.data) {
      setStatus(result.data);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border',
        'bg-gray-100 text-gray-700 border-gray-200'
      )}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking sync...
      </span>
    );
  }

  if (!status || status.projects.length === 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border',
        'bg-gray-100 text-gray-700 border-gray-200'
      )}>
        <CheckCircle2 className="h-3 w-3" />
        Not used in any projects
      </span>
    );
  }

  const outOfSyncCount = status.projects.filter((p) => p.isOutOfSync).length;
  const totalCount = status.projects.length;

  if (outOfSyncCount === 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border',
        'bg-green-100 text-green-700 border-green-200'
      )}>
        <CheckCircle2 className="h-3 w-3" />
        All {totalCount} project{totalCount !== 1 ? 's' : ''} in sync
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border',
      'bg-amber-100 text-amber-700 border-amber-200'
    )}>
      <AlertTriangle className="h-3 w-3" />
      {outOfSyncCount} of {totalCount} project{totalCount !== 1 ? 's' : ''} out of sync
    </span>
  );
}
