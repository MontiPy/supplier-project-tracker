import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Copy, Archive, Save, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
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
  ActivityTemplateApplicabilityRule,
  ActivityTemplateApplicabilityClause,
  CreateActivityTemplateParams,
  UpdateActivityTemplateParams,
  CreateActivityTemplateScheduleItemParams,
  UpdateActivityTemplateScheduleItemParams,
  AnchorType,
  ApplicabilityOperator,
  ApplicabilitySubject,
  ApplicabilityComparator,
} from '@shared/types';

const anchorTypes: AnchorType[] = [
  'FIXED_DATE',
  'PROJECT_ANCHOR',
  'SUPPLIER_ANCHOR',
  'SCHEDULE_ITEM',
  'COMPLETION',
];

const applicabilitySubjects: { value: ApplicabilitySubject; label: string }[] = [
  { value: 'SUPPLIER_NMR', label: 'Project NMR Rank' },
  { value: 'PART_PA', label: 'Part PA Rank' },
];

const applicabilityComparators: { value: ApplicabilityComparator; label: string }[] = [
  { value: 'IN', label: 'In list' },
  { value: 'NOT_IN', label: 'Not in list' },
  { value: 'EQ', label: 'Equals' },
  { value: 'NEQ', label: 'Not equals' },
  { value: 'GTE', label: 'At least' },
  { value: 'LTE', label: 'At most' },
];

function validateScheduleItems(items: ActivityTemplateScheduleItem[]): string[] {
  const errors: string[] = [];
  const graph = new Map<number, number | null>();

  for (const item of items) {
    if (item.anchorType === 'SCHEDULE_ITEM') {
      if (!item.anchorRefId) {
        errors.push(`Schedule item "${item.name}" is missing an anchor reference`);
      }
      if (item.anchorRefId === item.id) {
        errors.push(`Schedule item "${item.name}" references itself`);
      }
      graph.set(item.id, item.anchorRefId || null);
    } else {
      graph.set(item.id, null);
    }
  }

  for (const startItem of items) {
    if (startItem.anchorType !== 'SCHEDULE_ITEM') {
      continue;
    }
    const visited = new Set<number>();
    let current: number | null = startItem.id;

    while (current !== null) {
      if (visited.has(current)) {
        errors.push(`Circular dependency detected starting at "${startItem.name}"`);
        break;
      }
      visited.add(current);
      current = graph.get(current) ?? null;
    }
  }

  return errors;
}

export function ActivityLibraryPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  // Template list state
  const [templates, setTemplates] = useState<ActivityTemplateWithCounts[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [templateSearch, setTemplateSearch] = useState('');
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
  const [applicabilityRule, setApplicabilityRule] =
    useState<ActivityTemplateApplicabilityRule | null>(null);
  const [applicabilityClauses, setApplicabilityClauses] = useState<
    ActivityTemplateApplicabilityClause[]
  >([]);
  const [loadingApplicability, setLoadingApplicability] = useState(false);
  const [newClause, setNewClause] = useState<{
    subjectType: ApplicabilitySubject;
    comparator: ApplicabilityComparator;
    value: string;
  }>({
    subjectType: 'SUPPLIER_NMR',
    comparator: 'IN',
    value: '',
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

  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const filteredTemplates = templates.filter((template) => {
    if (!normalizedTemplateSearch) {
      return true;
    }
    return (
      template.name.toLowerCase().includes(normalizedTemplateSearch) ||
      (template.category || '').toLowerCase().includes(normalizedTemplateSearch)
    );
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadTemplateDetail(selectedId);
    } else {
      setTemplate(null);
      setItems([]);
      setApplicabilityRule(null);
      setApplicabilityClauses([]);
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
    const [templateRes, itemsRes, applicabilityRes] = await Promise.all([
      window.sqts.activityTemplates.get(id),
      window.sqts.activityTemplates.scheduleItems.list(id),
      window.sqts.activityTemplates.applicability.get(id),
    ]);
    if (templateRes.success && templateRes.data) {
      setTemplate(templateRes.data);
    }
    if (itemsRes.success && itemsRes.data) {
      setItems(itemsRes.data);
    }
    if (applicabilityRes.success && applicabilityRes.data) {
      setApplicabilityRule(applicabilityRes.data.rule);
      setApplicabilityClauses(applicabilityRes.data.clauses);
    } else {
      setApplicabilityRule(null);
      setApplicabilityClauses([]);
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

  function handleValidate() {
    const errors = validateScheduleItems(items);
    if (errors.length > 0) {
      toast({ title: 'Validation Failed', description: errors.join('; '), variant: 'destructive' });
      return;
    }
    toast({ title: 'Success', description: 'Validation passed. No issues found.', variant: 'success' });
  }

  async function ensureApplicabilityRule(): Promise<ActivityTemplateApplicabilityRule | null> {
    if (!template) {
      return null;
    }
    if (applicabilityRule) {
      return applicabilityRule;
    }
    setLoadingApplicability(true);
    const response = await window.sqts.activityTemplates.applicability.upsertRule({
      activityTemplateId: template.id,
      operator: 'ALL',
      enabled: true,
    });
    setLoadingApplicability(false);
    if (response.success && response.data) {
      setApplicabilityRule(response.data);
      return response.data;
    }
    toast({ title: 'Error', description: response.error || 'Failed to create applicability rule', variant: 'destructive' });
    return null;
  }

  async function handleApplicabilityRuleChange(next: {
    operator?: ApplicabilityOperator;
    enabled?: boolean;
  }) {
    if (!template) {
      return;
    }
    setLoadingApplicability(true);
    const response = await window.sqts.activityTemplates.applicability.upsertRule({
      activityTemplateId: template.id,
      operator: next.operator ?? applicabilityRule?.operator ?? 'ALL',
      enabled: next.enabled ?? applicabilityRule?.enabled ?? true,
    });
    setLoadingApplicability(false);
    if (response.success && response.data) {
      setApplicabilityRule(response.data);
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update applicability rule', variant: 'destructive' });
    }
  }

  async function handleAddClause(e: React.FormEvent) {
    e.preventDefault();
    const rule = await ensureApplicabilityRule();
    if (!rule) {
      return;
    }
    const trimmedValue = newClause.value.trim();
    if (trimmedValue === '') {
      toast({ title: 'Error', description: 'Clause value is required', variant: 'destructive' });
      return;
    }
    setLoadingApplicability(true);
    const response = await window.sqts.activityTemplates.applicability.createClause({
      ruleId: rule.id,
      subjectType: newClause.subjectType,
      comparator: newClause.comparator,
      value: trimmedValue,
    });
    setLoadingApplicability(false);
    if (!response.success) {
      toast({ title: 'Error', description: response.error || 'Failed to add clause', variant: 'destructive' });
      return;
    }
    if (!response.data) {
      toast({ title: 'Error', description: 'Failed to add clause', variant: 'destructive' });
      return;
    }
    const createdClause = response.data as ActivityTemplateApplicabilityClause;
    setApplicabilityClauses((prev) => [...prev, createdClause]);
    setNewClause({ ...newClause, value: '' });
  }

  async function handleUpdateClause(
    clauseId: number,
    next: Partial<ActivityTemplateApplicabilityClause>
  ) {
    setLoadingApplicability(true);
    const response = await window.sqts.activityTemplates.applicability.updateClause({
      id: clauseId,
      subjectType: next.subjectType,
      comparator: next.comparator,
      value: next.value,
    });
    setLoadingApplicability(false);
    if (response.success && response.data) {
      const updatedClause = response.data;
      setApplicabilityClauses((prev) =>
        prev.map((clause) => (clause.id === clauseId ? updatedClause : clause))
      );
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to update clause', variant: 'destructive' });
    }
  }

  async function handleDeleteClause(clauseId: number) {
    setLoadingApplicability(true);
    const response = await window.sqts.activityTemplates.applicability.deleteClause(clauseId);
    setLoadingApplicability(false);
    if (response.success) {
      setApplicabilityClauses((prev) => prev.filter((clause) => clause.id !== clauseId));
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to delete clause', variant: 'destructive' });
    }
  }

  async function handleResetApplicabilityRule() {
    if (!applicabilityRule) {
      return;
    }
    if (!confirm('Remove all applicability rules for this template?')) {
      return;
    }
    setLoadingApplicability(true);
    const response = await window.sqts.activityTemplates.applicability.deleteRule(
      applicabilityRule.id
    );
    setLoadingApplicability(false);
    if (response.success) {
      setApplicabilityRule(null);
      setApplicabilityClauses([]);
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to delete applicability rule', variant: 'destructive' });
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
          <Input
            className="mt-4"
            placeholder="Search templates..."
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
          />
          <div className="mt-2 text-xs text-muted-foreground">
            {filteredTemplates.length} of {templates.length}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No templates yet. Create one to get started.
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No templates match your search.
            </div>
          ) : (
            <div className="divide-y">
              {filteredTemplates.map((t) => (
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

            <Tabs defaultValue="schedule">
              <TabsList className="mb-6">
                <TabsTrigger value="schedule">Schedule Templates</TabsTrigger>
                <TabsTrigger value="applicability">Applicability Rules</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>

              <TabsContent value="schedule">
                {/* Info Banner - Where Logic Lives */}
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 mb-6">
                  <Info className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-600" />
                  <div className="text-sm">
                    <span className="font-medium">Where logic lives:</span>{' '}
                    Templates define schedule structure and offset rules.
                    Milestones with <code className="bg-blue-100 px-1 rounded">PROJECT_ANCHOR</code> have dates set at the project level.
                    Tasks derive their dates from milestone anchors using offset days.
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
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
                  <Button variant="outline" size="sm" onClick={handleValidate}>
                    Validate
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
              </TabsContent>

              <TabsContent value="applicability">
                <Card>
                  <CardContent className="py-6 space-y-6">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-lg font-medium">Applicability Rules</p>
                        <p className="text-sm text-muted-foreground">
                          Rules control when this template is required based on project NMR or part PA ranks.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetApplicabilityRule}
                        disabled={!applicabilityRule || loadingApplicability}
                      >
                        Clear Rules
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="applicability-enabled">Enabled</Label>
                        <Switch
                          id="applicability-enabled"
                          checked={applicabilityRule?.enabled ?? false}
                          onCheckedChange={(checked: boolean) =>
                            handleApplicabilityRuleChange({ enabled: checked })
                          }
                          disabled={loadingApplicability}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="applicability-operator">Match</Label>
                        <select
                          id="applicability-operator"
                          className="h-10 rounded-md border bg-transparent px-3 text-sm"
                          value={(applicabilityRule?.operator ?? 'ALL') as ApplicabilityOperator}
                          onChange={(e) =>
                            handleApplicabilityRuleChange({
                              operator: e.target.value as ApplicabilityOperator,
                            })
                          }
                          disabled={loadingApplicability}
                        >
                          <option value="ALL">All clauses</option>
                          <option value="ANY">Any clause</option>
                        </select>
                      </div>
                    </div>

                    {applicabilityClauses.length === 0 ? (
                      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        No clauses yet. Add a clause below to start filtering.
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subject</TableHead>
                              <TableHead>Comparator</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {applicabilityClauses.map((clause) => (
                              <TableRow key={clause.id}>
                                <TableCell>
                                  <select
                                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                                    value={clause.subjectType}
                                    onChange={(e) => {
                                      const nextValue = e.target.value as ApplicabilitySubject;
                                      setApplicabilityClauses((prev) =>
                                        prev.map((item) =>
                                          item.id === clause.id
                                            ? { ...item, subjectType: nextValue }
                                            : item
                                        )
                                      );
                                      handleUpdateClause(clause.id, { subjectType: nextValue });
                                    }}
                                    disabled={loadingApplicability}
                                  >
                                    {applicabilitySubjects.map((subject) => (
                                      <option key={subject.value} value={subject.value}>
                                        {subject.label}
                                      </option>
                                    ))}
                                  </select>
                                </TableCell>
                                <TableCell>
                                  <select
                                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                                    value={clause.comparator}
                                    onChange={(e) => {
                                      const nextValue = e.target.value as ApplicabilityComparator;
                                      setApplicabilityClauses((prev) =>
                                        prev.map((item) =>
                                          item.id === clause.id
                                            ? { ...item, comparator: nextValue }
                                            : item
                                        )
                                      );
                                      handleUpdateClause(clause.id, { comparator: nextValue });
                                    }}
                                    disabled={loadingApplicability}
                                  >
                                    {applicabilityComparators.map((comparator) => (
                                      <option key={comparator.value} value={comparator.value}>
                                        {comparator.label}
                                      </option>
                                    ))}
                                  </select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={clause.value}
                                    onChange={(e) => {
                                      const nextValue = e.target.value;
                                      setApplicabilityClauses((prev) =>
                                        prev.map((item) =>
                                          item.id === clause.id
                                            ? { ...item, value: nextValue }
                                            : item
                                        )
                                      );
                                    }}
                                    onBlur={(e) =>
                                      handleUpdateClause(clause.id, { value: e.target.value })
                                    }
                                    placeholder='A1, B2 or ["A1","B2"]'
                                    disabled={loadingApplicability}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteClause(clause.id)}
                                    disabled={loadingApplicability}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <form onSubmit={handleAddClause} className="grid gap-4 md:grid-cols-4">
                      <div className="grid gap-2 md:col-span-1">
                        <Label htmlFor="newClauseSubject">Subject</Label>
                        <select
                          id="newClauseSubject"
                          className="h-10 rounded-md border bg-transparent px-3 text-sm"
                          value={newClause.subjectType}
                          onChange={(e) =>
                            setNewClause({
                              ...newClause,
                              subjectType: e.target.value as ApplicabilitySubject,
                            })
                          }
                          disabled={loadingApplicability}
                        >
                          {applicabilitySubjects.map((subject) => (
                            <option key={subject.value} value={subject.value}>
                              {subject.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2 md:col-span-1">
                        <Label htmlFor="newClauseComparator">Comparator</Label>
                        <select
                          id="newClauseComparator"
                          className="h-10 rounded-md border bg-transparent px-3 text-sm"
                          value={newClause.comparator}
                          onChange={(e) =>
                            setNewClause({
                              ...newClause,
                              comparator: e.target.value as ApplicabilityComparator,
                            })
                          }
                          disabled={loadingApplicability}
                        >
                          {applicabilityComparators.map((comparator) => (
                            <option key={comparator.value} value={comparator.value}>
                              {comparator.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="newClauseValue">Value</Label>
                        <Input
                          id="newClauseValue"
                          value={newClause.value}
                          onChange={(e) => setNewClause({ ...newClause, value: e.target.value })}
                          placeholder="Comma-separated or JSON array"
                          disabled={loadingApplicability}
                        />
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <Button type="submit" disabled={loadingApplicability}>
                          Add Clause
                        </Button>
                      </div>
                    </form>
                    <div className="text-xs text-muted-foreground">
                      Use comma-separated values or a JSON array for multi-value matches.
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metadata">
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <p className="text-lg font-medium mb-2">Metadata</p>
                      <p>Track ownership, tags, and lifecycle metadata for this template.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
