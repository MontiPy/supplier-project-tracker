import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import type { Part, CreatePartParams, UpdatePartParams, SupplierProjectSummary } from '@shared/types';

export function PartsList() {
  const [supplierProjects, setSupplierProjects] = useState<SupplierProjectSummary[]>([]);
  const [selectedSupplierProjectId, setSelectedSupplierProjectId] = useState<number | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [deletingPart, setDeletingPart] = useState<Part | null>(null);
  const [formData, setFormData] = useState<CreatePartParams>({
    supplierProjectId: 0,
    partNumber: '',
    description: '',
    paRank: '',
    notes: '',
  });

  useEffect(() => {
    loadSupplierProjects();
  }, []);

  useEffect(() => {
    if (selectedSupplierProjectId) {
      loadParts(selectedSupplierProjectId);
    }
  }, [selectedSupplierProjectId]);

  async function loadSupplierProjects() {
    setLoading(true);
    const response = await window.sqts.supplierProjects.list();
    if (response.success && response.data) {
      setSupplierProjects(response.data);
      if (response.data.length > 0) {
        setSelectedSupplierProjectId(response.data[0].id);
      }
    }
    setLoading(false);
  }

  async function loadParts(supplierProjectId: number) {
    const response = await window.sqts.parts.list(supplierProjectId);
    if (response.success && response.data) {
      setParts(response.data);
    }
  }

  function openCreateDialog() {
    if (!selectedSupplierProjectId) {
      return;
    }
    setEditingPart(null);
    setFormData({
      supplierProjectId: selectedSupplierProjectId,
      partNumber: '',
      description: '',
      paRank: '',
      notes: '',
    });
    setDialogOpen(true);
  }

  function openEditDialog(part: Part) {
    setEditingPart(part);
    setFormData({
      supplierProjectId: part.supplierProjectId,
      partNumber: part.partNumber,
      description: part.description || '',
      paRank: part.paRank || '',
      notes: part.notes || '',
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(part: Part) {
    setDeletingPart(part);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingPart) {
      const params: UpdatePartParams = {
        id: editingPart.id,
        partNumber: formData.partNumber,
        description: formData.description || undefined,
        paRank: formData.paRank || undefined,
        notes: formData.notes || undefined,
      };
      const response = await window.sqts.parts.update(params);
      if (response.success && selectedSupplierProjectId) {
        await loadParts(selectedSupplierProjectId);
        setDialogOpen(false);
      }
    } else {
      const response = await window.sqts.parts.create({
        supplierProjectId: formData.supplierProjectId,
        partNumber: formData.partNumber,
        description: formData.description || undefined,
        paRank: formData.paRank || undefined,
        notes: formData.notes || undefined,
      });
      if (response.success && selectedSupplierProjectId) {
        await loadParts(selectedSupplierProjectId);
        setDialogOpen(false);
      }
    }
  }

  async function handleDelete() {
    if (deletingPart) {
      const response = await window.sqts.parts.delete(deletingPart.id);
      if (response.success && selectedSupplierProjectId) {
        await loadParts(selectedSupplierProjectId);
        setDeleteDialogOpen(false);
        setDeletingPart(null);
      }
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parts</h1>
          <p className="text-muted-foreground">Manage parts by supplier project</p>
        </div>
        <Button onClick={openCreateDialog} disabled={!selectedSupplierProjectId}>
          <Plus className="mr-2 h-4 w-4" />
          Add Part
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading supplier projects...</p>
        </div>
      ) : supplierProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium">No supplier projects yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Apply a project to a supplier before creating parts.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="supplierProject">Supplier Project</Label>
            <select
              id="supplierProject"
              className="h-10 rounded-md border bg-transparent px-3 text-sm"
              value={selectedSupplierProjectId || ''}
              onChange={(e) => setSelectedSupplierProjectId(Number(e.target.value))}
            >
              {supplierProjects.map((supplierProject) => (
                <option key={supplierProject.id} value={supplierProject.id}>
                  {supplierProject.supplierName} - {supplierProject.projectName} (
                  {supplierProject.projectVersion})
                </option>
              ))}
            </select>
          </div>

          {parts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No parts yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add parts for PA ranking and activity applicability.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Part
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>PA Rank</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parts.map((part) => (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">{part.partNumber}</TableCell>
                      <TableCell>{part.description || '-'}</TableCell>
                      <TableCell>{part.paRank || '-'}</TableCell>
                      <TableCell className="max-w-md truncate">{part.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(part)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(part)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPart ? 'Edit Part' : 'Create Part'}</DialogTitle>
            <DialogDescription>
              {editingPart ? 'Update part details.' : 'Add a new part to this supplier project.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="partNumber">Part Number *</Label>
                <Input
                  id="partNumber"
                  value={formData.partNumber}
                  onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paRank">PA Rank</Label>
                <Input
                  id="paRank"
                  value={formData.paRank}
                  onChange={(e) => setFormData({ ...formData, paRank: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingPart ? 'Save Changes' : 'Create Part'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Part</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingPart?.partNumber}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
