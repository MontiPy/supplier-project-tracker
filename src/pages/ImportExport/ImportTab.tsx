import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ImportTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
          <CardDescription>Import functionality coming in Phase 3-5</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The import feature will allow you to:
          </p>
          <ul className="list-disc list-inside mt-3 space-y-2 text-muted-foreground">
            <li>Upload and validate JSON import files</li>
            <li>Review changes and conflicts before applying</li>
            <li>Edit incoming data inline</li>
            <li>Apply changes with automatic rollback points</li>
            <li>Undo imports if needed</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
