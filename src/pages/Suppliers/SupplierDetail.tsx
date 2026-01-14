import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, AlertTriangle, Calendar } from 'lucide-react';
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
  SupplierProjectWithProgress,
  ApplySupplierProjectParams,
} from '@shared/types';

export function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const supplierId = Number(id);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierProjects, setSupplierProjects] = useState<SupplierProjectWithProgress[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ApplySupplierProjectParams>({
    supplierId: supplierId,
    projectId: 0,
    supplierAnchorDate: '',
  });

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
        });
      }
    }
  }

  async function openApplyDialog() {
    await loadProjects();
    setApplyDialogOpen(true);
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    const response = await window.sqts.supplierProjects.apply({
      supplierId,
      projectId: formData.projectId,
      supplierAnchorDate: formData.supplierAnchorDate || undefined,
    });

    if (response.success) {
      setApplyDialogOpen(false);
      await loadSupplierProjects();
    } else {
      alert(response.error || 'Failed to apply project');
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
            <RankBadge rank={supplier.nmrRank} />
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
                <p>Coming soon - Part assignments and PA ranks will be managed here.</p>
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
        <DialogContent>
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
            <form onSubmit={handleApply}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="projectId">Project *</Label>
                  <select
                    id="projectId"
                    className="h-10 rounded-md border bg-transparent px-3 text-sm"
                    value={formData.projectId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        projectId: Number(e.target.value),
                      })
                    }
                    required
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.version})
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setApplyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Apply Project</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
