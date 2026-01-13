import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
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
import type { Project, CreateProjectParams, UpdateProjectParams } from '@shared/types';

export function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
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
    const response = await window.sqts.projects.list();
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

  function openEditDialog(project: Project) {
    setEditingProject(project);
    setFormData({
      name: project.name,
      version: project.version,
      defaultAnchorRule: project.defaultAnchorRule || '',
      projectAnchorDate: project.projectAnchorDate || '',
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(project: Project) {
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
        version: formData.version.trim() === '' ? undefined : formData.version,
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
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Anchor Rule</TableHead>
              <TableHead>Project Anchor Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>{project.version}</TableCell>
                  <TableCell>{project.defaultAnchorRule || '-'}</TableCell>
                  <TableCell>{project.projectAnchorDate || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/projects/${project.id}`)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(project)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(project)}
                      title="Delete"
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
                <Label htmlFor="defaultAnchorRule">Default Anchor Rule</Label>
                <Input
                  id="defaultAnchorRule"
                  value={formData.defaultAnchorRule}
                  onChange={(e) => setFormData({ ...formData, defaultAnchorRule: e.target.value })}
                  placeholder="Optional (Phase 2 feature)"
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
