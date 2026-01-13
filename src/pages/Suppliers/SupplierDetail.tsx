import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  Supplier,
  Project,
  SupplierProjectSummary,
  ApplySupplierProjectParams,
} from '@shared/types';

export function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const supplierId = Number(id);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierProjects, setSupplierProjects] = useState<SupplierProjectSummary[]>([]);
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
    const response = await window.sqts.supplierProjects.listBySupplier(supplierId);
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

  if (!supplier) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">Supplier not found.</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
          <p className="text-muted-foreground">
            NMR Rank: {supplier.nmrRank || '-'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/suppliers')}>
            Back to Suppliers
          </Button>
          <Button onClick={openApplyDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Apply Project
          </Button>
        </div>
      </div>

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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Supplier Anchor Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierProjects.map((supplierProject) => (
                <TableRow key={supplierProject.id}>
                  <TableCell className="font-medium">{supplierProject.projectName}</TableCell>
                  <TableCell>{supplierProject.projectVersion}</TableCell>
                  <TableCell>{supplierProject.supplierAnchorDate || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/supplier-projects/${supplierProject.id}`)}
                      title="View Project"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
