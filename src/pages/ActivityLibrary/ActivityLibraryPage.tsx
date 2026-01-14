import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Copy, Archive, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { CategoryBadge, TypeBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type {
  ActivityTemplateWithCounts,
  ActivityTemplate,
  ActivityTemplateScheduleItem,
  CreateActivityTemplateParams,
  UpdateActivityTemplateParams,
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

export function ActivityLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  // Template list state
  const [templates, setTemplates] = useState<ActivityTemplateWithCounts[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ActivityTemplateWithCounts | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<ActivityTemplateWithCounts | null>(null);
  const [templateFormData, setTemplateFormData] = useState<CreateActivityTemplateParams>({
    name: '',
    description: '',
    category: '',
  });

  // Detail state
  const [template, setTemplate] = useState<ActivityTemplate | null>(null);
  const [items, setItems] = useState<ActivityTemplateScheduleItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActivityTemplateScheduleItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ActivityTemplateScheduleItem | null>(null);
  const [itemFormData, setItemFormData] = useState<CreateActivityTemplateScheduleItemParams>({
    activityTemplateId: 0,
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
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadTemplateDetail(selectedId);
    } else {
      setTemplate(null);
      setItems([]);
    }
  }, [selectedId]);

  async function loadTemplates() {
    setLoadingList(true);
    const response = await window.sqts.activityTemplates.listWithCounts();
    if (response.success && response.data) {
      setTemplates(response.data);
    }
    setLoadingList(false);
  }

  async function loadTemplateDetail(id: number) {
    setLoadingDetail(true);
    const [templateRes, itemsRes] = await Promise.all([
      window.sqts.activityTemplates.get(id),
      window.sqts.activityTemplates.scheduleItems.list(id),
    ]);
    if (templateRes.success && templateRes.data) {
      setTemplate(templateRes.data);
    }
    if (itemsRes.success && itemsRes.data) {
      setItems(itemsRes.data);
    }
    setLoadingDetail(false);
  }

  function selectTemplate(id: number) {
    setSearchParams({ id: String(id) });
  }

  // Template CRUD
  function openCreateTemplateDialog() {
    setEditingTemplate(null);
    setTemplateFormData({ name: '', description: '', category: '' });
    setCreateDialogOpen(true);
  }

  function openEditTemplateDialog(t: ActivityTemplateWithCounts, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingTemplate(t);
    setTemplateFormData({
      name: t.name,
      description: t.description || '',
      category: t.category || '',
    });
    setCreateDialogOpen(true);
  }

  function openDeleteTemplateDialog(t: ActivityTemplateWithCounts, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingTemplate(t);
    setDeleteDialogOpen(true);
  }

  async function handleTemplateSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingTemplate) {
      const params: UpdateActivityTemplateParams = {
        id: editingTemplate.id,
        name: templateFormData.name,
        description: templateFormData.description || undefined,
        category: templateFormData.category || undefined,
      };
      const response = await window.sqts.activityTemplates.update(params);
      if (response.success) {
        await loadTemplates();
        if (selectedId === editingTemplate.id) {
          await loadTemplateDetail(editingTemplate.id);
        }
        setCreateDialogOpen(false);
      }
    } else {
      const response = await window.sqts.activityTemplates.create(templateFormData);
      if (response.success && response.data) {
        await loadTemplates();
        selectTemplate(response.data.id);
        setCreateDialogOpen(false);
      }
    }
  }

  async function handleTemplateDelete() {
    if (deletingTemplate) {
      const response = await window.sqts.activityTemplates.delete(deletingTemplate.id);
      if (response.success) {
        await loadTemplates();
        if (selectedId === deletingTemplate.id) {
          setSearchParams({});
        }
        setDeleteDialogOpen(false);
        setDeletingTemplate(null);
      }
    }
  }

  async function handleDuplicate() {
    if (!selectedId) return;
    const response = await window.sqts.activityTemplates.duplicate(selectedId);
    if (response.success && response.data) {
      await loadTemplates();
      selectTemplate(response.data.id);
    }
  }

  // Schedule Item CRUD
  function openCreateItemDialog() {
    if (!selectedId) return;
    setEditingItem(null);
    setItemFormData({
      activityTemplateId: selectedId,
      kind: 'MILESTONE',
      name: '',
      anchorType: 'FIXED_DATE',
      anchorRefId: undefined,
      offsetDays: undefined,
    });
    setItemDialogOpen(true);
  }

  function openCreateTaskDialog(milestoneId?: number) {
    if (!selectedId) return;
    const defaultMilestoneId = milestoneId ?? milestones[0]?.id;
    setEditingItem(null);
    setItemFormData({
      activityTemplateId: selectedId,
      kind: 'TASK',
      name: '',
      anchorType: 'SCHEDULE_ITEM',
      anchorRefId: defaultMilestoneId,
      offsetDays: 0,
    });
    setItemDialogOpen(true);
  }

  function openEditItemDialog(item: ActivityTemplateScheduleItem) {
    if (!selectedId) return;
    setEditingItem(item);
    const anchorType = item.kind === 'TASK' ? 'SCHEDULE_ITEM' : item.anchorType;
    setItemFormData({
      activityTemplateId: selectedId,
      kind: item.kind,
      name: item.name,
      anchorType,
      anchorRefId: item.anchorRefId || undefined,
      offsetDays: item.offsetDays ?? undefined,
    });
    setItemDialogOpen(true);
  }

  function openDeleteItemDialog(item: ActivityTemplateScheduleItem) {
    setDeletingItem(item);
    setDeleteItemDialogOpen(true);
  }

  async function handleItemSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;

    const anchorType = itemFormData.kind === 'TASK' ? 'SCHEDULE_ITEM' : itemFormData.anchorType;
    const anchorRefId =
      itemFormData.kind === 'TASK' ? itemFormData.anchorRefId || undefined : itemFormData.anchorRefId;

    if (editingItem) {
      const params: UpdateActivityTemplateScheduleItemParams = {
        id: editingItem.id,
        kind: itemFormData.kind,
        name: itemFormData.name,
        anchorType,
        anchorRefId,
        offsetDays: itemFormData.offsetDays ?? undefined,
      };
      const response = await window.sqts.activityTemplates.scheduleItems.update(params);
      if (response.success) {
        await loadTemplateDetail(selectedId);
        await loadTemplates();
        setItemDialogOpen(false);
      }
    } else {
      const response = await window.sqts.activityTemplates.scheduleItems.create({
        ...itemFormData,
        anchorType,
        anchorRefId,
      });
      if (response.success) {
        await loadTemplateDetail(selectedId);
        await loadTemplates();
        setItemDialogOpen(false);
      }
    }
  }

  async function handleItemDelete() {
    if (deletingItem && selectedId) {
      const response = await window.sqts.activityTemplates.scheduleItems.delete(deletingItem.id);
      if (response.success) {
        await loadTemplateDetail(selectedId);
        await loadTemplates();
        setDeleteItemDialogOpen(false);
        setDeletingItem(null);
      }
    }
  }

  function formatAnchorType(anchorType: AnchorType) {
    return anchorType.replace('_', ' ');
  }

  function getAnchorRefLabel(item: ActivityTemplateScheduleItem) {
    if (item.anchorType !== 'SCHEDULE_ITEM' || !item.anchorRefId) {
      return '-';
    }
    return itemById.get(item.anchorRefId)?.name || `Schedule Item ${item.anchorRefId}`;
  }

  function getOffsetLabel(item: ActivityTemplateScheduleItem) {
    if (item.offsetDays == null) {
      return '-';
    }
    const isNegative = item.offsetDays < 0;
    return (
      <span className={isNegative ? 'text-orange-600 font-medium' : ''}>
        {item.offsetDays}
      </span>
    );
  }

  function getNotes(item: ActivityTemplateScheduleItem) {
    if (item.kind === 'MILESTONE') {
      return item.anchorType === 'PROJECT_ANCHOR'
        ? 'Set at project level'
        : 'Set at activity level';
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

  return (
    <div className="flex h-full">
      {/* Left Panel - Template List */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-semibold mb-1">Activity Library</h1>
          <p className="text-sm text-muted-foreground mb-4">Manage activity templates</p>
          <Button className="w-full" onClick={openCreateTemplateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Activity Template
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No templates yet. Create one to get started.
            </div>
          ) : (
            <div className="divide-y">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    'p-4 cursor-pointer hover:bg-muted/50 transition-colors',
                    selectedId === t.id && 'bg-muted'
                  )}
                  onClick={() => selectTemplate(t.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {t.milestoneCount} milestones, {t.taskCount} tasks
                      </div>
                      {t.category && (
                        <div className="mt-1">
                          <CategoryBadge category={t.category} />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => openEditTemplateDialog(t, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => openDeleteTemplateDialog(t, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Detail */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg">Select a template</p>
              <p className="text-sm">Choose a template from the list to view and edit its schedule items</p>
            </div>
          </div>
        ) : loadingDetail ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading...
          </div>
        ) : !template ? (
          <div className="flex items-center justify-center h-full text-red-600">
            Template not found
          </div>
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold">{template.name}</h2>
                  {template.category && <CategoryBadge category={template.category} />}
                </div>
                <p className="text-muted-foreground">{template.description || 'No description'}</p>
                {template.updatedAt && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Last updated: {new Date(template.updatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </Button>
                <Button variant="outline" size="sm" disabled>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
                <Button size="sm">
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 mb-6">
              <Info className="h-4 w-4 flex-shrink-0" />
              <div>
                This template defines structure and offset rules. Milestones anchored to project
                dates are set at the project level, and tasks inherit dates from milestones.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={openCreateItemDialog}>
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
            </div>

            {/* Schedule Items Table */}
            {items.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <p className="text-lg font-medium">No schedule items yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add milestones and tasks for this activity template.
                    </p>
                    <Button onClick={openCreateItemDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Milestone
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
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
                                  <TableRow>
                                    <TableCell className="text-muted-foreground">{rowIndex}</TableCell>
                                    <TableCell>
                                      <TypeBadge kind="MILESTONE" />
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
                                        <Plus className="mr-1 h-3 w-3" />
                                        Task
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openEditItemDialog(milestone)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openDeleteItemDialog(milestone)}
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
                                      <TypeBadge kind="TASK" />
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
                                        onClick={() => openEditItemDialog(task)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openDeleteItemDialog(task)}
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
                                <TableCell colSpan={8} className="text-xs uppercase text-muted-foreground bg-muted/50">
                                  Ungrouped Tasks
                                </TableCell>
                              </TableRow>
                              {ungroupedTasks.map((task) => {
                                rowIndex += 1;
                                return (
                                  <TableRow key={task.id}>
                                    <TableCell className="text-muted-foreground">{rowIndex}</TableCell>
                                    <TableCell>
                                      <TypeBadge kind="TASK" />
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
                                        onClick={() => openEditItemDialog(task)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openDeleteItemDialog(task)}
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
            )}
          </div>
        )}
      </div>

      {/* Template Create/Edit Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Activity Template' : 'Create Activity Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update activity template information'
                : 'Add a new activity template to your library'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTemplateSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={templateFormData.description}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={templateFormData.category}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, category: e.target.value })}
                  placeholder="e.g., NMR, PPAP, Quality"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Activity Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleTemplateDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Item Create/Edit Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Schedule Item' : 'Create Schedule Item'}
            </DialogTitle>
            <DialogDescription>
              Define milestone/task templates and their anchor rules.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleItemSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="kind">Type *</Label>
                <select
                  id="kind"
                  className="h-10 rounded-md border bg-transparent px-3 text-sm"
                  value={itemFormData.kind}
                  onChange={(e) => {
                    const nextKind = e.target.value as 'MILESTONE' | 'TASK';
                    setItemFormData((prev) => ({
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
                <Label htmlFor="itemName">Name *</Label>
                <Input
                  id="itemName"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  required
                />
              </div>
              {itemFormData.kind === 'MILESTONE' && (
                <div className="grid gap-2">
                  <Label htmlFor="anchorType">Anchor Type *</Label>
                  <select
                    id="anchorType"
                    className="h-10 rounded-md border bg-transparent px-3 text-sm"
                    value={itemFormData.anchorType}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, anchorType: e.target.value as AnchorType })
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
              {(itemFormData.kind === 'TASK' || itemFormData.anchorType === 'SCHEDULE_ITEM') && (
                <div className="grid gap-2">
                  <Label htmlFor="anchorRefId">
                    {itemFormData.kind === 'TASK' ? 'Milestone *' : 'Anchor Schedule Item *'}
                  </Label>
                  <select
                    id="anchorRefId"
                    className="h-10 rounded-md border bg-transparent px-3 text-sm"
                    value={itemFormData.anchorRefId || ''}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, anchorRefId: Number(e.target.value) })
                    }
                    required
                  >
                    <option value="" disabled>
                      Select item
                    </option>
                    {(itemFormData.kind === 'TASK' ? milestones : items).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {itemFormData.kind === 'TASK' && milestones.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Create a milestone before adding tasks.
                    </p>
                  )}
                </div>
              )}
              {(itemFormData.kind === 'TASK' || itemFormData.anchorType !== 'FIXED_DATE') && (
                <div className="grid gap-2">
                  <Label htmlFor="offsetDays">Offset Days</Label>
                  <Input
                    id="offsetDays"
                    type="number"
                    value={itemFormData.offsetDays ?? ''}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        offsetDays: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Use negative numbers for days before the anchor (e.g., -14 means 14 days before)
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={itemFormData.kind === 'TASK' && !itemFormData.anchorRefId}>
                {editingItem ? 'Save Changes' : 'Create Schedule Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Item Delete Dialog */}
      <Dialog open={deleteItemDialogOpen} onOpenChange={setDeleteItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingItem?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleItemDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
