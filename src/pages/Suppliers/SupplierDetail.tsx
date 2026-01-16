import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, AlertTriangle, Calendar, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { StatusBadge, VersionBadge, RankBadge } from '@/components/ui/status-badge';
import type {
  Supplier,
  Project,
  ProjectDetail,
  ProjectActivityDetail,
  SupplierProjectWithProgress,
  ApplySupplierProjectParams,
  ActivityTemplateApplicability,
} from '@shared/types';

export function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const supplierId = Number(id);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierProjects, setSupplierProjects] = useState<SupplierProjectWithProgress[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [nmrRanks, setNmrRanks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ApplySupplierProjectParams>({
    supplierId: supplierId,
    projectId: 0,
    supplierAnchorDate: '',
    supplierProjectNmrRank: '',
  });
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<ProjectDetail | null>(null);
  const [activityApplicability, setActivityApplicability] = useState<
    Map<number, ActivityTemplateApplicability>
  >(new Map());
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (Number.isNaN(supplierId)) {
      return;
    }
    loadSupplier();
    loadSupplierProjects();
  }, [supplierId]);

  async function loadSupplier() {
    const response = await window.sqts.suppliers.get(supplierId);
    if (response.success && response.data) {
      setSupplier(response.data);
    }
  }

  async function loadSupplierProjects() {
    setLoading(true);
    const response = await window.sqts.supplierProjects.listBySupplierWithProgress(supplierId);
    if (response.success && response.data) {
      setSupplierProjects(response.data);
    }
    setLoading(false);
  }

  async function loadProjects() {
    const response = await window.sqts.projects.list();
    if (response.success && response.data) {
      setProjects(response.data);
      if (response.data.length > 0) {
        setFormData({
          supplierId: supplierId,
          projectId: response.data[0].id,
          supplierAnchorDate: '',
          supplierProjectNmrRank: '',
        });
      }
    }
  }

  async function loadSettings() {
    const response = await window.sqts.settings.getAll();
    if (response.success && response.data) {
      setNmrRanks(response.data.nmrRanks);
    }
  }

  // Helper function to evaluate applicability rule on client side for preview
  function evaluateApplicability(
    applicability: ActivityTemplateApplicability,
    selectedRank: string | undefined
  ): { included: boolean; reason: string } {
    const { rule, clauses } = applicability;

    // No rule or rule disabled means activity is always included
    if (!rule || !rule.enabled) {
      return { included: true, reason: 'No applicability rule (always included)' };
    }

    if (clauses.length === 0) {
      return { included: true, reason: 'No rule conditions (always included)' };
    }

    // Evaluate each clause
    const clauseResults = clauses.map((clause) => {
      if (clause.subjectType === 'SUPPLIER_NMR') {
        const targetValue = clause.value;
        const actualValue = selectedRank || '';

        switch (clause.comparator) {
          case 'EQ':
            return { pass: actualValue === targetValue, desc: `NMR Rank = ${targetValue}` };
          case 'NEQ':
            return { pass: actualValue !== targetValue, desc: `NMR Rank ≠ ${targetValue}` };
          case 'IN': {
            const inValues = targetValue.split(',').map((v) => v.trim());
            return { pass: inValues.includes(actualValue), desc: `NMR Rank in [${targetValue}]` };
          }
          case 'NOT_IN': {
            const notInValues = targetValue.split(',').map((v) => v.trim());
            return { pass: !notInValues.includes(actualValue), desc: `NMR Rank not in [${targetValue}]` };
          }
          case 'GTE':
            return { pass: actualValue >= targetValue, desc: `NMR Rank >= ${targetValue}` };
          case 'LTE':
            return { pass: actualValue <= targetValue, desc: `NMR Rank <= ${targetValue}` };
          default:
            return { pass: true, desc: 'Unknown comparator' };
        }
      }
      // PART_PA or unknown subject type - assume pass
      return { pass: true, desc: 'Unknown subject' };
    });

    // Apply operator (ALL/ANY)
    const included =
      rule.operator === 'ALL'
        ? clauseResults.every((r) => r.pass)
        : clauseResults.some((r) => r.pass);

    const reason = clauseResults.map((r) => r.desc).join(rule.operator === 'ALL' ? ' AND ' : ' OR ');
    return { included, reason };
  }

  async function loadProjectPreview(projectId: number) {
    setLoadingPreview(true);
    try {
      const detailResponse = await window.sqts.projects.getDetail(projectId);
      if (detailResponse.success && detailResponse.data) {
        setSelectedProjectDetail(detailResponse.data);

        // Load applicability rules for each activity's template
        const applicabilityMap = new Map<number, ActivityTemplateApplicability>();
        for (const activity of detailResponse.data.activities) {
          const appResponse = await window.sqts.activityTemplates.applicability.get(
            activity.activityTemplateId
          );
          if (appResponse.success && appResponse.data) {
            applicabilityMap.set(activity.activityTemplateId, appResponse.data);
          }
        }
        setActivityApplicability(applicabilityMap);
      }
    } finally {
      setLoadingPreview(false);
    }
  }

  function getActivityPreview(): Array<{
    activity: ProjectActivityDetail;
    included: boolean;
    reason: string;
    scheduleItemCount: number;
  }> {
    if (!selectedProjectDetail) return [];

    return selectedProjectDetail.activities.map((activity) => {
      const applicability = activityApplicability.get(activity.activityTemplateId);
      const result = applicability
        ? evaluateApplicability(applicability, formData.supplierProjectNmrRank || undefined)
        : { included: true, reason: 'No applicability rule' };

      return {
        activity,
        included: result.included,
        reason: result.reason,
        scheduleItemCount: activity.scheduleItems.length,
      };
    });
  }

  async function openApplyDialog() {
    setSelectedProjectDetail(null);
    setActivityApplicability(new Map());
    await Promise.all([loadProjects(), loadSettings()]);
    setApplyDialogOpen(true);
  }

  async function handleProjectChange(projectId: number) {
    setFormData({
      ...formData,
      projectId,
    });
    await loadProjectPreview(projectId);
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    const response = await window.sqts.supplierProjects.apply({
      supplierId,
      projectId: formData.projectId,
      supplierAnchorDate: formData.supplierAnchorDate || undefined,
      supplierProjectNmrRank: formData.supplierProjectNmrRank || undefined,
    });

    if (response.success) {
      setApplyDialogOpen(false);
      await loadSupplierProjects();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to apply project', variant: 'destructive' });
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getOverallStatus(project: SupplierProjectWithProgress): string {
    if (project.overdueCount > 0) return 'At Risk';
    if (project.progressPercent === 100) return 'Complete';
    return 'On Track';
  }

  if (!supplier) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">Supplier not found.</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: 'Suppliers', href: '/suppliers' },
          { label: supplier.name },
        ]}
      />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
          </div>
          <p className="text-muted-foreground">
            {supplier.notes || 'No notes'}
          </p>
        </div>
        <Button onClick={openApplyDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Apply Project
        </Button>
      </div>

      <Tabs defaultValue="projects">
        <TabsList className="mb-6">
          <TabsTrigger value="projects">
            Projects ({supplierProjects.length})
          </TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading supplier projects...</p>
            </div>
          ) : supplierProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No projects applied yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Apply a project to start tracking supplier activity
              </p>
              <Button onClick={openApplyDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Apply Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {supplierProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{project.projectName}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <VersionBadge version={project.projectVersion} />
                          <RankBadge rank={project.supplierProjectNmrRank ?? null} />
                          {project.activityName && (
                            <span className="text-xs text-muted-foreground">
                              {project.activityName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{project.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${project.progressPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {project.completedItems} of {project.totalItems} items complete
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <div>
                          <div className="text-sm font-medium">
                            {project.overdueCount > 0 ? (
                              <span className="text-red-600">{project.overdueCount}</span>
                            ) : (
                              <span>0</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">Overdue</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-amber-500" />
                        <div>
                          <div className="text-sm font-medium">
                            {project.nextDueDate ? formatDate(project.nextDueDate) : '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">Next Due</div>
                        </div>
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <StatusBadge status={getOverallStatus(project)} size="sm" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/supplier-projects/${project.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="parts">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">Parts Management</p>
                <p className="mb-4">Manage parts and PA ranks in the Parts workspace.</p>
                <Button variant="outline" onClick={() => navigate('/parts')}>
                  Open Parts
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">Notes & Documentation</p>
                <p>Coming soon - Supplier notes and documentation will be managed here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Apply Project</DialogTitle>
            <DialogDescription>
              Apply a project template to this supplier to create activity instances.
            </DialogDescription>
          </DialogHeader>
          {projects.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No projects available. Create a project first.
            </div>
          ) : (
            <form onSubmit={handleApply} className="flex flex-col flex-1 overflow-hidden">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="projectId">Project *</Label>
                  <select
                    id="projectId"
                    className="h-10 rounded-md border bg-transparent px-3 text-sm"
                    value={formData.projectId}
                    onChange={(e) => handleProjectChange(Number(e.target.value))}
                    required
                  >
                    <option value={0} disabled>
                      Select a project...
                    </option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.version})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="supplierAnchorDate">Supplier Anchor Date</Label>
                    <Input
                      id="supplierAnchorDate"
                      type="date"
                      value={formData.supplierAnchorDate || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, supplierAnchorDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="supplierProjectNmrRank">Project NMR Rank</Label>
                    <select
                      id="supplierProjectNmrRank"
                      className="h-10 rounded-md border bg-transparent px-3 text-sm"
                      value={formData.supplierProjectNmrRank || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, supplierProjectNmrRank: e.target.value })
                      }
                    >
                      <option value="">No project rank</option>
                      {nmrRanks.map((rank) => (
                        <option key={rank} value={rank}>
                          {rank}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Activity Preview Section */}
              {formData.projectId > 0 && (
                <div className="flex flex-col flex-1 overflow-hidden border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Activities that will be created:</span>
                  </div>

                  {loadingPreview ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      Loading preview...
                    </div>
                  ) : selectedProjectDetail?.activities.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      This project has no activities configured.
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                      {getActivityPreview().map(({ activity, included, reason, scheduleItemCount }) => (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            included
                              ? 'bg-green-50 border-green-200'
                              : 'bg-gray-50 border-gray-200 opacity-60'
                          }`}
                        >
                          {included ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-medium truncate ${!included && 'text-gray-500'}`}>
                                {activity.activityTemplateName}
                              </span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {scheduleItemCount} item{scheduleItemCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 ${included ? 'text-green-700' : 'text-gray-500'}`}>
                              {included ? (reason || 'Will be included') : `Excluded: ${reason}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {selectedProjectDetail && selectedProjectDetail.activities.length > 0 && !loadingPreview && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                      {(() => {
                        const preview = getActivityPreview();
                        const includedCount = preview.filter((p) => p.included).length;
                        const totalItems = preview
                          .filter((p) => p.included)
                          .reduce((sum, p) => sum + p.scheduleItemCount, 0);
                        return (
                          <span>
                            <span className="font-medium text-foreground">{includedCount}</span> of{' '}
                            {preview.length} activities will be applied ({totalItems} schedule items)
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="mt-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setApplyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={formData.projectId === 0}>
                  Apply Project
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
