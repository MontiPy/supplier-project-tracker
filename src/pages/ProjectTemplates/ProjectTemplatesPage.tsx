import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateTemplateDialog } from './CreateTemplateDialog';
import { EditTemplateDialog } from './EditTemplateDialog';
import { TemplateDetailDialog } from './TemplateDetailDialog';
import { useToast } from '@/hooks/use-toast';
import type { ProjectTemplate } from '@shared/types';

export function ProjectTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    const response = await window.sqts.projectTemplates.list();
    if (response.success && response.data) {
      setTemplates(response.data);
    }
    setLoading(false);
  }

  async function handleDelete(template: ProjectTemplate) {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;

    const response = await window.sqts.projectTemplates.delete(template.id);
    if (response.success) {
      toast({ title: 'Success', description: 'Template deleted', variant: 'success' });
      loadTemplates();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to delete', variant: 'destructive' });
    }
  }

  function openEdit(template: ProjectTemplate) {
    setSelectedTemplate(template);
    setEditDialogOpen(true);
  }

  function openDetail(template: ProjectTemplate) {
    setSelectedTemplate(template);
    setDetailDialogOpen(true);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const filteredTemplates = templates.filter(t =>
    !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Templates</h1>
          <p className="text-muted-foreground">
            Create reusable templates with milestones and activities
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium">No templates yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create a template to quickly set up projects
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No templates match your search</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id} className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(template)}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.description || '-'}
                  </TableCell>
                  <TableCell>{formatDate(template.createdAt)}</TableCell>
                  <TableCell>{formatDate(template.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(template)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(template)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadTemplates}
      />

      <EditTemplateDialog
        template={selectedTemplate}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={loadTemplates}
      />

      <TemplateDetailDialog
        templateId={selectedTemplate?.id ?? null}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdate={loadTemplates}
      />
    </div>
  );
}
