import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { VersionBadge, RankBadge, StatusBadge, TypeBadge } from '@/components/ui/status-badge';
import type {
  SupplierProjectDetail,
  SupplierProjectActivityDetail,
  SupplierScheduleItemDetail,
  SupplierProject,
  ScopeOverride,
  ActivityStatus,
} from '@shared/types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SupplierProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [detail, setDetail] = useState<SupplierProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [allSupplierProjects, setAllSupplierProjects] = useState<SupplierProject[]>([]);
  const [nmrRanks, setNmrRanks] = useState<string[]>([]);
  const [updatingRank, setUpdatingRank] = useState(false);

  useEffect(() => {
    if (id) {
      loadDetail();
      loadAllSupplierProjects();
      loadSettings();
    }
  }, [id]);

  async function loadDetail() {
    setLoading(true);
    const response = await window.sqts.supplierProjects.getDetail(Number(id));
    if (response.success && response.data) {
      setDetail(response.data);
      setExpandedActivities(new Set());
    }
    setLoading(false);
  }

  async function loadAllSupplierProjects() {
    const response = await window.sqts.supplierProjects.list();
    if (response.success && response.data) {
      setAllSupplierProjects(response.data);
    }
  }

  async function loadSettings() {
    const response = await window.sqts.settings.getAll();
    if (response.success && response.data) {
      setNmrRanks(response.data.nmrRanks);
    }
  }

  function toggleActivity(activityId: number) {
    const next = new Set(expandedActivities);
    if (next.has(activityId)) {
      next.delete(activityId);
    } else {
      next.add(activityId);
    }
    setExpandedActivities(next);
  }

  const sameProjectSuppliers = useMemo(() => {
    if (!detail) {
      return [];
    }
    return allSupplierProjects.filter((sp) => sp.projectId === detail.projectId);
  }, [allSupplierProjects, detail]);

  const switcherOptions = useMemo(() => {
    if (!detail) {
      return [];
    }
    return sameProjectSuppliers.length > 0 ? sameProjectSuppliers : [detail as SupplierProject];
  }, [detail, sameProjectSuppliers]);

  const selectedSupplierLabel = useMemo(() => {
    if (!detail) {
      return '';
    }
    const current = switcherOptions.find((sp) => sp.id === detail.id);
    return current?.supplierName || detail.supplierName || `Supplier ${detail.supplierId}`;
  }, [detail, switcherOptions]);

  const summary = useMemo(() => {
    if (!detail) {
      return {
        total: 0,
        complete: 0,
        overdue: 0,
        nextDue: null,
        progressPercent: 0,
        statusLabel: 'On Track',
      };
    }
    const items = detail.activities
      .filter((activity) => activity.status !== 'Not Required')
      .flatMap((activity) => activity.scheduleItems);
    const total = items.length;
    const complete = items.filter((item) => item.status === 'Complete').length;
    const today = new Date();
    const overdue = items.filter((item) => {
      if (!item.plannedDate || item.status === 'Complete') {
        return false;
      }
      const planned = new Date(`${item.plannedDate}T00:00:00`);
      return planned < today;
    }).length;
    const nextDueItem = items
      .filter((item) => item.plannedDate && item.status !== 'Complete')
      .sort((a, b) => (a.plannedDate || '').localeCompare(b.plannedDate || ''))[0];
    const progressPercent = total === 0 ? 0 : Math.round((complete / total) * 100);
    return {
      total,
      complete,
      overdue,
      nextDue: nextDueItem?.plannedDate || null,
      progressPercent,
      statusLabel: overdue > 0 ? 'At Risk' : progressPercent === 100 ? 'Complete' : 'On Track',
    };
  }, [detail]);

  const visibleActivities = useMemo(() => {
    if (!detail) {
      return [];
    }
    return detail.activities.filter((activity) => activity.status !== 'Not Required');
  }, [detail]);

  const projectRank = detail?.supplierProjectNmrRank || null;
  const defaultRankValue = '__default__';

  async function handleProjectRankChange(value: string) {
    if (!detail) {
      return;
    }
    setUpdatingRank(true);
    const nextRank = value === defaultRankValue ? null : value;
    const response = await window.sqts.supplierProjects.update({
      id: detail.id,
      supplierProjectNmrRank: nextRank,
    });
    setUpdatingRank(false);
    if (response.success) {
      setDetail({ ...detail, supplierProjectNmrRank: nextRank });
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update project NMR rank', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading supplier project...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">Supplier project not found.</div>
        <div className="text-center mt-4">
          <Button onClick={() => navigate('/suppliers')}>Back to Suppliers</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: 'Suppliers', href: '/suppliers' },
          { label: detail.supplierName, href: `/suppliers/${detail.supplierId}` },
          { label: detail.projectName },
        ]}
      />

      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">{detail.projectName}</h1>
              <VersionBadge version={detail.projectVersion} />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <RankBadge rank={projectRank} />
              {projectRank && <span>|</span>}
              <span>Supplier: {detail.supplierName}</span>
              {visibleActivities[0]?.activityTemplateName && (
                <>
                  <span>|</span>
                  <span>Activity: {visibleActivities[0].activityTemplateName}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Supplier Project</span>
              <Select
                value={String(detail.id)}
                onValueChange={(value: string) => navigate(`/supplier-projects/${value}`)}
              >
                <SelectTrigger className="w-48">
                  <span className="truncate">{selectedSupplierLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  {switcherOptions.map((sp) => (
                    <SelectItem key={sp.id} value={String(sp.id)}>
                      {sp.supplierName || `Supplier ${sp.supplierId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {nmrRanks.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Project NMR Rank</span>
                <Select
                  value={detail.supplierProjectNmrRank || defaultRankValue}
                  onValueChange={handleProjectRankChange}
                  disabled={updatingRank}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={defaultRankValue}>
                      No project rank
                    </SelectItem>
                    {nmrRanks.map((rank) => (
                      <SelectItem key={rank} value={rank}>
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Banner - Where Progress Lives */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
        <Info className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-600" />
        <div className="text-sm">
          <span className="font-medium">Where progress lives:</span>{' '}
          Planned dates are inherited from the project schedule (read-only).
          Actual dates and status are tracked here at the supplier level.
          Locked items will not be updated by propagation.
        </div>
      </div>

      {/* Inline Summary Row */}
      <div className="mb-6 flex flex-wrap items-center gap-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Progress:</span>
          <span className="text-sm font-medium">{summary.progressPercent}%</span>
          <span className="text-sm text-muted-foreground">
            ({summary.complete} of {summary.total})
          </span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Overdue:</span>
          <span className={`text-sm font-medium ${summary.overdue > 0 ? 'text-red-600' : ''}`}>
            {summary.overdue}
          </span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Next Due:</span>
          <span className="text-sm font-medium">{formatDate(summary.nextDue)}</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <StatusBadge status={summary.statusLabel} size="sm" />
      </div>

      <div className="space-y-4">
        {visibleActivities.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">No required activities.</div>
            </CardContent>
          </Card>
        ) : (
          visibleActivities.map((activity) => (
            <SupplierActivityCard
              key={activity.id}
              activity={activity}
              expanded={expandedActivities.has(activity.id)}
              onToggle={() => toggleActivity(activity.id)}
              onUpdate={loadDetail}
            />
          ))
        )}
      </div>

      {/* Help Footer */}
      <div className="mt-8 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium mb-1">What can I edit vs what is inherited?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Inherited from Project:</strong> Planned dates are calculated from the project schedule and propagate automatically.</li>
              <li><strong>Editable:</strong> Actual dates, status, and notes are tracked at the supplier level.</li>
              <li><strong>Lock:</strong> Prevents all changes and protects against propagation updates.</li>
              <li><strong>Override:</strong> Marks the planned date as manually set, preventing propagation updates to this date.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SupplierActivityCardProps {
  activity: SupplierProjectActivityDetail;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: () => void;
}

function SupplierActivityCard({ activity, expanded, onToggle, onUpdate }: SupplierActivityCardProps) {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<'all' | 'incomplete' | 'dueSoon' | 'overdue'>(
    'all'
  );
  const defaultOverrideValue = '__default__';
  const [overrideValue, setOverrideValue] = useState<string>(
    activity.scopeOverride || defaultOverrideValue
  );
  const [updatingOverride, setUpdatingOverride] = useState(false);
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<number>>(new Set());
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [savingAttachment, setSavingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ActivityStatus>('Complete');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const today = new Date();

  const isOverdue = (item: SupplierScheduleItemDetail) => {
    if (!item.plannedDate || item.status === 'Complete') {
      return false;
    }
    const planned = new Date(`${item.plannedDate}T00:00:00`);
    return planned < today;
  };

  const isDueSoon = (item: SupplierScheduleItemDetail) => {
    if (!item.plannedDate || item.status === 'Complete') {
      return false;
    }
    const planned = new Date(`${item.plannedDate}T00:00:00`);
    const diffDays = (planned.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 14;
  };

  useEffect(() => {
    setOverrideValue(activity.scopeOverride || defaultOverrideValue);
  }, [activity.id, activity.scopeOverride, defaultOverrideValue]);

  useEffect(() => {
    const milestoneIds = new Set(
      activity.scheduleItems.filter((item) => item.kind === 'MILESTONE').map((item) => item.id)
    );
    const milestoneIdsWithTasks = new Set<number>();
    for (const item of activity.scheduleItems) {
      if (
        item.kind === 'TASK' &&
        item.anchorType === 'SCHEDULE_ITEM' &&
        item.anchorRefId &&
        milestoneIds.has(item.anchorRefId)
      ) {
        milestoneIdsWithTasks.add(item.anchorRefId);
      }
    }
    setCollapsedMilestones(new Set(milestoneIdsWithTasks));
  }, [activity.id, activity.scheduleItems]);

  useEffect(() => {
    setAttachmentLabel('');
    setAttachmentUrl('');
    setDeletingAttachmentId(null);
  }, [activity.id]);

  useEffect(() => {
    setSelectedItems(new Set());
  }, [activity.id]);

  useEffect(() => {
    setSelectedItems((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const validIds = new Set(
        activity.scheduleItems.map((item) => item.supplierScheduleItemId)
      );
      const next = new Set<number>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [activity.scheduleItems]);

  async function handleScopeOverrideChange(value: string) {
    setUpdatingOverride(true);
    const response = await window.sqts.supplierActivityInstances.update({
      id: activity.id,
      scopeOverride: value === defaultOverrideValue ? null : (value as ScopeOverride),
    });
    setUpdatingOverride(false);
    if (response.success) {
      setOverrideValue(value);
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update activity override', variant: 'destructive' });
    }
  }

  async function handleAddAttachment() {
    if (!attachmentUrl.trim()) {
      toast({ title: 'Error', description: 'Attachment URL is required', variant: 'destructive' });
      return;
    }
    setSavingAttachment(true);
    const response = await window.sqts.supplierActivityAttachments.create({
      supplierActivityInstanceId: activity.id,
      label: attachmentLabel.trim() || undefined,
      url: attachmentUrl.trim(),
    });
    setSavingAttachment(false);
    if (response.success) {
      setAttachmentLabel('');
      setAttachmentUrl('');
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to add attachment', variant: 'destructive' });
    }
  }

  async function handleDeleteAttachment(attachmentId: number) {
    const confirmed = confirm('Remove this attachment?');
    if (!confirmed) {
      return;
    }
    setDeletingAttachmentId(attachmentId);
    const response = await window.sqts.supplierActivityAttachments.delete(attachmentId);
    setDeletingAttachmentId(null);
    if (response.success) {
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to remove attachment', variant: 'destructive' });
    }
  }

  function handleSelectionChange(itemId: number, isSelected: boolean) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  }

  async function handleBulkStatusUpdate() {
    if (selectedItems.size === 0) {
      return;
    }
    setBulkUpdating(true);
    const todayDate = new Date();
    const yyyy = todayDate.getFullYear();
    const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(todayDate.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const itemsById = new Map<number, SupplierScheduleItemDetail>(
      activity.scheduleItems.map((item) => [item.supplierScheduleItemId, item])
    );
    try {
      const results: Array<{ success: boolean; error?: string }> = [];
      let skippedLocked = 0;
      let skippedSameStatus = 0;
      let skippedMissing = 0;
      for (const itemId of selectedItems) {
        const item = itemsById.get(itemId);
        if (!item) {
          skippedMissing += 1;
          continue;
        }
        if (item.locked) {
          skippedLocked += 1;
          continue;
        }
        if (item.status === bulkStatus) {
          skippedSameStatus += 1;
          continue;
        }
        const nextUpdate: { id: number; status: ActivityStatus; actualDate?: string } = {
          id: itemId,
          status: bulkStatus,
        };
        if (bulkStatus === 'Complete' && !item.actualDate) {
          nextUpdate.actualDate = todayStr;
        }
        results.push(await window.sqts.supplierScheduleItemInstances.update(nextUpdate));
      }
      if (results.length === 0) {
        const skippedDetails = [
          skippedLocked > 0 ? `${skippedLocked} locked` : null,
          skippedSameStatus > 0 ? `${skippedSameStatus} already ${bulkStatus}` : null,
          skippedMissing > 0 ? `${skippedMissing} unavailable` : null,
        ].filter(Boolean);
        toast({
          title: 'No updates',
          description:
            skippedDetails.length > 0
              ? `Skipped ${skippedDetails.join(', ')}.`
              : 'No eligible items selected.',
        });
        return;
      }
      const failures = results.filter((result) => !result.success);
      const successCount = results.length - failures.length;
      if (failures.length > 0) {
        const firstError = failures.find((failure) => failure.error)?.error;
        toast({
          title: 'Error',
          description: firstError
            ? `${failures.length} item${failures.length === 1 ? '' : 's'} failed to update: ${firstError}`
            : `${failures.length} item${failures.length === 1 ? '' : 's'} failed to update.`,
          variant: 'destructive',
        });
      }
      if (successCount > 0) {
        const skippedDetails = [
          skippedLocked > 0 ? `${skippedLocked} locked` : null,
          skippedSameStatus > 0 ? `${skippedSameStatus} already ${bulkStatus}` : null,
          skippedMissing > 0 ? `${skippedMissing} unavailable` : null,
        ].filter(Boolean);
        toast({
          title: 'Status updated',
          description: `Updated ${successCount} item${successCount === 1 ? '' : 's'} to ${bulkStatus}.${
            skippedDetails.length > 0 ? ` Skipped ${skippedDetails.join(', ')}.` : ''
          }`,
          variant: 'success',
        });
      }
      setSelectedItems(new Set());
      onUpdate();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update selected items.',
        variant: 'destructive',
      });
    } finally {
      setBulkUpdating(false);
    }
  }

  const matchesFilter = (item: SupplierScheduleItemDetail) => {
    if (activeFilter === 'all') {
      return true;
    }
    if (activeFilter === 'incomplete') {
      return item.status !== 'Complete';
    }
    if (activeFilter === 'overdue') {
      return isOverdue(item);
    }
    if (activeFilter === 'dueSoon') {
      return isDueSoon(item);
    }
    return true;
  };

  const totalCount = activity.scheduleItems.length;
  const completedCount = activity.scheduleItems.filter((item) => item.status === 'Complete').length;
  const incompleteCount = totalCount - completedCount;
  const dueSoonCount = activity.scheduleItems.filter(isDueSoon).length;
  const overdueCount = activity.scheduleItems.filter(isOverdue).length;
  const activityStatus = activity.status === 'Not Required'
    ? 'Not Required'
    : completedCount === totalCount && totalCount > 0
    ? 'Complete'
    : completedCount > 0
    ? 'In Progress'
    : 'Not Started';

  // Build a map of item IDs to names for anchor reference tooltips
  const itemNameMap = new Map<number, string>(
    activity.scheduleItems.map((item) => [item.id, item.name])
  );

  const milestoneIds = new Set(
    activity.scheduleItems.filter((item) => item.kind === 'MILESTONE').map((item) => item.id)
  );
  const milestoneTasks = new Map<number, SupplierScheduleItemDetail[]>();
  for (const milestoneId of milestoneIds) {
    milestoneTasks.set(milestoneId, []);
  }
  const rows: Array<{ type: 'milestone' | 'item'; item: SupplierScheduleItemDetail }> = [];
  for (const item of activity.scheduleItems) {
    if (
      item.kind === 'TASK' &&
      item.anchorType === 'SCHEDULE_ITEM' &&
      item.anchorRefId &&
      milestoneIds.has(item.anchorRefId)
    ) {
      milestoneTasks.get(item.anchorRefId)?.push(item);
    } else if (item.kind === 'MILESTONE') {
      rows.push({ type: 'milestone', item });
    } else {
      rows.push({ type: 'item', item });
    }
  }

  const visibleItems: SupplierScheduleItemDetail[] = [];
  const tableRows = rows.flatMap((row) => {
    if (row.type === 'milestone') {
      const tasks = milestoneTasks.get(row.item.id) || [];
      const visibleTasks = tasks.filter((task) => matchesFilter(task));
      const showMilestone = matchesFilter(row.item) || visibleTasks.length > 0;
      if (!showMilestone) {
        return [];
      }
      visibleItems.push(row.item);
      const isCollapsed = collapsedMilestones.has(row.item.id);
      const rowItems = [
        <SupplierScheduleItemRow
          key={`milestone-${row.item.id}`}
          item={row.item}
          onUpdate={onUpdate}
          rowLevel="milestone"
          taskCount={tasks.length}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => {
            const next = new Set(collapsedMilestones);
            if (isCollapsed) {
              next.delete(row.item.id);
            } else {
              next.add(row.item.id);
            }
            setCollapsedMilestones(next);
          }}
          anchorRefName={row.item.anchorRefId ? itemNameMap.get(row.item.anchorRefId) : undefined}
          isSelected={selectedItems.has(row.item.supplierScheduleItemId)}
          onSelectChange={(nextSelected) =>
            handleSelectionChange(row.item.supplierScheduleItemId, nextSelected)
          }
          selectionDisabled={bulkUpdating}
        />,
      ];
      if (!isCollapsed) {
        rowItems.push(
          ...visibleTasks.map((task) => {
            visibleItems.push(task);
            return (
              <SupplierScheduleItemRow
                key={`task-${task.id}`}
                item={task}
                onUpdate={onUpdate}
                rowLevel="task"
                anchorRefName={task.anchorRefId ? itemNameMap.get(task.anchorRefId) : undefined}
                isSelected={selectedItems.has(task.supplierScheduleItemId)}
                onSelectChange={(nextSelected) =>
                  handleSelectionChange(task.supplierScheduleItemId, nextSelected)
                }
                selectionDisabled={bulkUpdating}
              />
            );
          })
        );
      }
      return rowItems;
    }
    if (!matchesFilter(row.item)) {
      return [];
    }
    visibleItems.push(row.item);
    return [
      <SupplierScheduleItemRow
        key={`item-${row.item.id}`}
        item={row.item}
        onUpdate={onUpdate}
        rowLevel="item"
        anchorRefName={row.item.anchorRefId ? itemNameMap.get(row.item.anchorRefId) : undefined}
        isSelected={selectedItems.has(row.item.supplierScheduleItemId)}
        onSelectChange={(nextSelected) =>
          handleSelectionChange(row.item.supplierScheduleItemId, nextSelected)
        }
        selectionDisabled={bulkUpdating}
      />,
    ];
  });

  const selectableVisibleItems = visibleItems.filter((item) => !item.locked);
  const selectedVisibleCount = selectableVisibleItems.filter((item) =>
    selectedItems.has(item.supplierScheduleItemId)
  ).length;
  const allVisibleSelected =
    selectableVisibleItems.length > 0 && selectedVisibleCount === selectableVisibleItems.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  function handleSelectAllVisible(nextSelected: boolean) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      for (const item of selectableVisibleItems) {
        if (nextSelected) {
          next.add(item.supplierScheduleItemId);
        } else {
          next.delete(item.supplierScheduleItemId);
        }
      }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <button onClick={onToggle} className="hover:bg-muted p-1 rounded">
              {expanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>{activity.activityTemplateName}</CardTitle>
                <StatusBadge status={activityStatus} size="sm" />
              </div>
              <CardDescription>
                {completedCount} of {totalCount} items complete
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Override</span>
            <Select
              value={overrideValue}
              onValueChange={handleScopeOverrideChange}
              disabled={updatingOverride}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={defaultOverrideValue}>
                  Default (Rules)
                </SelectItem>
                <SelectItem value="REQUIRED">Force Required</SelectItem>
                <SelectItem value="NOT_REQUIRED">Force Not Required</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <div className="space-y-4">
            {activity.scheduleItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">No schedule items yet.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Filter:</span>
                  <Tabs
                    value={activeFilter}
                    onValueChange={(value) =>
                      setActiveFilter(value as 'all' | 'incomplete' | 'dueSoon' | 'overdue')
                    }
                    className="w-auto"
                  >
                    <TabsList>
                      <TabsTrigger value="all">
                        All <span className="ml-1 text-xs text-muted-foreground">({totalCount})</span>
                      </TabsTrigger>
                      <TabsTrigger value="incomplete">
                        Incomplete <span className="ml-1 text-xs text-muted-foreground">({incompleteCount})</span>
                      </TabsTrigger>
                      <TabsTrigger value="dueSoon">
                        Due Soon 14d <span className="ml-1 text-xs text-muted-foreground">({dueSoonCount})</span>
                      </TabsTrigger>
                      <TabsTrigger value="overdue">
                        Overdue <span className="ml-1 text-xs text-muted-foreground">({overdueCount})</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Selected: {selectedItems.size}</span>
                    {selectedItems.size > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedItems(new Set())}
                        disabled={bulkUpdating}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={bulkStatus}
                      onValueChange={(value) => setBulkStatus(value as ActivityStatus)}
                      disabled={bulkUpdating}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleBulkStatusUpdate}
                      disabled={selectedItems.size === 0 || bulkUpdating}
                    >
                      {bulkUpdating ? 'Updating...' : 'Apply Status'}
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={(event) => handleSelectAllVisible(event.target.checked)}
                            disabled={selectableVisibleItems.length === 0 || bulkUpdating}
                            className="h-4 w-4"
                            aria-label="Select all visible items"
                          />
                        </TableHead>
                        <TableHead className="w-20">Type</TableHead>
                        <TableHead className="w-[320px]">Item</TableHead>
                        <TableHead className="w-40">Planned Date</TableHead>
                        <TableHead className="w-40">Actual Date</TableHead>
                        <TableHead className="w-40">Status</TableHead>
                        <TableHead className="w-48">Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <div className="border rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Attachments</h4>
                <span className="text-xs text-muted-foreground">
                  {activity.attachments.length} item{activity.attachments.length === 1 ? '' : 's'}
                </span>
              </div>
              {activity.attachments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No attachments yet.</div>
              ) : (
                <div className="space-y-2">
                  {activity.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          {attachment.label || attachment.url}
                        </a>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        disabled={deletingAttachmentId === attachment.id}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <Input
                  placeholder="Label (optional)"
                  value={attachmentLabel}
                  onChange={(e) => setAttachmentLabel(e.target.value)}
                />
                <Input
                  placeholder="URL"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                />
                <Button onClick={handleAddAttachment} disabled={savingAttachment}>
                  {savingAttachment ? 'Adding...' : 'Add Attachment'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface SupplierScheduleItemRowProps {
  item: SupplierScheduleItemDetail;
  onUpdate: () => void;
  isSelected: boolean;
  onSelectChange: (nextSelected: boolean) => void;
  rowLevel?: 'item' | 'milestone' | 'task';
  taskCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  anchorRefName?: string;
  selectionDisabled?: boolean;
}

function getDateCalculationTooltip(
  item: SupplierScheduleItemDetail,
  anchorRefName?: string
): string {
  const offset = item.offsetDays;
  const offsetStr = offset
    ? offset > 0
      ? `+ ${offset} days`
      : `- ${Math.abs(offset)} days`
    : '';

  switch (item.anchorType) {
    case 'FIXED_DATE':
      return item.fixedDate ? `Fixed date: ${item.fixedDate}` : 'Fixed date (not set)';
    case 'SCHEDULE_ITEM':
      return anchorRefName
        ? `${anchorRefName} ${offsetStr}`.trim()
        : `Referenced item ${offsetStr}`.trim();
    case 'COMPLETION':
      return anchorRefName
        ? `On completion of ${anchorRefName} ${offsetStr}`.trim()
        : `On completion ${offsetStr}`.trim();
    default:
      return 'Calculated date';
  }
}

const statusOptions: ActivityStatus[] = [
  'Not Started',
  'In Progress',
  'Blocked',
  'Complete',
  'Not Required',
];

function SupplierScheduleItemRow({
  item,
  onUpdate,
  isSelected,
  onSelectChange,
  rowLevel = 'item',
  taskCount,
  isCollapsed,
  onToggleCollapse,
  anchorRefName,
  selectionDisabled = false,
}: SupplierScheduleItemRowProps) {
  const calculationTooltip = getDateCalculationTooltip(item, anchorRefName);
  const rowClassName =
    rowLevel === 'milestone'
      ? 'bg-muted/30'
      : rowLevel === 'task'
      ? 'bg-muted/10'
      : '';
  const indentClassName =
    rowLevel === 'task' ? 'pl-8' : rowLevel === 'milestone' ? 'pl-3' : 'pl-2';
  const { toast } = useToast();
  const [actualDate, setActualDate] = useState(item.actualDate || '');
  const [plannedDate, setPlannedDate] = useState(item.plannedDate || '');
  const [status, setStatus] = useState(item.status);
  const [plannedOverride, setPlannedOverride] = useState(item.plannedDateOverride || false);
  const [locked, setLocked] = useState(item.locked || false);

  useEffect(() => {
    setActualDate(item.actualDate || '');
    setPlannedDate(item.plannedDate || '');
    setStatus(item.status);
    setPlannedOverride(item.plannedDateOverride || false);
    setLocked(item.locked || false);
  }, [item.id, item.actualDate, item.plannedDate, item.status, item.plannedDateOverride, item.locked]);

  async function handleActualDateCommit(nextDate: string) {
    if (!item.supplierScheduleItemId) {
      toast({ title: 'Error', description: 'Missing schedule item instance', variant: 'destructive' });
      return;
    }
    const response = await window.sqts.supplierScheduleItemInstances.update({
      id: item.supplierScheduleItemId,
      actualDate: nextDate === '' ? undefined : nextDate,
    });
    if (response.success) {
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update actual date', variant: 'destructive' });
    }
  }

  async function handlePlannedDateCommit(nextDate: string) {
    if (!item.supplierScheduleItemId) {
      toast({ title: 'Error', description: 'Missing schedule item instance', variant: 'destructive' });
      return;
    }
    const response = await window.sqts.supplierScheduleItemInstances.update({
      id: item.supplierScheduleItemId,
      plannedDate: nextDate === '' ? undefined : nextDate,
      plannedDateOverride: plannedOverride,
    });
    if (response.success) {
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update planned date', variant: 'destructive' });
    }
  }

  async function handlePlannedOverrideChange(nextValue: boolean) {
    if (!item.supplierScheduleItemId) {
      toast({ title: 'Error', description: 'Missing schedule item instance', variant: 'destructive' });
      return;
    }
    const response = await window.sqts.supplierScheduleItemInstances.update({
      id: item.supplierScheduleItemId,
      plannedDateOverride: nextValue,
      plannedDate: nextValue ? (plannedDate || item.plannedDate || undefined) : undefined,
    });
    if (response.success) {
      setPlannedOverride(nextValue);
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update planned date override', variant: 'destructive' });
    }
  }

  async function handleStatusChange(nextStatus: ActivityStatus) {
    if (!item.supplierScheduleItemId) {
      toast({ title: 'Error', description: 'Missing schedule item instance', variant: 'destructive' });
      return;
    }
    const updates: { status: ActivityStatus; actualDate?: string } = { status: nextStatus };
    if (nextStatus === 'Complete' && !actualDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      updates.actualDate = `${yyyy}-${mm}-${dd}`;
    }
    const response = await window.sqts.supplierScheduleItemInstances.update({
      id: item.supplierScheduleItemId,
      status: updates.status,
      actualDate: updates.actualDate,
    });
    if (response.success) {
      setStatus(nextStatus);
      if (updates.actualDate) {
        setActualDate(updates.actualDate);
      }
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update status', variant: 'destructive' });
    }
  }

  async function handleLockChange(nextValue: boolean) {
    if (!item.supplierScheduleItemId) {
      toast({ title: 'Error', description: 'Missing schedule item instance', variant: 'destructive' });
      return;
    }
    const response = await window.sqts.supplierScheduleItemInstances.update({
      id: item.supplierScheduleItemId,
      locked: nextValue,
    });
    if (response.success) {
      setLocked(nextValue);
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update lock', variant: 'destructive' });
    }
  }

  return (
    <TableRow className={rowClassName}>
      <TableCell className="w-12">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(event) => onSelectChange(event.target.checked)}
          disabled={selectionDisabled || locked}
          className="h-4 w-4"
          aria-label={`Select ${item.name}`}
        />
      </TableCell>
      <TableCell className="w-20">
        <TypeBadge kind={item.kind} />
      </TableCell>
      <TableCell className="w-[320px] font-medium">
        <div className={`flex items-center gap-2 ${indentClassName}`}>
          {taskCount && onToggleCollapse ? (
            <button onClick={onToggleCollapse} className="hover:bg-muted p-1 rounded">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          ) : null}
          <span>{item.name}</span>
          {taskCount ? (
            <span className="text-xs text-muted-foreground">{taskCount} tasks</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="w-40">
        <Input
          type="date"
          value={plannedDate}
          onChange={(e) => setPlannedDate(e.target.value)}
          onBlur={() => plannedOverride && handlePlannedDateCommit(plannedDate)}
          disabled={locked || !plannedOverride}
          className="w-36"
          title={calculationTooltip}
        />
      </TableCell>
      <TableCell className="w-40">
        <Input
          type="date"
          value={actualDate}
          onChange={(e) => setActualDate(e.target.value)}
          onBlur={() => handleActualDateCommit(actualDate)}
          disabled={locked}
          className="w-36"
        />
      </TableCell>
      <TableCell className="w-40">
        <Select
          value={status}
          onValueChange={(value) => handleStatusChange(value as ActivityStatus)}
          disabled={locked}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-48">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={plannedOverride}
              onCheckedChange={handlePlannedOverrideChange}
              disabled={locked}
            />
            <span className="text-xs text-muted-foreground">Override</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={locked} onCheckedChange={handleLockChange} />
            <span className="text-xs text-muted-foreground">Lock</span>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
