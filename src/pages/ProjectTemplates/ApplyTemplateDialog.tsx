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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import type { ProjectTemplate } from '@shared/types';

interface ApplyTemplateDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ApplyTemplateDialog({ projectId, open, onOpenChange, onSuccess }: ApplyTemplateDialogProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [mergeStrategy, setMergeStrategy] = useState<'REPLACE_ALL' | 'MERGE_ADD'>('MERGE_ADD');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  async function loadTemplates() {
    const response = await window.sqts.projectTemplates.list();
    if (response.success && response.data) {
      setTemplates(response.data);
      if (response.data.length > 0) {
        setSelectedTemplateId(response.data[0].id);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplateId) return;

    setLoading(true);
    const response = await window.sqts.projectTemplates.applyToProject({
      templateId: selectedTemplateId,
      projectId,
      mergeStrategy,
    });
    setLoading(false);

    if (response.success && response.data) {
      const { milestonesCreated, activitiesCreated, scheduleItemsLinked, errors } = response.data;

      let message = `Added ${milestonesCreated} milestones, ${activitiesCreated} activities. `;
      message += `Linked ${scheduleItemsLinked} schedule items to milestones.`;

      if (errors.length > 0) {
        message += `\n\nWarnings: ${errors.slice(0, 3).join(', ')}`;
      }

      toast({ title: 'Template Applied', description: message, variant: 'success' });
      onOpenChange(false);
      onSuccess();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to apply', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Template to Project</DialogTitle>
          <DialogDescription>
            Select a template and merge strategy
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template</Label>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates available</p>
              ) : (
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={selectedTemplateId || ''}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Merge Strategy</Label>
              <RadioGroup value={mergeStrategy} onValueChange={(v: string) => setMergeStrategy(v as 'REPLACE_ALL' | 'MERGE_ADD')}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="MERGE_ADD" id="merge" />
                  <div className="flex-1">
                    <Label htmlFor="merge" className="cursor-pointer font-normal">
                      Merge (Add Only)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Keep existing milestones/activities, add new ones from template
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="REPLACE_ALL" id="replace" />
                  <div className="flex-1">
                    <Label htmlFor="replace" className="cursor-pointer font-normal">
                      Replace All
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Delete all existing milestones/activities, replace with template
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || templates.length === 0}>
              {loading ? 'Applying...' : 'Apply Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
