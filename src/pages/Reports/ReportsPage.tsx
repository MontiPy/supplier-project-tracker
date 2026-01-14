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
import { StatusBadge, RankBadge } from '@/components/ui/status-badge';
import type { ReportsOverview, SupplierProgress } from '@shared/types';

export function ReportsPage() {
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [supplierProgress, setSupplierProgress] = useState<SupplierProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [overviewRes, progressRes] = await Promise.all([
      window.sqts.reports.getOverview(),
      window.sqts.reports.getSupplierProgress(),
    ]);

    if (overviewRes.success && overviewRes.data) {
      setOverview(overviewRes.data);
    }
    if (progressRes.success && progressRes.data) {
      setSupplierProgress(progressRes.data);
    }
    setLoading(false);
  }

  function exportToCSV() {
    // Create CSV content based on active tab
    let csvContent = '';

    if (activeTab === 'supplier-progress') {
      csvContent = 'Supplier,NMR Rank,Total Items,Completed,Overdue,Progress %,Status\n';
      supplierProgress.forEach((s) => {
        csvContent += `"${s.supplierName}","${s.nmrRank || ''}",${s.totalItems},${s.completedItems},${s.overdueItems},${s.progressPercent}%,"${s.status}"\n`;
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
              {overview?.overdueCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No overdue items. Great job!
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {overview?.overdueCount} items are overdue. View the Dashboard for details.
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
              {overview?.dueSoonCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items due in the next 14 days.
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {overview?.dueSoonCount} items due soon. View the Dashboard for details.
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
                        <TableHead>NMR Rank</TableHead>
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
                          <TableCell>
                            <RankBadge rank={supplier.nmrRank} />
                          </TableCell>
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
