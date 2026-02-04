import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';
import type { Project } from '@shared/types';

interface ApplyToProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityTemplateId: number;
  activityTemplateName: string;
  onSuccess: () => void;
}

export function ApplyToProjectsDialog({
  open,
  onOpenChange,
  activityTemplateId,
  activityTemplateName,
  onSuccess,
}: ApplyToProjectsDialogProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (open) {
      loadProjects();
      setSelectedIds(new Set());
    }
  }, [open]);

  async function loadProjects() {
    setLoading(true);
    const response = await window.sqts.projects.list();
    if (response.success && response.data) {
      setProjects(response.data);
    }
    setLoading(false);
  }

  function toggleSelection(projectId: number) {
    const newSet = new Set(selectedIds);
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    setSelectedIds(newSet);
  }

  function selectAll() {
    setSelectedIds(new Set(projects.map((p) => p.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleApply() {
    if (selectedIds.size === 0) {
      toast({
        title: 'No projects selected',
        description: 'Please select at least one project',
        variant: 'destructive',
      });
      return;
    }

    setApplying(true);
    const result = await window.sqts.projectActivities.batchCreate({
      projectIds: Array.from(selectedIds),
      activityTemplateIds: [activityTemplateId],
      autoSync: true,
    });
    setApplying(false);

    if (result.success && result.data) {
      toast({
        title: 'Success',
        description: `Added to ${result.data.created} projects. ${
          result.data.skipped > 0 ? `Skipped ${result.data.skipped} (already exists).` : ''
        }`,
      });
      onOpenChange(false);
      onSuccess();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to apply activity to projects',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply "{activityTemplateName}" to Projects</DialogTitle>
          <DialogDescription>
            Select which projects should include this activity template
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Selection Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Clear
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedIds.size} of {projects.length}
                </div>
              </div>

              {/* Project List */}
              <div className="border rounded-md max-h-96 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No projects found. Create a project first.
                  </div>
                ) : (
                  <div className="divide-y">
                    {projects.map((project) => (
                      <label
                        key={project.id}
                        className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(project.id)}
                          onChange={() => toggleSelection(project.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{project.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Version: {project.version}
                          </div>
                        </div>
                        {selectedIds.has(project.id) && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={applying || selectedIds.size === 0}>
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              `Apply to ${selectedIds.size} Project${selectedIds.size !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
