import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ScheduleItemWithDates, UpdateScheduleItemParams, ScheduleItemKind, AnchorType, ProjectMilestone } from '@shared/types';

interface EditProjectScheduleItemDialogProps {
  item: ScheduleItemWithDates | null;
  allItems: ScheduleItemWithDates[];
  projectMilestones?: ProjectMilestone[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditProjectScheduleItemDialog({
  item,
  allItems,
  projectMilestones = [],
  open,
  onOpenChange,
  onSuccess,
}: EditProjectScheduleItemDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    kind: 'MILESTONE' as ScheduleItemKind,
    anchorType: 'FIXED_DATE' as AnchorType,
    anchorRefId: null as number | null,
    offsetDays: 0,
    fixedDate: '',
    projectMilestoneId: null as number | null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item && open) {
      setFormData({
        name: item.name,
        kind: item.kind,
        anchorType: item.anchorType,
        anchorRefId: item.anchorRefId,
        offsetDays: item.offsetDays ?? 0,
        fixedDate: item.fixedDate || '',
        projectMilestoneId: item.projectMilestoneId ?? null,
      });
    }
  }, [item, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;

    setLoading(true);

    const params: UpdateScheduleItemParams = {
      id: item.id,
      name: formData.name,
      anchorType: formData.anchorType,
    };

    if (formData.anchorType === 'FIXED_DATE') {
      params.fixedDate = formData.fixedDate || null;
      params.projectMilestoneId = null;
    } else if (formData.anchorType === 'SCHEDULE_ITEM') {
      params.anchorRefId = formData.anchorRefId || undefined;
      params.offsetDays = formData.offsetDays;
      params.projectMilestoneId = null;
    } else if (formData.anchorType === 'PROJECT_MILESTONE') {
      params.projectMilestoneId = formData.projectMilestoneId;
      params.offsetDays = formData.offsetDays;
    }

    const response = await window.sqts.scheduleItems.update(params);
    setLoading(false);

    if (response.success) {
      onSuccess();
      onOpenChange(false);
    }
  }

  const milestones = allItems.filter(i => i.kind === 'MILESTONE' && i.id !== item?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Schedule Item</DialogTitle>
          <DialogDescription>Update schedule item details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter item name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="anchorType">Anchor Type</Label>
              <select
                id="anchorType"
                className="w-full px-3 py-2 border rounded-md"
                value={formData.anchorType}
                onChange={(e) => setFormData({ ...formData, anchorType: e.target.value as AnchorType })}
              >
                <option value="FIXED_DATE">Fixed Date</option>
                <option value="SCHEDULE_ITEM">Schedule Item (Milestone Reference)</option>
                {projectMilestones.length > 0 && (
                  <option value="PROJECT_MILESTONE">Project Milestone</option>
                )}
              </select>
            </div>

            {formData.anchorType === 'FIXED_DATE' && (
              <div className="space-y-2">
                <Label htmlFor="fixedDate">Fixed Date</Label>
                <Input
                  id="fixedDate"
                  type="date"
                  value={formData.fixedDate}
                  onChange={(e) => setFormData({ ...formData, fixedDate: e.target.value })}
                />
              </div>
            )}

            {formData.anchorType === 'SCHEDULE_ITEM' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="anchorRef">Reference Milestone</Label>
                  {milestones.length === 0 ? (
                    <div className="text-sm text-red-500">
                      No milestones available. Create a milestone with a fixed date first.
                    </div>
                  ) : (
                    <select
                      id="anchorRef"
                      className="w-full px-3 py-2 border rounded-md"
                      value={formData.anchorRefId || ''}
                      onChange={(e) => setFormData({ ...formData, anchorRefId: Number(e.target.value) || null })}
                      required
                    >
                      <option value="">Select milestone...</option>
                      {milestones.map((milestone) => (
                        <option key={milestone.id} value={milestone.id}>
                          {milestone.name}
                          {milestone.plannedDate && ` (${milestone.plannedDate})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offsetDays">Offset Days</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="offsetDays"
                      type="number"
                      value={formData.offsetDays}
                      onChange={(e) => setFormData({ ...formData, offsetDays: Number(e.target.value) })}
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      (negative = before, positive = after)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example: -14 means 14 days before the milestone, +7 means 7 days after
                  </p>
                </div>
              </>
            )}

            {formData.anchorType === 'PROJECT_MILESTONE' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="projectMilestone">Project Milestone</Label>
                  {projectMilestones.length === 0 ? (
                    <div className="text-sm text-red-500">
                      No project milestones defined.
                    </div>
                  ) : (
                    <select
                      id="projectMilestone"
                      className="w-full px-3 py-2 border rounded-md"
                      value={formData.projectMilestoneId || ''}
                      onChange={(e) => setFormData({ ...formData, projectMilestoneId: Number(e.target.value) || null })}
                      required
                    >
                      <option value="">Select project milestone...</option>
                      {projectMilestones.map((ms) => (
                        <option key={ms.id} value={ms.id}>
                          {ms.name}
                          {ms.date && ` (${ms.date})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offsetDays">Offset Days</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="offsetDays"
                      type="number"
                      value={formData.offsetDays}
                      onChange={(e) => setFormData({ ...formData, offsetDays: Number(e.target.value) })}
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      (negative = before, positive = after)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example: -14 means 14 days before the milestone, +7 means 7 days after
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name?.trim()}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
