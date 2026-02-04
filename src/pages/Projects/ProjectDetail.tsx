import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, RefreshCcw, Share2, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { Label } from '@/components/ui/label';
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
import { VersionBadge, CategoryBadge, RankBadge } from '@/components/ui/status-badge';
import AddActivityDialog from './AddActivityDialog';
import PropagationPreviewModal from './PropagationPreviewModal';
import type { ProjectDetail, ProjectActivityDetail, SupplierProject, AuditEvent } from '../../../shared/types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addActivityDialogOpen, setAddActivityDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncActivityId, setSyncActivityId] = useState<number | null>(null);
  const [applyTemplateOffsets, setApplyTemplateOffsets] = useState(false);
  const [propagationModalOpen, setPropagationModalOpen] = useState(false);
  const [applyingPropagation, setApplyingPropagation] = useState(false);
  const [supplierProjects, setSupplierProjects] = useState<SupplierProject[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<number | null>(null);

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
      toast({ title: 'Error', description: response.error || 'Failed to sync from template', variant: 'destructive' });
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

  function formatPayload(payload?: string | null): string | null {
    if (!payload) {
      return null;
    }
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      return payload;
    }
  }

  async function handleApplyToSuppliers() {
    if (!projectDetail) {
      return;
    }
    if (!confirm('Apply updated schedule dates to all suppliers for this project?')) {
      return;
    }
    setApplyingPropagation(true);
    const response = await window.sqts.projects.propagateChanges(projectDetail.id);
    setApplyingPropagation(false);
    if (!response.success || !response.data) {
      toast({ title: 'Error', description: response.error || 'Failed to apply changes.', variant: 'destructive' });
      return;
    }
    const updated = response.data.updated.length;
    const skipped = response.data.skipped.length;
    toast({ title: 'Success', description: `Applied ${updated} updates. Skipped ${skipped} items.`, variant: 'success' });
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !newMilestoneName.trim()) return;

    setAddingMilestone(true);
    const response = await window.sqts.projectMilestones.create({
      projectId: Number(id),
      name: newMilestoneName.trim(),
      date: newMilestoneDate || undefined,
      sortOrder: (projectDetail?.milestones?.length ?? 0) + 1,
    });
    setAddingMilestone(false);

    if (response.success) {
      setAddMilestoneOpen(false);
      setNewMilestoneName('');
      setNewMilestoneDate('');
      loadProjectDetail();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to add milestone', variant: 'destructive' });
    }
  }

  async function handleDeleteMilestone(milestoneId: number) {
    if (!confirm('Delete this milestone? Schedule items anchored to it will need to be updated.')) return;

    setDeletingMilestoneId(milestoneId);
    const response = await window.sqts.projectMilestones.delete(milestoneId);
    setDeletingMilestoneId(null);

    if (response.success) {
      loadProjectDetail();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to delete milestone', variant: 'destructive' });
    }
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
            </p>
          </div>
          <div className="flex gap-2">
            {supplierProjects.length > 0 && (
              <>
                <Button onClick={handleApplyToSuppliers} disabled={applyingPropagation}>
                  <Users className="h-4 w-4 mr-2" />
                  {applyingPropagation ? 'Applying...' : 'Apply to Suppliers'}
                </Button>
                <Button onClick={() => setPropagationModalOpen(true)} variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Propagation Preview
                </Button>
              </>
            )}
            <Button onClick={() => setAddActivityDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </div>
        </div>
      </div>

      {/* Propagation Warning Banner */}
      {supplierProjects.length > 0 && projectDetail.activities.length > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="text-sm">
            Changes to project dates may need to be propagated to {supplierProjects.length} supplier{supplierProjects.length !== 1 ? 's' : ''}.
            Click <button onClick={() => setPropagationModalOpen(true)} className="font-medium underline hover:text-amber-900">'Propagation Preview'</button> to review and apply changes.
          </p>
        </div>
      )}

      <Tabs defaultValue="activities">
        <TabsList className="mb-6">
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="milestones">
            Milestones ({projectDetail.milestones?.length ?? 0})
          </TabsTrigger>
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
                  onSyncFromTemplate={() => openSyncDialog(activity.id)}
                  onConfigureDates={() =>
                    navigate(
                      `/projects/${projectDetail.id}/activities/${activity.id}/configure-dates`
                    )
                  }
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Project Milestones</CardTitle>
                  <CardDescription>
                    Define milestones like PA2, PA3, NMR3, etc. Activity schedule items can be anchored to these milestones.
                  </CardDescription>
                </div>
                <Button onClick={() => setAddMilestoneOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Milestone
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(!projectDetail.milestones || projectDetail.milestones.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No milestones defined yet.</p>
                  <p className="text-sm mt-1">Add milestones to define key dates that activities can reference.</p>
                  <Button onClick={() => setAddMilestoneOpen(true)} className="mt-4" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Milestone
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectDetail.milestones.map((ms) => (
                        <TableRow key={ms.id}>
                          <TableCell className="font-medium">{ms.name}</TableCell>
                          <TableCell>
                            {ms.date ? formatDate(ms.date) : <span className="text-muted-foreground">Not set</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMilestone(ms.id)}
                              disabled={deletingMilestoneId === ms.id}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Set milestone dates from the Configure Dates page of each activity.
              </p>
            </CardContent>
          </Card>
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
                        <TableHead>NMR Rank</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierProjects.map((sp) => (
                        <TableRow key={sp.id}>
                          <TableCell className="font-medium">{sp.supplierName || `Supplier ${sp.supplierId}`}</TableCell>
                          <TableCell>
                            <RankBadge rank={sp.supplierProjectNmrRank ?? null} />
                          </TableCell>
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
                        {formatPayload(event.payload) && (
                          <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {formatPayload(event.payload)}
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

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync From Template</DialogTitle>
            <DialogDescription>
              Add new schedule items and remove deleted ones from the activity template.
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

      <Dialog open={addMilestoneOpen} onOpenChange={setAddMilestoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project Milestone</DialogTitle>
            <DialogDescription>
              Define a milestone like PA2, PA3, NMR3, etc. You can set the date now or later.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMilestone}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="milestoneName">Name *</Label>
                <Input
                  id="milestoneName"
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  placeholder="e.g., PA2, PA3, NMR3"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="milestoneDate">Date (optional)</Label>
                <Input
                  id="milestoneDate"
                  type="date"
                  value={newMilestoneDate}
                  onChange={(e) => setNewMilestoneDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddMilestoneOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addingMilestone || !newMilestoneName.trim()}>
                {addingMilestone ? 'Adding...' : 'Add Milestone'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ActivityCardProps {
  activity: ProjectActivityDetail;
  onSyncFromTemplate: () => void;
  onConfigureDates: () => void;
}

function ActivityCard({
  activity,
  onSyncFromTemplate,
  onConfigureDates,
}: ActivityCardProps) {
  const milestones = activity.scheduleItems.filter((item) => item.kind === 'MILESTONE');
  const tasks = activity.scheduleItems.filter((item) => item.kind === 'TASK');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
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
            <Button onClick={onConfigureDates} size="sm">
              Configure Dates
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-muted-foreground">
          {milestones.length} milestones, {tasks.length} tasks
        </div>
      </CardContent>
    </Card>
  );
}
