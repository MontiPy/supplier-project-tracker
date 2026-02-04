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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ActivityTemplate } from '@shared/types';

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateTemplateDialog({ open, onOpenChange, onSuccess }: CreateTemplateDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [milestones, setMilestones] = useState<string>('');
  const [activities, setActivities] = useState<ActivityTemplate[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadActivities();
      resetForm();
    }
  }, [open]);

  async function loadActivities() {
    const response = await window.sqts.activityTemplates.list();
    if (response.success && response.data) {
      setActivities(response.data);
    }
  }

  function resetForm() {
    setName('');
    setDescription('');
    setMilestones('');
    setSelectedActivityIds([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Parse milestones from comma-separated string
    const milestoneList = milestones
      .split(',')
      .map(m => m.trim())
      .filter(Boolean)
      .map((name, index) => ({ name, sortOrder: index }));

    const response = await window.sqts.projectTemplates.create({
      name,
      description: description || undefined,
      milestones: milestoneList.length > 0 ? milestoneList : undefined,
      activityTemplateIds: selectedActivityIds.length > 0 ? selectedActivityIds : undefined,
    });

    setLoading(false);

    if (response.success) {
      toast({ title: 'Success', description: 'Template created', variant: 'success' });
      onOpenChange(false);
      onSuccess();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to create', variant: 'destructive' });
    }
  }

  function toggleActivity(id: number) {
    setSelectedActivityIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Project Template</DialogTitle>
          <DialogDescription>
            Create a reusable template with milestones and activities
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard NMR Project"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="milestones">Milestones (comma-separated)</Label>
              <Input
                id="milestones"
                value={milestones}
                onChange={(e) => setMilestones(e.target.value)}
                placeholder="e.g., PA2, PA3, NMR3"
              />
              <p className="text-xs text-muted-foreground">
                Enter milestone names separated by commas
              </p>
            </div>

            <div className="space-y-2">
              <Label>Activities (select from library)</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities available</p>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`activity-${activity.id}`}
                        checked={selectedActivityIds.includes(activity.id)}
                        onChange={() => toggleActivity(activity.id)}
                      />
                      <label htmlFor={`activity-${activity.id}`} className="text-sm cursor-pointer">
                        {activity.name}
                        {activity.category && ` (${activity.category})`}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
