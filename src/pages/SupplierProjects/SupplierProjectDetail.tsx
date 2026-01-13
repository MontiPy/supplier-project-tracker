import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Calendar, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  SupplierProjectDetail,
  SupplierProjectActivityDetail,
  SupplierScheduleItemDetail,
} from '@shared/types';

export function SupplierProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SupplierProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (id) {
      loadDetail();
    }
  }, [id]);

  async function loadDetail() {
    setLoading(true);
    const response = await window.sqts.supplierProjects.getDetail(Number(id));
    if (response.success && response.data) {
      setDetail(response.data);
      setExpandedActivities(new Set(response.data.activities.map((activity) => activity.id)));
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading supplier project...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">Supplier project not found.</div>
        <div className="text-center mt-4">
          <Button onClick={() => navigate('/suppliers')}>Back to Suppliers</Button>
        </div>
      </div>
    );
  }

  function toggleActivity(activityId: number) {
    const next = new Set(expandedActivities);
    if (next.has(activityId)) {
      next.delete(activityId);
    } else {
      next.add(activityId);
    }
    setExpandedActivities(next);
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {detail.supplierName} - {detail.projectName}{' '}
              <span className="text-gray-500">v{detail.projectVersion}</span>
            </h1>
            <p className="text-gray-600 mt-1">
              Supplier Anchor: {detail.supplierAnchorDate || '-'} | Project Anchor:{' '}
              {detail.projectAnchorDate || '-'}
            </p>
          </div>
          <Button onClick={() => navigate(`/suppliers/${detail.supplierId}`)} variant="outline">
            Back to Supplier
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {detail.activities.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">No activities created.</div>
            </CardContent>
          </Card>
        ) : (
          detail.activities.map((activity) => (
            <SupplierActivityCard
              key={activity.id}
              activity={activity}
              expanded={expandedActivities.has(activity.id)}
              onToggle={() => toggleActivity(activity.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface SupplierActivityCardProps {
  activity: SupplierProjectActivityDetail;
  expanded: boolean;
  onToggle: () => void;
}

function SupplierActivityCard({ activity, expanded, onToggle }: SupplierActivityCardProps) {
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
              <CardDescription>{activity.status}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {activity.scheduleItems.length === 0 ? (
            <div className="text-center text-gray-500 py-4">No schedule items yet.</div>
          ) : (
            <div className="space-y-2">
              {activity.scheduleItems.map((item) => (
                <SupplierScheduleItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface SupplierScheduleItemRowProps {
  item: SupplierScheduleItemDetail;
}

function SupplierScheduleItemRow({ item }: SupplierScheduleItemRowProps) {
  const isMilestone = item.kind === 'MILESTONE';

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
          Status: {item.status}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-sm text-gray-500">Planned</div>
          <div className="font-medium">{item.plannedDate || '-'}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Actual</div>
          <div className="font-medium">{item.actualDate || '-'}</div>
        </div>
      </div>
    </div>
  );
}
