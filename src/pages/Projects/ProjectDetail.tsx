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
import { ApplyTemplateDialog } from '../ProjectTemplates/ApplyTemplateDialog';
import type { ProjectDetail, ProjectActivityDetail, SupplierProject, AuditEvent, ProjectMilestone } from '../../../shared/types';

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
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);

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
      <div className="mb-8">
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
            <Button onClick={() => setApplyTemplateOpen(true)} variant="outline">
              Apply Template
            </Button>
            <Button onClick={() => setAddActivityDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </div>
        </div>
      </div>

      {/* Propagation Warning Banner */}
      {supplierProjects.length > 0 && projectDetail.activities.length > 0 && (
        <div className="mb-8 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="text-sm">
            Changes to project dates may need to be propagated to {supplierProjects.length} supplier{supplierProjects.length !== 1 ? 's' : ''}.
            Click <button onClick={() => setPropagationModalOpen(true)} className="font-medium underline hover:text-amber-900">'Propagation Preview'</button> to review and apply changes.
          </p>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">
            Suppliers Applied ({supplierProjects.length})
          </TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Two-Column Layout: Milestones & Activities */}
          <div className="grid grid-cols-12 gap-8">
            {/* Left Column: Project Milestones */}
            <div className="col-span-4">
              <div className="sticky top-8">
                <div className="mb-6">
                  <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-2xl font-bold tracking-tight">Milestones</h2>
                    <Button onClick={() => setAddMilestoneOpen(true)} size="sm" variant="outline">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Key dates like PA2, PA3, NMR3 that activities reference
                  </p>
                </div>

                {(!projectDetail.milestones || projectDetail.milestones.length === 0) ? (
                  <div className="rounded-xl border-2 border-dashed border-muted bg-muted/10 p-8 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-2">No milestones yet</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Define project milestones to anchor activities
                    </p>
                    <Button onClick={() => setAddMilestoneOpen(true)} size="sm">
                      Create First Milestone
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectDetail.milestones.map((ms) => (
                      <MilestoneCard
                        key={ms.id}
                        milestone={ms}
                        onDelete={handleDeleteMilestone}
                        isDeleting={deletingMilestoneId === ms.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Activities */}
            <div className="col-span-8">
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-2xl font-bold tracking-tight">Activities</h2>
                  <Button onClick={() => setAddActivityDialogOpen(true)} size="sm" variant="outline">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Project phases with schedule items and deliverables
                </p>
              </div>

              {projectDetail.activities.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-muted bg-muted/10 p-12 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium mb-2">No activities yet</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Add activities to build your project timeline
                  </p>
                  <Button onClick={() => setAddActivityDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Activity
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {projectDetail.activities.map((activity) => (
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
                  ))}
                </div>
              )}
            </div>
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

      <ApplyTemplateDialog
        projectId={Number(id)}
        open={applyTemplateOpen}
        onOpenChange={setApplyTemplateOpen}
        onSuccess={loadProjectDetail}
      />
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
    <Card className="border-l-4 border-l-primary/20 hover:border-l-primary/40 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{activity.activityTemplateName}</CardTitle>
                {activity.activityTemplateCategory && (
                  <CategoryBadge category={activity.activityTemplateCategory} />
                )}
              </div>
              <CardDescription className="mt-1.5">
                {milestones.length} milestones, {tasks.length} tasks
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onSyncFromTemplate} size="sm" variant="outline">
              <RefreshCcw className="h-4 w-4 mr-1" />
              Sync
            </Button>
            <Button onClick={onConfigureDates} size="sm">
              Configure Dates
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

interface MilestoneCardProps {
  milestone: ProjectMilestone;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function MilestoneCard({ milestone, onDelete, isDeleting }: MilestoneCardProps) {
  const formatMilestoneDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Not set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="group relative rounded-lg border bg-card p-4 hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base mb-1 truncate">{milestone.name}</h3>
          <p className={`text-sm ${milestone.date ? 'text-muted-foreground' : 'text-muted-foreground/60 italic'}`}>
            {formatMilestoneDate(milestone.date)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(milestone.id)}
          disabled={isDeleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
