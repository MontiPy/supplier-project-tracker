import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Info, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  ActivityTemplate,
  ActivityTemplateScheduleItem,
  CreateActivityTemplateScheduleItemParams,
  UpdateActivityTemplateScheduleItemParams,
  AnchorType,
} from '@shared/types';

const anchorTypes: AnchorType[] = [
  'FIXED_DATE',
  'SCHEDULE_ITEM',
  'COMPLETION',
  'PROJECT_MILESTONE',
];

export function ActivityTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const templateId = Number(id);
  const [template, setTemplate] = useState<ActivityTemplate | null>(null);
  const [items, setItems] = useState<ActivityTemplateScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActivityTemplateScheduleItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ActivityTemplateScheduleItem | null>(null);
  const [formData, setFormData] = useState<CreateActivityTemplateScheduleItemParams>({
    activityTemplateId: templateId,
    kind: 'MILESTONE',
    name: '',
    anchorType: 'FIXED_DATE',
    anchorRefId: undefined,
    offsetDays: undefined,
  });
  const milestones = items.filter((item) => item.kind === 'MILESTONE');
  const itemById = new Map(items.map((item) => [item.id, item] as const));
  const milestoneIds = new Set(milestones.map((item) => item.id));
  const tasksByMilestone = items.reduce((acc, item) => {
    if (item.kind === 'TASK' && item.anchorType === 'SCHEDULE_ITEM' && item.anchorRefId) {
      if (!acc.has(item.anchorRefId)) {
        acc.set(item.anchorRefId, []);
      }
      acc.get(item.anchorRefId)?.push(item);
    }
    return acc;
  }, new Map<number, ActivityTemplateScheduleItem[]>());
  const ungroupedTasks = items.filter(
    (item) =>
      item.kind === 'TASK' &&
      (item.anchorType !== 'SCHEDULE_ITEM' ||
        !item.anchorRefId ||
        !milestoneIds.has(item.anchorRefId))
  );

  useEffect(() => {
    if (!Number.isNaN(templateId)) {
      loadTemplate();
      loadItems();
    }
  }, [templateId]);

  async function loadTemplate() {
    const response = await window.sqts.activityTemplates.get(templateId);
    if (response.success && response.data) {
      setTemplate(response.data);
    }
  }

  async function loadItems() {
    setLoading(true);
    const response = await window.sqts.activityTemplates.scheduleItems.list(templateId);
    if (response.success && response.data) {
      setItems(response.data);
    }
    setLoading(false);
  }

  function openCreateDialog() {
    setEditingItem(null);
    setFormData({
      activityTemplateId: templateId,
      kind: 'MILESTONE',
      name: '',
      anchorType: 'FIXED_DATE',
      anchorRefId: undefined,
      offsetDays: undefined,
    });
    setDialogOpen(true);
  }

  function openCreateTaskDialog(milestoneId?: number) {
    const defaultMilestoneId = milestoneId ?? milestones[0]?.id;
    setEditingItem(null);
    setFormData({
      activityTemplateId: templateId,
      kind: 'TASK',
      name: '',
      anchorType: 'SCHEDULE_ITEM',
      anchorRefId: defaultMilestoneId,
      offsetDays: 0,
    });
    setDialogOpen(true);
  }

  function openEditDialog(item: ActivityTemplateScheduleItem) {
    setEditingItem(item);
    const anchorType = item.kind === 'TASK' ? 'SCHEDULE_ITEM' : item.anchorType;
    setFormData({
      activityTemplateId: templateId,
      kind: item.kind,
      name: item.name,
      anchorType,
      anchorRefId: item.anchorRefId || undefined,
      offsetDays: item.offsetDays ?? undefined,
      projectMilestoneName: item.projectMilestoneName || undefined,
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(item: ActivityTemplateScheduleItem) {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const anchorType = formData.kind === 'TASK' ? 'SCHEDULE_ITEM' : formData.anchorType;
    const anchorRefId =
      formData.kind === 'TASK' ? formData.anchorRefId || undefined : formData.anchorRefId;
    const projectMilestoneName =
      anchorType === 'PROJECT_MILESTONE' ? formData.projectMilestoneName || undefined : undefined;

    if (editingItem) {
      const params: UpdateActivityTemplateScheduleItemParams = {
        id: editingItem.id,
        kind: formData.kind,
        name: formData.name,
        anchorType,
        anchorRefId,
        offsetDays: formData.offsetDays ?? undefined,
        projectMilestoneName,
      };
      const response = await window.sqts.activityTemplates.scheduleItems.update(params);
      if (response.success) {
        await loadItems();
        setDialogOpen(false);
      }
    } else {
      const response = await window.sqts.activityTemplates.scheduleItems.create({
        ...formData,
        anchorType,
        anchorRefId,
        projectMilestoneName,
      });
      if (response.success) {
        await loadItems();
        setDialogOpen(false);
      }
    }
  }

  async function handleDelete() {
    if (deletingItem) {
      const response = await window.sqts.activityTemplates.scheduleItems.delete(deletingItem.id);
      if (response.success) {
        await loadItems();
        setDeleteDialogOpen(false);
        setDeletingItem(null);
      }
    }
  }

  function formatAnchorType(anchorType: AnchorType) {
    return anchorType.replace('_', ' ');
  }

  function getAnchorRefLabel(item: ActivityTemplateScheduleItem) {
    if (item.anchorType === 'PROJECT_MILESTONE') {
      return item.projectMilestoneName || '-';
    }
    if (item.anchorType !== 'SCHEDULE_ITEM' || !item.anchorRefId) {
      return '-';
    }
    return itemById.get(item.anchorRefId)?.name || `Schedule Item ${item.anchorRefId}`;
  }

  function getOffsetLabel(item: ActivityTemplateScheduleItem) {
    if (item.offsetDays == null) {
      return '-';
    }
    return item.offsetDays;
  }

  function getNotes(item: ActivityTemplateScheduleItem) {
    if (item.anchorType === 'PROJECT_MILESTONE' && item.projectMilestoneName) {
      if (!item.offsetDays) {
        return `On ${item.projectMilestoneName} date`;
      }
      if (item.offsetDays < 0) {
        return `${Math.abs(item.offsetDays)} days before ${item.projectMilestoneName}`;
      }
      return `${item.offsetDays} days after ${item.projectMilestoneName}`;
    }
    if (item.kind === 'MILESTONE') {
      return 'Set at project level';
    }
    if (item.anchorType === 'SCHEDULE_ITEM' && item.anchorRefId) {
      const anchorName = itemById.get(item.anchorRefId)?.name || 'milestone';
      if (!item.offsetDays) {
        return `Due on ${anchorName}`;
      }
      if (item.offsetDays < 0) {
        return `Due ${Math.abs(item.offsetDays)} days before ${anchorName}`;
      }
      return `Due ${item.offsetDays} days after ${anchorName}`;
    }
    return '-';
  }

  function handleValidate() {
    const invalidTasks = items.filter(
      (item) => item.kind === 'TASK' && (!item.anchorRefId || item.anchorType !== 'SCHEDULE_ITEM')
    );
    if (invalidTasks.length > 0) {
      toast({ title: 'Validation Failed', description: 'Some tasks are missing a milestone anchor. Please fix them before continuing.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Success', description: 'Schedule template looks valid.', variant: 'success' });
  }

  if (!template) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">Activity template not found.</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
          <p className="text-muted-foreground">{template.description || 'No description'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/activity-library')}>
            Back to Activity Library
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Milestone
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading schedule items...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium">No schedule items yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Add milestones and tasks for this activity template.
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Milestone
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <Info className="h-4 w-4" />
            <div>
              This template defines structure and offset rules. Milestones anchored to project
              dates are set at the project level, and tasks inherit dates from milestones.
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Schedule Templates
              </Button>
              <Button variant="ghost" size="sm" disabled>
                Applicability Rules
              </Button>
              <Button variant="ghost" size="sm" disabled>
                Metadata
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Milestone
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreateTaskDialog()}
                disabled={milestones.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
              <Button variant="outline" size="sm" onClick={handleValidate}>
                Validate
              </Button>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Sort</TableHead>
                  <TableHead className="w-16">Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Anchor Type</TableHead>
                  <TableHead>Anchor Ref</TableHead>
                  <TableHead>Offset Days</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  let rowIndex = 0;
                  return (
                    <>
                      {milestones.map((milestone) => (
                        <Fragment key={milestone.id}>
                          {(() => {
                            rowIndex += 1;
                            return (
                              <TableRow key={milestone.id}>
                                <TableCell className="text-muted-foreground">{rowIndex}</TableCell>
                                <TableCell>
                                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                    M
                                  </span>
                                </TableCell>
                                <TableCell className="font-medium">{milestone.name}</TableCell>
                                <TableCell>{formatAnchorType(milestone.anchorType)}</TableCell>
                                <TableCell>{getAnchorRefLabel(milestone)}</TableCell>
                                <TableCell>{getOffsetLabel(milestone)}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {getNotes(milestone)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openCreateTaskDialog(milestone.id)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Task
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(milestone)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openDeleteDialog(milestone)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })()}
                          {(tasksByMilestone.get(milestone.id) || []).map((task) => {
                            rowIndex += 1;
                            return (
                              <TableRow key={task.id}>
                                <TableCell className="text-muted-foreground">{rowIndex}</TableCell>
                                <TableCell>
                                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                    T
                                  </span>
                                </TableCell>
                                <TableCell className="pl-8 font-medium">{task.name}</TableCell>
                                <TableCell>{formatAnchorType(task.anchorType)}</TableCell>
                                <TableCell>{getAnchorRefLabel(task)}</TableCell>
                                <TableCell>{getOffsetLabel(task)}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {getNotes(task)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(task)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openDeleteDialog(task)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      ))}
                      {ungroupedTasks.length > 0 && (
                        <>
                          <TableRow>
                            <TableCell colSpan={8} className="text-xs uppercase text-muted-foreground">
                              Ungrouped Tasks
                            </TableCell>
                          </TableRow>
                          {ungroupedTasks.map((task) => {
                            rowIndex += 1;
                            return (
                              <TableRow key={task.id}>
                                <TableCell className="text-muted-foreground">{rowIndex}</TableCell>
                                <TableCell>
                                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                    T
                                  </span>
                                </TableCell>
                                <TableCell className="font-medium">{task.name}</TableCell>
                                <TableCell>{formatAnchorType(task.anchorType)}</TableCell>
                                <TableCell>{getAnchorRefLabel(task)}</TableCell>
                                <TableCell>{getOffsetLabel(task)}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {getNotes(task)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(task)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openDeleteDialog(task)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </>
                      )}
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Schedule Item' : 'Create Schedule Item'}
            </DialogTitle>
            <DialogDescription>
              Define milestone/task templates and their anchor rules.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="kind">Type *</Label>
                <select
                  id="kind"
                  className="h-10 rounded-md border bg-transparent px-3 text-sm"
                  value={formData.kind}
                  onChange={(e) => {
                    const nextKind = e.target.value as 'MILESTONE' | 'TASK';
                    setFormData((prev) => ({
                      ...prev,
                      kind: nextKind,
                      anchorType: nextKind === 'TASK' ? 'SCHEDULE_ITEM' : prev.anchorType,
                      anchorRefId: nextKind === 'TASK' ? prev.anchorRefId : undefined,
                    }));
                  }}
                  required
                >
                  <option value="MILESTONE">Milestone</option>
                  <option value="TASK">Task</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              {formData.kind === 'MILESTONE' && (
                <div className="grid gap-2">
                  <Label htmlFor="anchorType">Anchor Type *</Label>
                  <select
                    id="anchorType"
                    className="h-10 rounded-md border bg-transparent px-3 text-sm"
                    value={formData.anchorType}
                    onChange={(e) =>
                      setFormData({ ...formData, anchorType: e.target.value as AnchorType })
                    }
                    required
                  >
                    {anchorTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(formData.kind === 'TASK' || formData.anchorType === 'SCHEDULE_ITEM') && (
                <div className="grid gap-2">
                  <Label htmlFor="anchorRefId">
                    {formData.kind === 'TASK' ? 'Milestone *' : 'Anchor Schedule Item *'}
                  </Label>
                  <select
                    id="anchorRefId"
                    className="h-10 rounded-md border bg-transparent px-3 text-sm"
                    value={formData.anchorRefId || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, anchorRefId: Number(e.target.value) })
                    }
                    required
                  >
                    <option value="" disabled>
                      Select item
                    </option>
                    {(formData.kind === 'TASK' ? milestones : items).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {formData.kind === 'TASK' && milestones.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Create a milestone before adding tasks.
                    </p>
                  )}
                </div>
              )}
              {formData.anchorType === 'PROJECT_MILESTONE' && formData.kind !== 'TASK' && (
                <div className="grid gap-2">
                  <Label htmlFor="projectMilestoneName">Project Milestone Name *</Label>
                  <Input
                    id="projectMilestoneName"
                    value={formData.projectMilestoneName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, projectMilestoneName: e.target.value })
                    }
                    placeholder="e.g., PA2, PA3, NMR3"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will be matched to a project milestone when the template is applied.
                  </p>
                </div>
              )}
              {(formData.kind === 'TASK' || formData.anchorType !== 'FIXED_DATE') && (
                <div className="grid gap-2">
                  <Label htmlFor="offsetDays">Offset Days</Label>
                  <Input
                    id="offsetDays"
                    type="number"
                    value={formData.offsetDays ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        offsetDays: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formData.kind === 'TASK' && !formData.anchorRefId}>
                {editingItem ? 'Save Changes' : 'Create Schedule Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingItem?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
