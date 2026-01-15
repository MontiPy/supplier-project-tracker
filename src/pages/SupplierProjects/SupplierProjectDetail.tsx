import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
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
      setExpandedActivities(new Set(response.data.activities.map((activity) => activity.id)));
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
      alert(response.error || 'Failed to update project NMR rank');
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
              {detail.activities[0]?.activityTemplateName && (
                <>
                  <span>|</span>
                  <span>Activity: {detail.activities[0].activityTemplateName}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {sameProjectSuppliers.length > 1 && (
              <Select
                value={String(detail.id)}
                onValueChange={(value: string) => navigate(`/supplier-projects/${value}`)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sameProjectSuppliers.map((sp) => (
                    <SelectItem key={sp.id} value={String(sp.id)}>
                      {sp.supplierName || `Supplier ${sp.supplierId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {nmrRanks.length > 0 && (
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
            )}
          </div>
        </div>
      </div>

      {/* Inline Summary Row */}
      <div className="mb-6 flex flex-wrap items-center gap-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Progress</div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded bg-gray-200">
              <div
                className="h-2 rounded bg-green-600"
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium">{summary.progressPercent}%</span>
          </div>
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
        {detail.activities.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">No activities created.</div>
            </CardContent>
          </Card>
        ) : (
          detail.activities.map((activity) => (
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
  const today = new Date();

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
      alert(response.error || 'Failed to update activity override');
    }
  }

  async function handleAddAttachment() {
    if (!attachmentUrl.trim()) {
      alert('Attachment URL is required');
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
      alert(response.error || 'Failed to add attachment');
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
      alert(response.error || 'Failed to remove attachment');
    }
  }

  const matchesFilter = (item: SupplierScheduleItemDetail) => {
    if (activeFilter === 'all') {
      return true;
    }
    if (activeFilter === 'incomplete') {
      return item.status !== 'Complete';
    }
    if (!item.plannedDate || item.status === 'Complete') {
      return false;
    }
    const planned = new Date(`${item.plannedDate}T00:00:00`);
    if (activeFilter === 'overdue') {
      return planned < today;
    }
    if (activeFilter === 'dueSoon') {
      const diffDays = (planned.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 14;
    }
    return true;
  };

  const completedCount = activity.scheduleItems.filter(i => i.status === 'Complete').length;
  const totalCount = activity.scheduleItems.length;
  const activityStatus = activity.status === 'Not Required'
    ? 'Not Required'
    : completedCount === totalCount && totalCount > 0
    ? 'Complete'
    : completedCount > 0
    ? 'In Progress'
    : 'Not Started';

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
                  <span className="text-muted-foreground">Show:</span>
                  <Button
                    size="sm"
                    variant={activeFilter === 'all' ? 'default' : 'ghost'}
                    onClick={() => setActiveFilter('all')}
                  >
                    All ({activity.scheduleItems.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={activeFilter === 'incomplete' ? 'default' : 'ghost'}
                    onClick={() => setActiveFilter('incomplete')}
                  >
                    Incomplete (
                    {activity.scheduleItems.filter((item) => item.status !== 'Complete').length})
                  </Button>
                  <Button
                    size="sm"
                    variant={activeFilter === 'dueSoon' ? 'default' : 'ghost'}
                    onClick={() => setActiveFilter('dueSoon')}
                  >
                    Due Soon (14d)
                  </Button>
                  <Button
                    size="sm"
                    variant={activeFilter === 'overdue' ? 'default' : 'ghost'}
                    onClick={() => setActiveFilter('overdue')}
                  >
                    Overdue (
                    {
                      activity.scheduleItems.filter((item) => {
                        if (!item.plannedDate || item.status === 'Complete') {
                          return false;
                        }
                        const planned = new Date(`${item.plannedDate}T00:00:00`);
                        return planned < today;
                      }).length
                    }
                    )
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Type</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Planned Date</TableHead>
                        <TableHead>Actual Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.flatMap((row) => {
                        if (row.type === 'milestone') {
                          const tasks = milestoneTasks.get(row.item.id) || [];
                          const visibleTasks = tasks.filter((task) => matchesFilter(task));
                          const showMilestone = matchesFilter(row.item) || visibleTasks.length > 0;
                          if (!showMilestone) {
                            return [];
                          }
                          const isCollapsed = collapsedMilestones.has(row.item.id);
                          const rowItems = [
                            <SupplierScheduleItemRow
                              key={`milestone-${row.item.id}`}
                              item={row.item}
                              onUpdate={onUpdate}
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
                            />,
                          ];
                          if (!isCollapsed) {
                            rowItems.push(
                              ...visibleTasks.map((task) => (
                                <SupplierScheduleItemRow
                                  key={`task-${task.id}`}
                                  item={task}
                                  onUpdate={onUpdate}
                                  isChild
                                />
                              ))
                            );
                          }
                          return rowItems;
                        }
                        if (!matchesFilter(row.item)) {
                          return [];
                        }
                        return [
                          <SupplierScheduleItemRow
                            key={`item-${row.item.id}`}
                            item={row.item}
                            onUpdate={onUpdate}
                          />,
                        ];
                      })}
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
  isChild?: boolean;
  taskCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isChild = false,
  taskCount,
  isCollapsed,
  onToggleCollapse,
}: SupplierScheduleItemRowProps) {
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
      alert('Missing schedule item instance');
      return;
    }
    const response = await window.sqts.supplierScheduleItemInstances.update({
      id: item.supplierScheduleItemId,
      actualDate: nextDate === '' ? undefined : nextDate,
    });
    if (response.success) {
      onUpdate();
    } else {
      alert(response.error || 'Failed to update actual date');
    }
  }

  async function handlePlannedDateCommit(nextDate: string) {
    if (!item.supplierScheduleItemId) {
      alert('Missing schedule item instance');
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
      alert(response.error || 'Failed to update planned date');
    }
  }

  async function handlePlannedOverrideChange(nextValue: boolean) {
    if (!item.supplierScheduleItemId) {
      alert('Missing schedule item instance');
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
      alert(response.error || 'Failed to update planned date override');
    }
  }

  async function handleStatusChange(nextStatus: ActivityStatus) {
    if (!item.supplierScheduleItemId) {
      alert('Missing schedule item instance');
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
      alert(response.error || 'Failed to update status');
    }
  }

  async function handleLockChange(nextValue: boolean) {
    if (!item.supplierScheduleItemId) {
      alert('Missing schedule item instance');
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
      alert(response.error || 'Failed to update lock');
    }
  }

  return (
    <TableRow>
      <TableCell>
        <TypeBadge kind={item.kind} />
      </TableCell>
      <TableCell className="font-medium">
        <div className={`flex items-center gap-2 ${isChild ? 'pl-6' : ''}`}>
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
      <TableCell>
        <Input
          type="date"
          value={plannedDate}
          onChange={(e) => setPlannedDate(e.target.value)}
          onBlur={() => plannedOverride && handlePlannedDateCommit(plannedDate)}
          disabled={locked || !plannedOverride}
          className="w-36"
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={actualDate}
          onChange={(e) => setActualDate(e.target.value)}
          onBlur={() => handleActualDateCommit(actualDate)}
          disabled={locked}
          className="w-36"
        />
      </TableCell>
      <TableCell>
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
      <TableCell>
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


