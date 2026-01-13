import { useEffect, useState } from 'react';
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
import type { ScheduleItemWithDates, UpdateScheduleItemParams } from '@shared/types';

interface EditProjectScheduleItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ScheduleItemWithDates | null;
  onSuccess: () => void;
}

export default function EditProjectScheduleItemDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: EditProjectScheduleItemDialogProps) {
  const [fixedDate, setFixedDate] = useState('');
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideDate, setOverrideDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setFixedDate(item.fixedDate || '');
      setOverrideEnabled(Boolean(item.overrideEnabled));
      setOverrideDate(item.overrideDate || '');
    }
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) {
      return;
    }

    const params: UpdateScheduleItemParams = {
      id: item.id,
    };

    if (item.kind === 'MILESTONE') {
      params.fixedDate = fixedDate === '' ? null : fixedDate;
    } else {
      params.overrideEnabled = overrideEnabled;
      params.overrideDate = overrideEnabled ? (overrideDate === '' ? null : overrideDate) : null;
    }

    setSubmitting(true);
    const response = await window.sqts.scheduleItems.update(params);
    setSubmitting(false);

    if (response.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      alert(response.error || 'Failed to update schedule item');
    }
  }

  if (!item) {
    return null;
  }

  const isMilestone = item.kind === 'MILESTONE';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Schedule Item</DialogTitle>
          <DialogDescription>
            {isMilestone
              ? 'Set the milestone date for this project.'
              : 'Optionally override the calculated task date.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {isMilestone ? (
              <div className="grid gap-2">
                <Label htmlFor="fixedDate">Milestone Date</Label>
                <Input
                  id="fixedDate"
                  type="date"
                  value={fixedDate}
                  onChange={(e) => setFixedDate(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input
                    id="overrideEnabled"
                    type="checkbox"
                    checked={overrideEnabled}
                    onChange={(e) => setOverrideEnabled(e.target.checked)}
                  />
                  <Label htmlFor="overrideEnabled">Override task due date</Label>
                </div>
                {overrideEnabled && (
                  <div className="grid gap-2">
                    <Label htmlFor="overrideDate">Override Date</Label>
                    <Input
                      id="overrideDate"
                      type="date"
                      value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
