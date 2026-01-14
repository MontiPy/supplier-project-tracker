import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { VersionBadge } from '@/components/ui/status-badge';
import type { ProjectWithStats, CreateProjectParams, UpdateProjectParams } from '@shared/types';

export function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectWithStats | null>(null);
  const [formData, setFormData] = useState<CreateProjectParams>({
    name: '',
    version: '',
    defaultAnchorRule: '',
    projectAnchorDate: '',
  });

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const response = await window.sqts.projects.listWithStats();
    if (response.success && response.data) {
      setProjects(response.data);
    }
    setLoading(false);
  }

  function openCreateDialog() {
    setEditingProject(null);
    setFormData({ name: '', version: '', defaultAnchorRule: '', projectAnchorDate: '' });
    setDialogOpen(true);
  }

  function openEditDialog(project: ProjectWithStats, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingProject(project);
    setFormData({
      name: project.name,
      version: project.version,
      defaultAnchorRule: project.defaultAnchorRule || '',
      projectAnchorDate: project.projectAnchorDate || '',
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(project: ProjectWithStats, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingProject(project);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingProject) {
      // Update
      const params: UpdateProjectParams = {
        id: editingProject.id,
        name: formData.name,
        version: (formData.version || '').trim() === '' ? undefined : formData.version,
        defaultAnchorRule: formData.defaultAnchorRule || undefined,
        projectAnchorDate: formData.projectAnchorDate || undefined,
      };
      const response = await window.sqts.projects.update(params);
      if (response.success) {
        await loadProjects();
        setDialogOpen(false);
      }
    } else {
      // Create
      const response = await window.sqts.projects.create(formData);
      if (response.success) {
        await loadProjects();
        setDialogOpen(false);
      }
    }
  }

  async function handleDelete() {
    if (deletingProject) {
      const response = await window.sqts.projects.delete(deletingProject.id);
      if (response.success) {
        await loadProjects();
        setDeleteDialogOpen(false);
        setDeletingProject(null);
      }
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

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your project templates</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first project template
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Project
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right"># Activities</TableHead>
                <TableHead className="text-right"># Suppliers</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>
                    <VersionBadge version={project.version} />
                  </TableCell>
                  <TableCell className="text-right">{project.activityCount}</TableCell>
                  <TableCell className="text-right">{project.supplierCount}</TableCell>
                  <TableCell>
                    {project.nextDueDate ? (
                      <span className="text-amber-600">{formatDate(project.nextDueDate)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(project.lastUpdated)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => openEditDialog(project, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => openDeleteDialog(project, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}`);
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProject ? 'Edit Project' : 'Create Project'}
            </DialogTitle>
            <DialogDescription>
              {editingProject
                ? 'Update project information'
                : 'Add a new project template'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="Auto-generated if blank (e.g., 2026-01-13)"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="projectAnchorDate">Project Anchor Date</Label>
                <Input
                  id="projectAnchorDate"
                  type="date"
                  value={formData.projectAnchorDate}
                  onChange={(e) =>
                    setFormData({ ...formData, projectAnchorDate: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProject?.name} {deletingProject?.version}"?
              This action cannot be undone.
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
