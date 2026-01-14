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
import type { ScheduleItemKind, AnchorType, ScheduleItemWithDates } from '../../../shared/types';

interface ScheduleItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: number | null;
  onSuccess: () => void;
}

export default function ScheduleItemDialog({
  open,
  onOpenChange,
  activityId,
  onSuccess,
}: ScheduleItemDialogProps) {
  const [kind, setKind] = useState<ScheduleItemKind>('MILESTONE');
  const [name, setName] = useState('');
  const [anchorType, setAnchorType] = useState<AnchorType>('FIXED_DATE');
  const [fixedDate, setFixedDate] = useState('');
  const [anchorRefId, setAnchorRefId] = useState<number | null>(null);
  const [offsetDays, setOffsetDays] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItemWithDates[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (open && activityId) {
      loadScheduleItems();
      // Reset form
      setKind('MILESTONE');
      setName('');
      setAnchorType('FIXED_DATE');
      setFixedDate('');
      setAnchorRefId(null);
      setOffsetDays(0);
    }
  }, [open, activityId]);

  async function loadScheduleItems() {
    if (!activityId) return;

    setLoadingItems(true);
    const response = await window.sqts.scheduleItems.list(activityId);
    if (response.success && response.data) {
      setScheduleItems(response.data);
      // Set default anchor ref to first milestone if available
      const firstMilestone = response.data.find(item => item.kind === 'MILESTONE');
      if (firstMilestone) {
        setAnchorRefId(firstMilestone.id);
      }
    }
    setLoadingItems(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!activityId) {
      alert('No activity selected');
      return;
    }

    // Validation
    if (!name.trim()) {
      alert('Please enter a name');
      return;
    }

    if (anchorType === 'FIXED_DATE' && !fixedDate) {
      alert('Please enter a fixed date');
      return;
    }

    if (anchorType === 'SCHEDULE_ITEM' && !anchorRefId) {
      alert('Please select a reference schedule item');
      return;
    }

    setSubmitting(true);
    const response = await window.sqts.scheduleItems.create({
      projectActivityId: activityId,
      kind,
      name: name.trim(),
      anchorType,
      anchorRefId: anchorType === 'SCHEDULE_ITEM' && anchorRefId !== null ? anchorRefId : undefined,
      offsetDays: anchorType !== 'FIXED_DATE' ? offsetDays : undefined,
      fixedDate: anchorType === 'FIXED_DATE' ? fixedDate : undefined,
    });

    setSubmitting(false);

    if (response.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      alert(response.error || 'Failed to create schedule item');
    }
  }

  const milestones = scheduleItems.filter(item => item.kind === 'MILESTONE');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Schedule Item</DialogTitle>
          <DialogDescription>
            Create a milestone or task for this activity
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Kind */}
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="kind"
                    value="MILESTONE"
                    checked={kind === 'MILESTONE'}
                    onChange={(e) => setKind(e.target.value as ScheduleItemKind)}
                  />
                  <span>Milestone</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="kind"
                    value="TASK"
                    checked={kind === 'TASK'}
                    onChange={(e) => setKind(e.target.value as ScheduleItemKind)}
                  />
                  <span>Task</span>
                </label>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Milestone 2 Due, Submit Task"
                required
              />
            </div>

            {/* Anchor Type */}
            <div className="space-y-2">
              <Label htmlFor="anchorType">Anchor Type</Label>
              <select
                id="anchorType"
                className="w-full px-3 py-2 border rounded-md"
                value={anchorType}
                onChange={(e) => setAnchorType(e.target.value as AnchorType)}
              >
                <option value="FIXED_DATE">Fixed Date</option>
                <option value="SCHEDULE_ITEM">Schedule Item (Milestone Reference)</option>
                <option value="PROJECT_ANCHOR">Project Anchor</option>
              </select>
            </div>

            {/* Conditional Fields */}
            {anchorType === 'FIXED_DATE' && (
              <div className="space-y-2">
                <Label htmlFor="fixedDate">Fixed Date</Label>
                <Input
                  id="fixedDate"
                  type="date"
                  value={fixedDate}
                  onChange={(e) => setFixedDate(e.target.value)}
                  required
                />
              </div>
            )}

            {anchorType === 'SCHEDULE_ITEM' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="anchorRef">Reference Milestone</Label>
                  {loadingItems ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : milestones.length === 0 ? (
                    <div className="text-sm text-red-500">
                      No milestones available. Create a milestone with a fixed date first.
                    </div>
                  ) : (
                    <select
                      id="anchorRef"
                      className="w-full px-3 py-2 border rounded-md"
                      value={anchorRefId || ''}
                      onChange={(e) => setAnchorRefId(Number(e.target.value))}
                      required
                    >
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
                      value={offsetDays}
                      onChange={(e) => setOffsetDays(Number(e.target.value))}
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-600">
                      (negative = before, positive = after)
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Example: -14 means 14 days before the milestone, +7 means 7 days after
                  </p>
                </div>
              </>
            )}

            {anchorType === 'PROJECT_ANCHOR' && (
              <div className="space-y-2">
                <Label htmlFor="projectOffsetDays">Offset Days from Project Anchor</Label>
                <Input
                  id="projectOffsetDays"
                  type="number"
                  value={offsetDays}
                  onChange={(e) => setOffsetDays(Number(e.target.value))}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500">
                  Note: Project anchor date is not yet configured. This will be available in Phase 3.
                </p>
              </div>
            )}
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
            <Button
              type="submit"
              disabled={
                submitting ||
                (anchorType === 'SCHEDULE_ITEM' && milestones.length === 0)
              }
            >
              {submitting ? 'Creating...' : 'Create Schedule Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
