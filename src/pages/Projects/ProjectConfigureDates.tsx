import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TypeBadge, VersionBadge } from '@/components/ui/status-badge';
import PropagationPreviewModal from './PropagationPreviewModal';
import type { ProjectDetail, ProjectActivityDetail, ScheduleItemWithDates } from '@shared/types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function addDays(dateString: string, offsetDays: number): string {
  const date = new Date(dateString + 'T00:00:00');
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculatePlannedDate(
  item: ScheduleItemWithDates,
  resolvedDates: Map<number, string>
): string | null {
  if (item.overrideEnabled && item.overrideDate) {
    return item.overrideDate;
  }

  switch (item.anchorType) {
    case 'FIXED_DATE':
      return item.fixedDate;
    case 'SCHEDULE_ITEM': {
      if (item.anchorRefId === null) {
        return null;
      }
      const refDate = resolvedDates.get(item.anchorRefId);
      if (!refDate) {
        return null;
      }
      if (item.offsetDays === null) {
        return refDate;
      }
      return addDays(refDate, item.offsetDays);
    }
    default:
      return null;
  }
}

function calculateScheduleDates(
  scheduleItems: ScheduleItemWithDates[]
): ScheduleItemWithDates[] {
  const resolvedDates = new Map<number, string>();
  const results: ScheduleItemWithDates[] = [];
  const unprocessed = new Set(scheduleItems.map((item) => item.id));
  let previousUnprocessedCount = unprocessed.size;

  while (unprocessed.size > 0) {
    let progress = false;

    for (const item of scheduleItems) {
      if (!unprocessed.has(item.id)) {
        continue;
      }
      const plannedDate = calculatePlannedDate(item, resolvedDates);
      if (plannedDate !== null) {
        resolvedDates.set(item.id, plannedDate);
        unprocessed.delete(item.id);
        progress = true;
        results.push({ ...item, plannedDate, error: undefined });
      }
    }

    if (!progress && unprocessed.size > 0) {
      for (const item of scheduleItems) {
        if (unprocessed.has(item.id)) {
          results.push({
            ...item,
            plannedDate: null,
            error: 'Cannot compute date - missing anchor',
          });
        }
      }
      break;
    }

    if (unprocessed.size === previousUnprocessedCount) {
      break;
    }
    previousUnprocessedCount = unprocessed.size;
  }

  return scheduleItems.map((item) => {
    const result = results.find((entry) => entry.id === item.id);
    return result || { ...item, plannedDate: null, error: 'Failed to compute date' };
  });
}

function getCalculation(item: ScheduleItemWithDates, itemById: Map<number, ScheduleItemWithDates>) {
  if (item.kind === 'MILESTONE') {
    if (item.anchorType === 'FIXED_DATE') {
      return 'Fixed date';
    }
    return item.anchorType.replace('_', ' ');
  }
  if (item.anchorType === 'SCHEDULE_ITEM' && item.anchorRefId) {
    const anchorName = itemById.get(item.anchorRefId)?.name || `Item ${item.anchorRefId}`;
    const offset = item.offsetDays ?? 0;
    if (offset === 0) {
      return anchorName;
    }
    return `${anchorName} ${offset > 0 ? '+' : ''}${offset}d`;
  }
  return item.anchorType.replace('_', ' ');
}

export function ProjectConfigureDates() {
  const { projectId, activityId } = useParams<{
    projectId: string;
    activityId?: string;
  }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [milestoneDates, setMilestoneDates] = useState<Record<number, string>>({});
  const [previewItems, setPreviewItems] = useState<ScheduleItemWithDates[]>([]);
  const [saving, setSaving] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [propagationModalOpen, setPropagationModalOpen] = useState(false);

  useEffect(() => {
    loadProjectDetail();
  }, [projectId]);

  async function loadProjectDetail() {
    if (!projectId) {
      return;
    }
    setLoading(true);
    const response = await window.sqts.projects.getDetail(Number(projectId));
    if (response.success && response.data) {
      setProjectDetail(response.data);
    }
    setLoading(false);
  }

  const activity = useMemo<ProjectActivityDetail | null>(() => {
    if (!projectDetail || projectDetail.activities.length === 0) {
      return null;
    }
    if (activityId) {
      return projectDetail.activities.find((item) => item.id === Number(activityId)) || null;
    }
    return projectDetail.activities[0];
  }, [projectDetail, activityId]);

  const milestones = useMemo(
    () => activity?.scheduleItems.filter((item) => item.kind === 'MILESTONE') ?? [],
    [activity]
  );

  const hasChanges = useMemo(
    () =>
      milestones.some(
        (item) => (milestoneDates[item.id] || '') !== (item.fixedDate || '')
      ),
    [milestones, milestoneDates]
  );

  useEffect(() => {
    if (!activity) {
      return;
    }
    const nextDates: Record<number, string> = {};
    activity.scheduleItems
      .filter((item) => item.kind === 'MILESTONE')
      .forEach((item) => {
        nextDates[item.id] = item.fixedDate || '';
      });
    setMilestoneDates(nextDates);
    const calculated = calculateScheduleDates(activity.scheduleItems);
    setPreviewItems(calculated);
  }, [activity]);

  async function saveMilestoneDates(): Promise<boolean> {
    if (!activity) {
      return false;
    }
    if (!hasChanges) {
      return true;
    }
    setSaving(true);
    const updates = milestones
      .filter((item) => (milestoneDates[item.id] || '') !== (item.fixedDate || ''))
      .map((item) =>
        window.sqts.scheduleItems.update({
          id: item.id,
          fixedDate: milestoneDates[item.id] === '' ? null : milestoneDates[item.id],
        })
      );
    const results = await Promise.all(updates);
    setSaving(false);
    const failures = results.filter((result) => !result.success);
    if (failures.length > 0) {
      toast({ title: 'Error', description: 'Some milestone dates failed to save. Please try again.', variant: 'destructive' });
      return false;
    }
    await loadProjectDetail();
    return true;
  }

  async function handlePreview() {
    if (!activity) {
      return;
    }
    const updatedItems = activity.scheduleItems.map((item) => {
      if (item.kind !== 'MILESTONE') {
        return item;
      }
      const fixedDate = milestoneDates[item.id] || '';
      return { ...item, fixedDate: fixedDate === '' ? null : fixedDate };
    });
    const calculated = calculateScheduleDates(updatedItems);
    setPreviewItems(calculated);
  }

  async function handleSave() {
    await saveMilestoneDates();
  }

  async function handlePropagate() {
    if (!projectDetail) {
      return;
    }
    if (hasChanges) {
      const saved = await saveMilestoneDates();
      if (!saved) {
        return;
      }
    }
    setPropagating(true);
    const response = await window.sqts.projects.propagateChanges(projectDetail.id);
    setPropagating(false);
    if (!response.success || !response.data) {
      toast({ title: 'Error', description: response.error || 'Failed to propagate changes.', variant: 'destructive' });
      return;
    }
    toast({
      title: 'Success',
      description: `Propagation complete. Updated ${response.data.updated.length}, skipped ${response.data.skipped.length}.`,
      variant: 'success',
    });
  }

  async function handleSyncFromTemplate() {
    if (!activity) {
      return;
    }
    setSyncing(true);
    const response = await window.sqts.projectActivities.syncFromTemplate({
      projectActivityId: activity.id,
      applyTemplateOffsets: false,
    });
    setSyncing(false);
    if (!response.success) {
      toast({ title: 'Error', description: response.error || 'Failed to sync from template.', variant: 'destructive' });
      return;
    }
    await loadProjectDetail();
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading configuration...</div>
      </div>
    );
  }

  if (!projectDetail || !activity) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">Project or activity not found.</div>
        <div className="text-center mt-4">
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  const itemById = new Map(previewItems.map((item) => [item.id, item] as const));

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectDetail.name },
        ]}
      />

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">{projectDetail.name}</h1>
            <VersionBadge version={projectDetail.version} />
          </div>
          <p className="text-muted-foreground">
            Configure activity dates for {activity.activityTemplateName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPropagationModalOpen(true)}>
            Preview Propagation
          </Button>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Activity: <span className="text-foreground font-medium">{activity.activityTemplateName}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleSyncFromTemplate} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync from Template'}
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 mb-6">
        <Info className="h-4 w-4 flex-shrink-0" />
        <div>
          Set milestone dates here. Task dates derive from milestone anchors and template offsets.
          Changes propagate to suppliers when applied.
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Milestone Dates</CardTitle>
            <CardDescription>
              Update milestone dates that anchor task calculations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {milestones.length === 0 ? (
              <div className="text-sm text-muted-foreground">No milestones in this activity.</div>
            ) : (
              milestones.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <Input
                      type="date"
                      value={milestoneDates[item.id] || ''}
                      onChange={(e) =>
                        setMilestoneDates((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setMilestoneDates((prev) => ({ ...prev, [item.id]: '' }))
                    }
                  >
                    Clear
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Complete Schedule Preview</CardTitle>
              <CardDescription>
                Calculated dates based on milestone anchors and offsets.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handlePreview}>
              Preview
            </Button>
          </CardHeader>
          <CardContent>
            {previewItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">No schedule items to preview.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Planned Date</TableHead>
                      <TableHead>Calculation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <TypeBadge kind={item.kind} />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className={item.plannedDate ? 'text-blue-600' : ''}>
                          {formatDate(item.plannedDate)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getCalculation(item, itemById)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex items-center justify-end gap-2 border-t pt-6">
        <Button variant="outline" onClick={() => navigate(`/projects/${projectDetail.id}`)}>
          Cancel
        </Button>
        <Button variant="outline" onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button onClick={handlePropagate} disabled={propagating}>
          {propagating ? 'Propagating...' : 'Propagate'}
        </Button>
      </div>

      <PropagationPreviewModal
        open={propagationModalOpen}
        onOpenChange={setPropagationModalOpen}
        projectId={projectDetail.id}
        onSuccess={() => {
          loadProjectDetail();
        }}
      />
    </div>
  );
}
