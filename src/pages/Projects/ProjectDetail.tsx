import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, RefreshCcw, Share2, Users } from 'lucide-react';
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
import { VersionBadge, CategoryBadge } from '@/components/ui/status-badge';
import AddActivityDialog from './AddActivityDialog';
import PropagationPreviewModal from './PropagationPreviewModal';
import type { ProjectDetail, ProjectActivityDetail, SupplierProject, AuditEvent } from '../../../shared/types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
      alert(response.error || 'Failed to sync from template');
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
      alert(response.error || 'Failed to apply changes.');
      return;
    }
    const updated = response.data.updated.length;
    const skipped = response.data.skipped.length;
    alert(`Applied ${updated} updates. Skipped ${skipped} items.`);
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
