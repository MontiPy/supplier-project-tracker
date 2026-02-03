import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportTab } from './ExportTab';
import { ImportTab } from './ImportTab';

export function ImportExportPage() {
  const [activeTab, setActiveTab] = useState('export');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Import / Export</h1>
        <p className="text-muted-foreground">
          Export data to JSON or import data from external sources
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-6">
          <ExportTab />
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <ImportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
