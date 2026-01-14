import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, RefreshCcw, Trash2, Share2, Download, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { VersionBadge, CategoryBadge, TypeBadge } from '@/components/ui/status-badge';
import AddActivityDialog from './AddActivityDialog';
import EditProjectScheduleItemDialog from './EditProjectScheduleItemDialog';
import PropagationPreviewModal from './PropagationPreviewModal';
import type { ProjectDetail, ProjectActivityDetail, ScheduleItemWithDates, SupplierProject, AuditEvent } from '../../../shared/types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [addActivityDialogOpen, setAddActivityDialogOpen] = useState(false);
  const [editScheduleItemDialogOpen, setEditScheduleItemDialogOpen] = useState(false);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItemWithDates | null>(
    null
  );
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncActivityId, setSyncActivityId] = useState<number | null>(null);
  const [applyTemplateOffsets, setApplyTemplateOffsets] = useState(false);
  const [propagationModalOpen, setPropagationModalOpen] = useState(false);
  const [supplierProjects, setSupplierProjects] = useState<SupplierProject[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    if (id) {
      loadProjectDetail();
      loadSupplierProjects();
      loadAuditEvents();
    }
  }, [id]);

  async function loadProjectDetail() {
    if (!id) return;

    setLoading(true);
    setError(null);
    const response = await window.sqts.projects.getDetail(Number(id));

    if (response.success && response.data) {
      setProjectDetail(response.data);
      // Expand all activities by default
      const activityIds = new Set(response.data.activities.map(a => a.id));
      setExpandedActivities(activityIds);
    } else {
      setError(response.error || 'Failed to load project');
    }
    setLoading(false);
  }

  async function loadSupplierProjects() {
    if (!id) return;

    const response = await window.sqts.supplierProjects.list();
    if (response.success && response.data) {
      const filtered = response.data.filter(sp => sp.projectId === Number(id));
      setSupplierProjects(filtered);
    }
  }

  async function loadAuditEvents() {
    if (!id) return;

    const response = await window.sqts.audit.list({ entityType: 'project', entityId: Number(id) });
    if (response.success && response.data) {
      setAuditEvents(response.data);
    }
  }

  function toggleActivity(activityId: number) {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  }

  function handleEditScheduleItem(item: ScheduleItemWithDates) {
    setSelectedScheduleItem(item);
    setEditScheduleItemDialogOpen(true);
  }

  function openSyncDialog(activityId: number) {
    setSyncActivityId(activityId);
    setApplyTemplateOffsets(false);
    setSyncDialogOpen(true);
  }

  async function handleSyncFromTemplate() {
    if (!syncActivityId) {
      return;
    }
    const response = await window.sqts.projectActivities.syncFromTemplate({
      projectActivityId: syncActivityId,
      applyTemplateOffsets,
    });
    if (response.success) {
      setSyncDialogOpen(false);
      loadProjectDetail();
    } else {
      alert(response.error || 'Failed to sync from template');
    }
  }

  async function handleDeleteActivity(activityId: number) {
    if (!confirm('Are you sure you want to delete this activity and all its schedule items?')) {
      return;
    }

    const response = await window.sqts.projectActivities.delete(activityId);
    if (response.success) {
      loadProjectDetail();
    } else {
      alert(response.error || 'Failed to delete activity');
    }
  }

  async function handleDeleteScheduleItem(scheduleItemId: number) {
    if (!confirm('Are you sure you want to delete this schedule item?')) {
      return;
    }

    const response = await window.sqts.scheduleItems.delete(scheduleItemId);
    if (response.success) {
      loadProjectDetail();
    } else {
      alert(response.error || 'Failed to delete schedule item');
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading project...</div>
      </div>
    );
  }

  if (error || !projectDetail) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">
          {error || 'Project not found'}
        </div>
        <div className="text-center mt-4">
          <Button onClick={() => navigate('/projects')}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: projectDetail.name },
        ]}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{projectDetail.name}</h1>
              <VersionBadge version={projectDetail.version} />
            </div>
            <p className="text-muted-foreground mt-1">
              {projectDetail.activities.length} {projectDetail.activities.length === 1 ? 'activity' : 'activities'}
              {projectDetail.projectAnchorDate && (
                <span className="ml-2">
                  | Anchor Date: {projectDetail.projectAnchorDate}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {supplierProjects.length > 0 && (
              <Button onClick={() => setPropagationModalOpen(true)} variant="outline">
                <Share2 className="h-4 w-4 mr-2" />
                Propagation Preview
              </Button>
            )}
            <Button variant="outline" disabled>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setAddActivityDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="activities">
        <TabsList className="mb-6">
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="suppliers">
            Suppliers Applied ({supplierProjects.length})
          </TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          {/* Activities List */}
          <div className="space-y-4">
            {projectDetail.activities.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <p>No activities added yet.</p>
                    <Button onClick={() => setAddActivityDialogOpen(true)} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Activity
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              projectDetail.activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  expanded={expandedActivities.has(activity.id)}
                  onToggle={() => toggleActivity(activity.id)}
                  onSyncFromTemplate={() => openSyncDialog(activity.id)}
                  onDeleteActivity={() => handleDeleteActivity(activity.id)}
                  onDeleteScheduleItem={handleDeleteScheduleItem}
                  onEditScheduleItem={handleEditScheduleItem}
                  onUpdate={loadProjectDetail}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle>Suppliers with this Project Applied</CardTitle>
            </CardHeader>
            <CardContent>
              {supplierProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No suppliers have this project applied yet.</p>
                  <p className="text-sm">Apply this project to a supplier from the Supplier detail page.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Supplier Anchor Date</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierProjects.map((sp) => (
                        <TableRow key={sp.id}>
                          <TableCell className="font-medium">{sp.supplierName || `Supplier ${sp.supplierId}`}</TableCell>
                          <TableCell>{sp.supplierAnchorDate || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(sp.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/supplier-projects/${sp.id}`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                History of changes and propagation events for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No audit events recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-4 border-b pb-4 last:border-0">
                      <div className="flex-1">
                        <div className="font-medium">{event.action}</div>
                        {event.details && (
                          <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {JSON.stringify(JSON.parse(event.details), null, 2)}
                          </pre>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddActivityDialog
        open={addActivityDialogOpen}
        onOpenChange={setAddActivityDialogOpen}
        projectId={Number(id)}
        onSuccess={loadProjectDetail}
      />

      <EditProjectScheduleItemDialog
        open={editScheduleItemDialogOpen}
        onOpenChange={setEditScheduleItemDialogOpen}
        item={selectedScheduleItem}
        onSuccess={loadProjectDetail}
      />

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync From Template</DialogTitle>
            <DialogDescription>
              Add any new schedule items from the activity template.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2 text-sm">
            <input
              id="applyTemplateOffsets"
              type="checkbox"
              checked={applyTemplateOffsets}
              onChange={(e) => setApplyTemplateOffsets(e.target.checked)}
            />
            <label htmlFor="applyTemplateOffsets">
              Update anchor rules and offsets from the template (keeps project dates/overrides).
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSyncFromTemplate}>
              Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PropagationPreviewModal
        open={propagationModalOpen}
        onOpenChange={setPropagationModalOpen}
        projectId={Number(id)}
        onSuccess={() => {
          loadProjectDetail();
          loadSupplierProjects();
        }}
      />
    </div>
  );
}

interface ActivityCardProps {
  activity: ProjectActivityDetail;
  expanded: boolean;
  onToggle: () => void;
  onSyncFromTemplate: () => void;
  onDeleteActivity: () => void;
  onDeleteScheduleItem: (id: number) => void;
  onEditScheduleItem: (item: ScheduleItemWithDates) => void;
  onUpdate: () => void;
}

function ActivityCard({
  activity,
  expanded,
  onToggle,
  onSyncFromTemplate,
  onDeleteActivity,
  onDeleteScheduleItem,
  onEditScheduleItem,
  onUpdate,
}: ActivityCardProps) {
  const milestones = activity.scheduleItems.filter((item) => item.kind === 'MILESTONE');
  const tasks = activity.scheduleItems.filter((item) => item.kind === 'TASK');
  const itemById = new Map(activity.scheduleItems.map((item) => [item.id, item] as const));
  const [milestoneDates, setMilestoneDates] = useState<Record<number, string>>({});
  const [savingDates, setSavingDates] = useState(false);

  useEffect(() => {
    const nextDates: Record<number, string> = {};
    milestones.forEach((item) => {
      nextDates[item.id] = item.fixedDate || '';
    });
    setMilestoneDates(nextDates);
  }, [activity.scheduleItems]);

  const hasChanges = milestones.some(
    (item) => (milestoneDates[item.id] || '') !== (item.fixedDate || '')
  );

  function getCalculation(item: ScheduleItemWithDates) {
    if (item.kind === 'MILESTONE') {
      if (item.anchorType === 'FIXED_DATE') {
        return 'Fixed date';
      }
      if (item.anchorType === 'PROJECT_ANCHOR') {
        return 'Project-set';
      }
      return item.anchorType.replace('_', ' ');
    }
    if (item.anchorType === 'SCHEDULE_ITEM' && item.anchorRefId) {
      const anchorName = itemById.get(item.anchorRefId)?.name || `Item ${item.anchorRefId}`;
      const offset = item.offsetDays ?? 0;
      if (offset === 0) {
        return `${anchorName}`;
      }
      return `${anchorName} ${offset > 0 ? '+' : ''}${offset}d`;
    }
    return item.anchorType.replace('_', ' ');
  }

  async function handleSaveDates() {
    if (!hasChanges) {
      return;
    }
    setSavingDates(true);
    const updates = milestones
      .filter((item) => (milestoneDates[item.id] || '') !== (item.fixedDate || ''))
      .map((item) =>
        window.sqts.scheduleItems.update({
          id: item.id,
          fixedDate: milestoneDates[item.id] === '' ? null : milestoneDates[item.id],
        })
      );
    const results = await Promise.all(updates);
    setSavingDates(false);
    const failures = results.filter((result) => !result.success);
    if (failures.length > 0) {
      alert('Some milestone dates failed to save. Please try again.');
      return;
    }
    onUpdate();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
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
                {activity.activityTemplateCategory && (
                  <CategoryBadge category={activity.activityTemplateCategory} />
                )}
              </div>
              <CardDescription>
                {milestones.length} milestones, {tasks.length} tasks
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onSyncFromTemplate} size="sm" variant="outline">
              <RefreshCcw className="h-4 w-4 mr-1" />
              Sync From Template
            </Button>
            <Button onClick={onDeleteActivity} size="sm" variant="outline">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {activity.scheduleItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              <p>No schedule items yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Set milestone dates here. Task dates derive from milestone anchors and template
                offsets.
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-md border">
                  <div className="border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Project Milestone Dates</h3>
                    <p className="text-xs text-muted-foreground">
                      Update milestone dates that anchor task calculations.
                    </p>
                  </div>
                  <div className="space-y-4 p-4">
                    {milestones.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No milestones in this activity.
                      </div>
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
                    <div className="flex justify-end">
                      <Button onClick={handleSaveDates} disabled={!hasChanges || savingDates}>
                        Save Dates
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border">
                  <div className="border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Complete Schedule Preview</h3>
                    <p className="text-xs text-muted-foreground">
                      Calculated dates based on milestone anchors and offsets.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Type</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Planned Date</TableHead>
                        <TableHead>Calculation</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activity.scheduleItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <TypeBadge kind={item.kind} />
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className={item.plannedDate ? 'text-blue-600' : ''}>
                            {item.plannedDate || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {getCalculation(item)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button onClick={() => onEditScheduleItem(item)} size="sm" variant="ghost">
                              Edit
                            </Button>
                            <Button onClick={() => onDeleteScheduleItem(item.id)} size="sm" variant="ghost">
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
