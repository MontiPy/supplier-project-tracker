import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the Supplier-Project-Activity Tracking System
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Phase 1 Complete</CardTitle>
            <CardDescription>Core CRUD Operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Suppliers Management</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Activity Templates</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Projects (Basic)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coming Next</CardTitle>
            <CardDescription>Phase 2 Features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2 text-muted-foreground">
              <div>• Schedule Items</div>
              <div>• Offset-based Scheduling</div>
              <div>• Milestone Dependencies</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Future Phases</CardTitle>
            <CardDescription>Advanced Features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2 text-muted-foreground">
              <div>• Supplier Instances</div>
              <div>• Change Propagation</div>
              <div>• PA/NMR Rules</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
