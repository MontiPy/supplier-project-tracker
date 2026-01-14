import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { VersionBadge, RankBadge, StatusBadge, TypeBadge } from '@/components/ui/status-badge';
import type {
  SupplierProjectDetail,
  SupplierProjectActivityDetail,
  SupplierScheduleItemDetail,
  SupplierProject,
} from '@shared/types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SupplierProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SupplierProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [allSupplierProjects, setAllSupplierProjects] = useState<SupplierProject[]>([]);

  useEffect(() => {
    if (id) {
      loadDetail();
      loadAllSupplierProjects();
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

  async function loadAllSupplierProjects() {
    const response = await window.sqts.supplierProjects.list();
    if (response.success && response.data) {
      setAllSupplierProjects(response.data);
    }
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

  // Filter to only show supplier projects for the same project
  const sameProjectSuppliers = allSupplierProjects.filter(
    (sp) => sp.projectId === detail.projectId
  );

  const summary = useMemo(() => {
    const items = detail.activities.flatMap((activity) => activity.scheduleItems);
    const total = items.length;
    const complete = items.filter((item) => item.status === 'Complete').length;
    const today = new Date();
    const overdue = items.filter((item) => {
      if (!item.plannedDate || item.status === 'Complete') {
        return false;
      }
      const planned = new Date(`${item.plannedDate}T00:00:00`);
      return planned < today;
    }).length;
    const nextDueItem = items
      .filter((item) => item.plannedDate && item.status !== 'Complete')
      .sort((a, b) => (a.plannedDate || '').localeCompare(b.plannedDate || ''))[0];
    const progressPercent = total === 0 ? 0 : Math.round((complete / total) * 100);
    return {
      total,
      complete,
      overdue,
      nextDue: nextDueItem?.plannedDate || null,
      progressPercent,
      statusLabel: overdue > 0 ? 'At Risk' : progressPercent === 100 ? 'Complete' : 'On Track',
    };
  }, [detail.activities]);

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: 'Suppliers', href: '/suppliers' },
          { label: detail.supplierName, href: `/suppliers/${detail.supplierId}` },
          { label: detail.projectName },
        ]}
      />

      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">{detail.projectName}</h1>
              <VersionBadge version={detail.projectVersion} />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <RankBadge rank={detail.nmrRank || null} />
              {detail.nmrRank && <span>|</span>}
              <span>Supplier: {detail.supplierName}</span>
              {detail.activities[0]?.activityTemplateName && (
                <>
                  <span>|</span>
                  <span>Activity: {detail.activities[0].activityTemplateName}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {sameProjectSuppliers.length > 1 && (
              <Select
                value={String(detail.id)}
                onValueChange={(value: string) => navigate(`/supplier-projects/${value}`)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sameProjectSuppliers.map((sp) => (
                    <SelectItem key={sp.id} value={String(sp.id)}>
                      {sp.supplierName || `Supplier ${sp.supplierId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Inline Summary Row */}
      <div className="mb-6 flex flex-wrap items-center gap-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Progress</div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded bg-gray-200">
              <div
                className="h-2 rounded bg-green-600"
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium">{summary.progressPercent}%</span>
          </div>
          <span className="text-sm text-muted-foreground">
            ({summary.complete} of {summary.total})
          </span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Overdue:</span>
          <span className={`text-sm font-medium ${summary.overdue > 0 ? 'text-red-600' : ''}`}>
            {summary.overdue}
          </span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Next Due:</span>
          <span className="text-sm font-medium">{formatDate(summary.nextDue)}</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <StatusBadge status={summary.statusLabel} size="sm" />
      </div>

      <div className="space-y-4">
        {detail.activities.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">No activities created.</div>
            </CardContent>
          </Card>
        ) : (
          detail.activities.map((activity) => (
            <SupplierActivityCard
              key={activity.id}
              activity={activity}
              expanded={expandedActivities.has(activity.id)}
              onToggle={() => toggleActivity(activity.id)}
              onUpdate={loadDetail}
            />
          ))
        )}
      </div>

      {/* Help Footer */}
      <div className="mt-8 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium mb-1">What can I edit vs what is inherited?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Inherited from Project:</strong> Planned dates are calculated from the project schedule and propagate automatically.</li>
              <li><strong>Editable:</strong> Actual dates, status, and notes are tracked at the supplier level.</li>
              <li><strong>Lock:</strong> Prevents all changes and protects against propagation updates.</li>
              <li><strong>Override:</strong> Marks the planned date as manually set, preventing propagation updates to this date.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SupplierActivityCardProps {
  activity: SupplierProjectActivityDetail;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: () => void;
}

function SupplierActivityCard({ activity, expanded, onToggle, onUpdate }: SupplierActivityCardProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'incomplete' | 'dueSoon' | 'overdue'>(
    'all'
  );
  const today = new Date();
  const filteredItems = activity.scheduleItems.filter((item) => {
    if (activeFilter === 'all') {
      return true;
    }
    if (activeFilter === 'incomplete') {
      return item.status !== 'Complete';
    }
    if (!item.plannedDate || item.status === 'Complete') {
      return false;
    }
    const planned = new Date(`${item.plannedDate}T00:00:00`);
    if (activeFilter === 'overdue') {
      return planned < today;
    }
    if (activeFilter === 'dueSoon') {
      const diffDays = (planned.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 14;
    }
    return true;
  });

  const completedCount = activity.scheduleItems.filter(i => i.status === 'Complete').length;
  const totalCount = activity.scheduleItems.length;
  const activityStatus = completedCount === totalCount && totalCount > 0
    ? 'Complete'
    : completedCount > 0
    ? 'In Progress'
    : 'Not Started';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <button onClick={onToggle} className="hover:bg-muted p-1 rounded">
              {expanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>{activity.activityTemplateName}</CardTitle>
                <StatusBadge status={activityStatus} size="sm" />
              </div>
              <CardDescription>
                {completedCount} of {totalCount} items complete
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {activity.scheduleItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">No schedule items yet.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Show:</span>
                <Button
                  size="sm"
                  variant={activeFilter === 'all' ? 'default' : 'ghost'}
                  onClick={() => setActiveFilter('all')}
                >
                  All ({activity.scheduleItems.length})
                </Button>
                <Button
                  size="sm"
                  variant={activeFilter === 'incomplete' ? 'default' : 'ghost'}
                  onClick={() => setActiveFilter('incomplete')}
                >
                  Incomplete (
                  {activity.scheduleItems.filter((item) => item.status !== 'Complete').length})
                </Button>
                <Button
                  size="sm"
                  variant={activeFilter === 'dueSoon' ? 'default' : 'ghost'}
                  onClick={() => setActiveFilter('dueSoon')}
                >
                  Due Soon (14d)
                </Button>
                <Button
                  size="sm"
                  variant={activeFilter === 'overdue' ? 'default' : 'ghost'}
                  onClick={() => setActiveFilter('overdue')}
                >
                  Overdue (
                  {
                    activity.scheduleItems.filter((item) => {
                      if (!item.plannedDate || item.status === 'Complete') {
                        return false;
                      }
                      const planned = new Date(`${item.plannedDate}T00:00:00`);
                      return planned < today;
                    }).length
                  }
                  )
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Planned Date</TableHead>
                      <TableHead>Actual Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <SupplierScheduleItemRow key={item.id} item={item} onUpdate={onUpdate} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface SupplierScheduleItemRowProps {
  item: SupplierScheduleItemDetail;
  onUpdate: () => void;
}

function SupplierScheduleItemRow({ item, onUpdate }: SupplierScheduleItemRowProps) {
  const [actualDate, setActualDate] = useState(item.actualDate || '');
  const [status, setStatus] = useState(item.status);

  useEffect(() => {
    setActualDate(item.actualDate || '');
    setStatus(item.status);
  }, [item.id, item.actualDate, item.status]);

  const locked = item.locked || false;

  async function handleActualDateCommit(nextDate: string) {
    const response = await window.sqts.supplierScheduleItemInstances.update({
      id: item.id,
      actualDate: nextDate === '' ? undefined : nextDate,
    });
    if (response.success) {
      onUpdate();
    } else {
      alert(response.error || 'Failed to update actual date');
    }
  }

  async function handleMarkComplete() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayValue = `${yyyy}-${mm}-${dd}`;
    const response = await window.sqts.supplierScheduleItemInstances.update({
      id: item.id,
      status: 'Complete',
      actualDate: item.actualDate || todayValue,
    });
    if (response.success) {
      setStatus('Complete');
      setActualDate(item.actualDate || todayValue);
      onUpdate();
    } else {
      alert(response.error || 'Failed to complete item');
    }
  }

  return (
    <TableRow>
      <TableCell>
        <TypeBadge kind={item.kind} />
      </TableCell>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell>{formatDate(item.plannedDate)}</TableCell>
      <TableCell>
        <Input
          type="date"
          value={actualDate}
          onChange={(e) => setActualDate(e.target.value)}
          onBlur={() => handleActualDateCommit(actualDate)}
          disabled={locked}
          className="w-36"
        />
      </TableCell>
      <TableCell>
        <StatusBadge status={status} size="sm" />
      </TableCell>
      <TableCell />
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {status !== 'Complete' && (
            <Button size="sm" variant="outline" onClick={handleMarkComplete} disabled={locked}>
              Complete
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}


