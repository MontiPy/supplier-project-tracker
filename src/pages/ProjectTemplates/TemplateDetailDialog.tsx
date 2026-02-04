import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ProjectTemplateDetail, ActivityTemplate } from '@shared/types';

interface TemplateDetailDialogProps {
  templateId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function TemplateDetailDialog({ templateId, open, onOpenChange, onUpdate }: TemplateDetailDialogProps) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<ProjectTemplateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [availableActivities, setAvailableActivities] = useState<ActivityTemplate[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);

  useEffect(() => {
    if (templateId && open) {
      loadTemplate();
      loadActivities();
    }
  }, [templateId, open]);

  async function loadTemplate() {
    if (!templateId) return;
    setLoading(true);
    const response = await window.sqts.projectTemplates.get(templateId);
    if (response.success && response.data) {
      setTemplate(response.data);
    }
    setLoading(false);
  }

  async function loadActivities() {
    const response = await window.sqts.activityTemplates.list();
    if (response.success && response.data) {
      setAvailableActivities(response.data);
      if (response.data.length > 0) {
        setSelectedActivityId(response.data[0].id);
      }
    }
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId || !newMilestoneName.trim()) return;

    const sortOrder = (template?.milestones.length ?? 0);
    const response = await window.sqts.projectTemplates.addMilestone({
      templateId,
      name: newMilestoneName.trim(),
      sortOrder,
    });

    if (response.success) {
      setNewMilestoneName('');
      loadTemplate();
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to add milestone', variant: 'destructive' });
    }
  }

  async function handleDeleteMilestone(id: number) {
    if (!confirm('Delete this milestone?')) return;

    const response = await window.sqts.projectTemplates.deleteMilestone(id);
    if (response.success) {
      loadTemplate();
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to delete milestone', variant: 'destructive' });
    }
  }

  async function handleAddActivity() {
    if (!templateId || !selectedActivityId) return;

    const response = await window.sqts.projectTemplates.addActivity({
      templateId,
      activityTemplateId: selectedActivityId,
    });

    if (response.success) {
      loadTemplate();
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to add activity', variant: 'destructive' });
    }
  }

  async function handleDeleteActivity(id: number) {
    if (!confirm('Remove this activity from template?')) return;

    const response = await window.sqts.projectTemplates.deleteActivity(id);
    if (response.success) {
      loadTemplate();
      onUpdate();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to remove activity', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.name}</DialogTitle>
          <DialogDescription>{template?.description || 'No description'}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : template ? (
          <div className="space-y-6 py-4">
            {/* Milestones Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Milestones</h3>
              <div className="space-y-2 mb-3">
                {template.milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No milestones yet</p>
                ) : (
                  template.milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-center justify-between p-2 border rounded">
                      <span>{milestone.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteMilestone(milestone.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleAddMilestone} className="flex gap-2">
                <Input
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  placeholder="Add milestone (e.g., PA2)"
                />
                <Button type="submit" disabled={!newMilestoneName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </div>

            {/* Activities Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Activities</h3>
              <div className="space-y-2 mb-3">
                {template.activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities yet</p>
                ) : (
                  template.activities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-2 border rounded">
                      <span>{activity.activityTemplateName}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteActivity(activity.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <select
                  className="flex-1 px-3 py-2 border rounded-md"
                  value={selectedActivityId || ''}
                  onChange={(e) => setSelectedActivityId(Number(e.target.value))}
                >
                  {availableActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.name}
                    </option>
                  ))}
                </select>
                <Button onClick={handleAddActivity} disabled={!selectedActivityId}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
