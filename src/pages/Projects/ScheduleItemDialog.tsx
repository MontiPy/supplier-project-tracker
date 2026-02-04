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
import { useToast } from '@/hooks/use-toast';
import type { ScheduleItemKind, AnchorType, ScheduleItemWithDates, ProjectMilestone } from '../../../shared/types';

interface ScheduleItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: number | null;
  projectId: number | null;
  onSuccess: () => void;
}

export default function ScheduleItemDialog({
  open,
  onOpenChange,
  activityId,
  projectId,
  onSuccess,
}: ScheduleItemDialogProps) {
  const { toast } = useToast();
  const [kind, setKind] = useState<ScheduleItemKind>('MILESTONE');
  const [name, setName] = useState('');
  const [anchorType, setAnchorType] = useState<AnchorType>('FIXED_DATE');
  const [fixedDate, setFixedDate] = useState('');
  const [anchorRefId, setAnchorRefId] = useState<number | null>(null);
  const [projectMilestoneId, setProjectMilestoneId] = useState<number | null>(null);
  const [offsetDays, setOffsetDays] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItemWithDates[]>([]);
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (open && activityId) {
      loadScheduleItems();
      loadProjectMilestones();
      // Reset form
      setKind('MILESTONE');
      setName('');
      setAnchorType('FIXED_DATE');
      setFixedDate('');
      setAnchorRefId(null);
      setProjectMilestoneId(null);
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

  async function loadProjectMilestones() {
    if (!projectId) return;
    const response = await window.sqts.projectMilestones.list(projectId);
    if (response.success && response.data) {
      setProjectMilestones(response.data);
      if (response.data.length > 0) {
        setProjectMilestoneId(response.data[0].id);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!activityId) {
      toast({ title: 'Error', description: 'No activity selected', variant: 'destructive' });
      return;
    }

    // Validation
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Please enter a name', variant: 'destructive' });
      return;
    }

    if (anchorType === 'FIXED_DATE' && !fixedDate) {
      toast({ title: 'Error', description: 'Please enter a fixed date', variant: 'destructive' });
      return;
    }

    if (anchorType === 'SCHEDULE_ITEM' && !anchorRefId) {
      toast({ title: 'Error', description: 'Please select a reference schedule item', variant: 'destructive' });
      return;
    }

    if (anchorType === 'PROJECT_MILESTONE' && !projectMilestoneId) {
      toast({ title: 'Error', description: 'Please select a project milestone', variant: 'destructive' });
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
      projectMilestoneId: anchorType === 'PROJECT_MILESTONE' && projectMilestoneId !== null ? projectMilestoneId : undefined,
    });

    setSubmitting(false);

    if (response.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to create schedule item', variant: 'destructive' });
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
                {projectMilestones.length > 0 && (
                  <option value="PROJECT_MILESTONE">Project Milestone</option>
                )}
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

            {anchorType === 'PROJECT_MILESTONE' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="projectMilestone">Project Milestone</Label>
                  {projectMilestones.length === 0 ? (
                    <div className="text-sm text-red-500">
                      No project milestones defined. Add milestones from the Project Detail page.
                    </div>
                  ) : (
                    <select
                      id="projectMilestone"
                      className="w-full px-3 py-2 border rounded-md"
                      value={projectMilestoneId || ''}
                      onChange={(e) => setProjectMilestoneId(Number(e.target.value))}
                      required
                    >
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
                (anchorType === 'SCHEDULE_ITEM' && milestones.length === 0) ||
                (anchorType === 'PROJECT_MILESTONE' && projectMilestones.length === 0)
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
