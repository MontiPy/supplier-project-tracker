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
import { useToast } from '@/hooks/use-toast';
import type { ActivityTemplate } from '../../../shared/types';

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  onSuccess: () => void;
}

export default function AddActivityDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: AddActivityDialogProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  async function loadTemplates() {
    setLoading(true);
    const response = await window.sqts.activityTemplates.list();
    if (response.success && response.data) {
      setTemplates(response.data);
      if (response.data.length > 0) {
        setSelectedTemplateId(response.data[0].id);
      }
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedTemplateId) {
      toast({ title: 'Error', description: 'Please select an activity template', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const response = await window.sqts.projectActivities.create({
      projectId,
      activityTemplateId: selectedTemplateId,
    });

    setSubmitting(false);

    if (response.success) {
      onOpenChange(false);
      onSuccess();
      setSelectedTemplateId(null);
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to add activity', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Activity to Project</DialogTitle>
          <DialogDescription>
            Select an activity template to add to this project
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template">Activity Template</Label>
              {loading ? (
                <div className="text-sm text-gray-500">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-sm text-red-500">
                  No activity templates available. Create one first in the Activity Library.
                </div>
              ) : (
                <select
                  id="template"
                  className="w-full px-3 py-2 border rounded-md"
                  value={selectedTemplateId || ''}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                  required
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.description && ` - ${template.description}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || templates.length === 0}>
              {submitting ? 'Adding...' : 'Add Activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
