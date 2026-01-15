import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ReportsOverview, SupplierProgress, ProjectProgress, ReportScheduleItem } from '@shared/types';

export function ReportsPage() {
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [supplierProgress, setSupplierProgress] = useState<SupplierProgress[]>([]);
  const [projectProgress, setProjectProgress] = useState<ProjectProgress[]>([]);
  const [overdueItems, setOverdueItems] = useState<ReportScheduleItem[]>([]);
  const [dueSoonItems, setDueSoonItems] = useState<ReportScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [overviewRes, progressRes, projectRes, overdueRes, dueSoonRes] = await Promise.all([
      window.sqts.reports.getOverview(),
      window.sqts.reports.getSupplierProgress(),
      window.sqts.reports.getProjectProgress(),
      window.sqts.reports.getOverdueItems(),
      window.sqts.reports.getDueSoonItems(),
    ]);

    if (overviewRes.success && overviewRes.data) {
      setOverview(overviewRes.data);
    }
    if (progressRes.success && progressRes.data) {
      setSupplierProgress(progressRes.data);
    }
    if (projectRes.success && projectRes.data) {
      setProjectProgress(projectRes.data);
    }
    if (overdueRes.success && overdueRes.data) {
      setOverdueItems(overdueRes.data);
    }
    if (dueSoonRes.success && dueSoonRes.data) {
      setDueSoonItems(dueSoonRes.data);
    }
    setLoading(false);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function exportToCSV() {
    // Create CSV content based on active tab
    let csvContent = '';

    if (activeTab === 'supplier-progress') {
      csvContent = 'Supplier,Total Items,Completed,Overdue,Progress %,Status\n';
      supplierProgress.forEach((s) => {
        csvContent += `"${s.supplierName}",${s.totalItems},${s.completedItems},${s.overdueItems},${s.progressPercent}%,"${s.status}"\n`;
      });
    } else if (activeTab === 'project-progress') {
      csvContent = 'Project,Version,Suppliers,Total Items,Completed,Overdue,Progress %,Status\n';
      projectProgress.forEach((p) => {
        csvContent += `"${p.projectName}",${p.projectVersion},${p.supplierCount},${p.totalItems},${p.completedItems},${p.overdueItems},${p.progressPercent}%,"${p.status}"\n`;
      });
    } else if (activeTab === 'overdue') {
      csvContent = 'Supplier,Project,Activity,Item,Due Date,Days Late,Status\n';
      overdueItems.forEach((item) => {
        const daysLate = Math.abs(item.daysUntilDue);
        csvContent += `"${item.supplierName}","${item.projectName}","${item.activityName}","${item.itemName}",${item.dueDate || ''},${daysLate},"${item.status}"\n`;
      });
    } else if (activeTab === 'due-soon') {
      csvContent = 'Supplier,Project,Activity,Item,Due Date,Days Until Due,Status\n';
      dueSoonItems.forEach((item) => {
        csvContent += `"${item.supplierName}","${item.projectName}","${item.activityName}","${item.itemName}",${item.dueDate || ''},${item.daysUntilDue},"${item.status}"\n`;
      });
    } else {
      csvContent = 'Metric,Value\n';
      if (overview) {
        csvContent += `"Overdue Items",${overview.overdueCount}\n`;
        csvContent += `"Due in 14 Days",${overview.dueSoonCount}\n`;
        csvContent += `"Total Items",${overview.totalItems}\n`;
        csvContent += `"Completed Items",${overview.completedItems}\n`;
        csvContent += `"Completion %",${overview.overallCompletionPercent}%\n`;
      }
    }

    // Download the CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sqts-report-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Cross-supplier and cross-project analytics
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="overdue">Overdue Items</TabsTrigger>
          <TabsTrigger value="due-soon">Due Soon</TabsTrigger>
          <TabsTrigger value="project-progress">Project Progress</TabsTrigger>
          <TabsTrigger value="supplier-progress">Supplier Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overdue Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {overview?.overdueCount || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  across all suppliers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Due in Next 14 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">
                  {overview?.dueSoonCount || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  upcoming deadlines
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overall Completion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {overview?.overallCompletionPercent || 0}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {overview?.completedItems || 0} of {overview?.totalItems || 0} items
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Overview content */}
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Total Schedule Items</span>
                  <span className="font-medium">{overview?.totalItems || 0}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Completed Items</span>
                  <span className="font-medium text-green-600">{overview?.completedItems || 0}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Overdue Items</span>
                  <span className="font-medium text-red-600">{overview?.overdueCount || 0}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Due Soon (14 days)</span>
                  <span className="font-medium text-amber-600">{overview?.dueSoonCount || 0}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Remaining Items</span>
                  <span className="font-medium">
                    {(overview?.totalItems || 0) - (overview?.completedItems || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card>
            <CardHeader>
              <CardTitle>Overdue Items</CardTitle>
            </CardHeader>
            <CardContent>
              {overdueItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No overdue items. Great job!
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Days Late</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdueItems.map((item) => (
                        <TableRow key={item.supplierScheduleItemInstanceId}>
                          <TableCell className="font-medium">{item.supplierName}</TableCell>
                          <TableCell>{item.projectName}</TableCell>
                          <TableCell>{item.activityName}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{formatDate(item.dueDate)}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {Math.abs(item.daysUntilDue)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} size="sm" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="due-soon">
          <Card>
            <CardHeader>
              <CardTitle>Due Soon (Next 14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {dueSoonItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items due in the next 14 days.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Days Until Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dueSoonItems.map((item) => (
                        <TableRow key={item.supplierScheduleItemInstanceId}>
                          <TableCell className="font-medium">{item.supplierName}</TableCell>
                          <TableCell>{item.projectName}</TableCell>
                          <TableCell>{item.activityName}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{formatDate(item.dueDate)}</TableCell>
                          <TableCell className="text-right text-amber-600 font-medium">
                            {item.daysUntilDue}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} size="sm" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="project-progress">
          <Card>
            <CardHeader>
              <CardTitle>Project Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {projectProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No project data available.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead className="text-right">Suppliers</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectProgress.map((project) => (
                        <TableRow key={project.projectId}>
                          <TableCell className="font-medium">
                            {project.projectName}
                            <span className="text-xs text-muted-foreground ml-2">
                              {project.projectVersion}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{project.supplierCount}</TableCell>
                          <TableCell className="text-right">{project.totalItems}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {project.completedItems}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {project.overdueItems}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${project.progressPercent}%` }}
                                />
                              </div>
                              <span className="text-sm">{project.progressPercent}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={project.status} size="sm" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplier-progress">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {supplierProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No supplier data available.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierProgress.map((supplier) => (
                        <TableRow key={supplier.supplierId}>
                          <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                          <TableCell className="text-right">{supplier.totalItems}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {supplier.completedItems}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {supplier.overdueItems}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${supplier.progressPercent}%` }}
                                />
                              </div>
                              <span className="text-sm">{supplier.progressPercent}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={supplier.status} size="sm" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
