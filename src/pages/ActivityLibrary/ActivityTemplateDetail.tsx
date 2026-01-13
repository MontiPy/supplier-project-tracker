import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
  'PROJECT_ANCHOR',
  'SUPPLIER_ANCHOR',
  'SCHEDULE_ITEM',
  'COMPLETION',
];

export function ActivityTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  function openEditDialog(item: ActivityTemplateScheduleItem) {
    setEditingItem(item);
    setFormData({
      activityTemplateId: templateId,
      kind: item.kind,
      name: item.name,
      anchorType: item.anchorType,
      anchorRefId: item.anchorRefId || undefined,
      offsetDays: item.offsetDays ?? undefined,
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(item: ActivityTemplateScheduleItem) {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingItem) {
      const params: UpdateActivityTemplateScheduleItemParams = {
        id: editingItem.id,
        kind: formData.kind,
        name: formData.name,
        anchorType: formData.anchorType,
        anchorRefId: formData.anchorRefId || undefined,
        offsetDays: formData.offsetDays ?? undefined,
      };
      const response = await window.sqts.activityTemplates.scheduleItems.update(params);
      if (response.success) {
        await loadItems();
        setDialogOpen(false);
      }
    } else {
      const response = await window.sqts.activityTemplates.scheduleItems.create(formData);
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
            Add Schedule Item
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
            Add Schedule Item
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Anchor</TableHead>
                <TableHead>Offset Days</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.kind}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.anchorType === 'SCHEDULE_ITEM' && item.anchorRefId
                      ? `Schedule Item ${item.anchorRefId}`
                      : item.anchorType}
                  </TableCell>
                  <TableCell>{item.offsetDays ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                  onChange={(e) =>
                    setFormData({ ...formData, kind: e.target.value as 'MILESTONE' | 'TASK' })
                  }
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
              {formData.anchorType === 'SCHEDULE_ITEM' && (
                <div className="grid gap-2">
                  <Label htmlFor="anchorRefId">Anchor Schedule Item *</Label>
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
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {formData.anchorType !== 'FIXED_DATE' && (
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
              <Button type="submit">
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
