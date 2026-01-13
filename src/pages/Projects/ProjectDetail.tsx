import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, Calendar, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AddActivityDialog from './AddActivityDialog';
import ScheduleItemDialog from './ScheduleItemDialog';
import type { ProjectDetail, ProjectActivityDetail, ScheduleItemWithDates } from '../../../shared/types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [addActivityDialogOpen, setAddActivityDialogOpen] = useState(false);
  const [addScheduleItemDialogOpen, setAddScheduleItemDialogOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      loadProjectDetail();
    }
  }, [id]);

  async function loadProjectDetail() {
    if (!id) return;

    setLoading(true);
    setError(null);
    const response = await window.sqts.projects.getDetail(Number(id));

    if (response.success && response.data) {
      setProjectDetail(response.data);
      // Expand all activities by default
      const activityIds = new Set(response.data.activities.map(a => a.id));
      setExpandedActivities(activityIds);
    } else {
      setError(response.error || 'Failed to load project');
    }
    setLoading(false);
  }

  function toggleActivity(activityId: number) {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  }

  function handleAddScheduleItem(activityId: number) {
    setSelectedActivityId(activityId);
    setAddScheduleItemDialogOpen(true);
  }

  async function handleDeleteActivity(activityId: number) {
    if (!confirm('Are you sure you want to delete this activity and all its schedule items?')) {
      return;
    }

    const response = await window.sqts.projectActivities.delete(activityId);
    if (response.success) {
      loadProjectDetail();
    } else {
      alert(response.error || 'Failed to delete activity');
    }
  }

  async function handleDeleteScheduleItem(scheduleItemId: number) {
    if (!confirm('Are you sure you want to delete this schedule item?')) {
      return;
    }

    const response = await window.sqts.scheduleItems.delete(scheduleItemId);
    if (response.success) {
      loadProjectDetail();
    } else {
      alert(response.error || 'Failed to delete schedule item');
    }
  }

  function getAnchorDescription(item: ScheduleItemWithDates): string {
    if (item.anchorType === 'FIXED_DATE') {
      return `Fixed: ${item.fixedDate}`;
    } else if (item.anchorType === 'SCHEDULE_ITEM' && item.anchorRefId) {
      const offset = item.offsetDays || 0;
      const sign = offset >= 0 ? '+' : '';
      return `Ref Item ${item.anchorRefId} ${sign}${offset} days`;
    } else if (item.anchorType === 'PROJECT_ANCHOR') {
      const offset = item.offsetDays || 0;
      return `Project anchor ${offset >= 0 ? '+' : ''}${offset} days`;
    }
    return item.anchorType;
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading project...</div>
      </div>
    );
  }

  if (error || !projectDetail) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">
          {error || 'Project not found'}
        </div>
        <div className="text-center mt-4">
          <Button onClick={() => navigate('/projects')}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {projectDetail.name} <span className="text-gray-500">v{projectDetail.version}</span>
            </h1>
            <p className="text-gray-600 mt-1">
              {projectDetail.activities.length} {projectDetail.activities.length === 1 ? 'activity' : 'activities'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/projects')} variant="outline">
              Back to Projects
            </Button>
            <Button onClick={() => setAddActivityDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="space-y-4">
        {projectDetail.activities.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">
                <p>No activities added yet.</p>
                <Button onClick={() => setAddActivityDialogOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Activity
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          projectDetail.activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              expanded={expandedActivities.has(activity.id)}
              onToggle={() => toggleActivity(activity.id)}
              onAddScheduleItem={() => handleAddScheduleItem(activity.id)}
              onDeleteActivity={() => handleDeleteActivity(activity.id)}
              onDeleteScheduleItem={handleDeleteScheduleItem}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AddActivityDialog
        open={addActivityDialogOpen}
        onOpenChange={setAddActivityDialogOpen}
        projectId={Number(id)}
        onSuccess={loadProjectDetail}
      />

      <ScheduleItemDialog
        open={addScheduleItemDialogOpen}
        onOpenChange={setAddScheduleItemDialogOpen}
        activityId={selectedActivityId}
        onSuccess={loadProjectDetail}
      />
    </div>
  );
}

interface ActivityCardProps {
  activity: ProjectActivityDetail;
  expanded: boolean;
  onToggle: () => void;
  onAddScheduleItem: () => void;
  onDeleteActivity: () => void;
  onDeleteScheduleItem: (id: number) => void;
}

function ActivityCard({
  activity,
  expanded,
  onToggle,
  onAddScheduleItem,
  onDeleteActivity,
  onDeleteScheduleItem,
}: ActivityCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <button onClick={onToggle} className="hover:bg-gray-100 p-1 rounded">
              {expanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
            <div>
              <CardTitle>{activity.activityTemplateName}</CardTitle>
              <CardDescription>
                {activity.scheduleItems.length} schedule {activity.scheduleItems.length === 1 ? 'item' : 'items'}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onAddScheduleItem} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
            <Button onClick={onDeleteActivity} size="sm" variant="outline">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {activity.scheduleItems.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              <p>No schedule items yet.</p>
              <Button onClick={onAddScheduleItem} size="sm" className="mt-2">
                <Plus className="h-4 w-4 mr-1" />
                Add First Item
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.scheduleItems.map((item) => (
                <ScheduleItemRow
                  key={item.id}
                  item={item}
                  onDelete={() => onDeleteScheduleItem(item.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface ScheduleItemRowProps {
  item: ScheduleItemWithDates;
  onDelete: () => void;
}

function ScheduleItemRow({ item, onDelete }: ScheduleItemRowProps) {
  const isMilestone = item.kind === 'MILESTONE';

  function getAnchorDescription(): string {
    if (item.anchorType === 'FIXED_DATE') {
      return `Fixed: ${item.fixedDate}`;
    } else if (item.anchorType === 'SCHEDULE_ITEM' && item.anchorRefId) {
      const offset = item.offsetDays || 0;
      const sign = offset >= 0 ? '+' : '';
      return `Item ${item.anchorRefId} ${sign}${offset}d`;
    } else if (item.anchorType === 'PROJECT_ANCHOR') {
      const offset = item.offsetDays || 0;
      return `Project ${offset >= 0 ? '+' : ''}${offset}d`;
    }
    return item.anchorType;
  }

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
      <div className="flex-shrink-0">
        {isMilestone ? (
          <Flag className="h-5 w-5 text-blue-600" />
        ) : (
          <Calendar className="h-5 w-5 text-green-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {isMilestone ? 'Milestone' : 'Task'}
          </span>
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {getAnchorDescription()}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {item.plannedDate ? (
          <div className="text-right">
            <div className="text-sm text-gray-500">Planned</div>
            <div className="font-medium">{item.plannedDate}</div>
          </div>
        ) : (
          <div className="text-right">
            <div className="text-sm text-red-500">No date</div>
            {item.error && (
              <div className="text-xs text-red-400">{item.error}</div>
            )}
          </div>
        )}

        <Button onClick={onDelete} size="sm" variant="ghost">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
