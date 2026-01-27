import { useState, useEffect } from 'react';
import { Download, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  ExportScope,
  ExportOptions,
  Supplier,
  Project,
  ActivityTemplate,
} from '@shared/types';

export function ExportTab() {
  const [scope, setScope] = useState<ExportScope>('selective');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activityTemplates, setActivityTemplates] = useState<ActivityTemplate[]>([]);

  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<number>>(new Set());
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());

  const [includeScheduleInstances, setIncludeScheduleInstances] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(false);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [suppliersRes, projectsRes, templatesRes] = await Promise.all([
      window.sqts.suppliers.list(),
      window.sqts.projects.list(),
      window.sqts.activityTemplates.list(),
    ]);

    if (suppliersRes.success && suppliersRes.data) {
      setSuppliers(suppliersRes.data);
    }
    if (projectsRes.success && projectsRes.data) {
      setProjects(projectsRes.data);
    }
    if (templatesRes.success && templatesRes.data) {
      setActivityTemplates(templatesRes.data);
    }
  }

  function toggleSupplier(id: number) {
    const newSet = new Set(selectedSupplierIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedSupplierIds(newSet);
  }

  function toggleProject(id: number) {
    const newSet = new Set(selectedProjectIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProjectIds(newSet);
  }

  function toggleTemplate(id: number) {
    const newSet = new Set(selectedTemplateIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTemplateIds(newSet);
  }

  function selectAllSuppliers() {
    setSelectedSupplierIds(new Set(suppliers.map((s) => s.id)));
  }

  function clearAllSuppliers() {
    setSelectedSupplierIds(new Set());
  }

  function selectAllProjects() {
    setSelectedProjectIds(new Set(projects.map((p) => p.id)));
  }

  function clearAllProjects() {
    setSelectedProjectIds(new Set());
  }

  function selectAllTemplates() {
    setSelectedTemplateIds(new Set(activityTemplates.map((t) => t.id)));
  }

  function clearAllTemplates() {
    setSelectedTemplateIds(new Set());
  }

  async function handleExport() {
    setExporting(true);

    try {
      if (scope === 'full') {
        const response = await window.sqts.exportData.fullDatabase();
        if (response.success) {
          alert(`Database exported successfully to:\n${response.data}`);
        } else {
          alert(`Export failed: ${response.error}`);
        }
      } else {
        const options: ExportOptions = {
          scope: 'selective',
          supplierIds: Array.from(selectedSupplierIds),
          projectIds: Array.from(selectedProjectIds),
          activityTemplateIds: Array.from(selectedTemplateIds),
          includeScheduleInstances,
          includeAttachments,
          includeSettings,
        };

        const response = await window.sqts.exportData.saveToFile(options);
        if (response.success) {
          alert(`Data exported successfully to:\n${response.data}`);
        } else {
          alert(`Export failed: ${response.error}`);
        }
      }
    } catch (error) {
      alert(`Export error: ${error}`);
    } finally {
      setExporting(false);
    }
  }

  const hasSelection =
    scope === 'full' ||
    selectedSupplierIds.size > 0 ||
    selectedProjectIds.size > 0 ||
    selectedTemplateIds.size > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export Scope</CardTitle>
          <CardDescription>Choose what data to export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="full"
                name="scope"
                value="full"
                checked={scope === 'full'}
                onChange={(e) => setScope(e.target.value as ExportScope)}
                className="h-4 w-4"
              />
              <Label htmlFor="full">Full Database Export</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="selective"
                name="scope"
                value="selective"
                checked={scope === 'selective'}
                onChange={(e) => setScope(e.target.value as ExportScope)}
                className="h-4 w-4"
              />
              <Label htmlFor="selective">Selective Export</Label>
            </div>
          </div>

          {scope === 'selective' && (
            <div className="space-y-4 mt-4">
              {/* Activity Templates */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Activity Templates</Label>
                  <div className="space-x-2">
                    <Button variant="ghost" size="sm" onClick={selectAllTemplates}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAllTemplates}>
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activityTemplates.map((template) => (
                    <div key={template.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`template-${template.id}`}
                        checked={selectedTemplateIds.has(template.id)}
                        onChange={() => toggleTemplate(template.id)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`template-${template.id}`} className="font-normal cursor-pointer">
                        {template.name}
                        {template.category && (
                          <span className="text-muted-foreground ml-2">({template.category})</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Projects</Label>
                  <div className="space-x-2">
                    <Button variant="ghost" size="sm" onClick={selectAllProjects}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAllProjects}>
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {projects.map((project) => (
                    <div key={project.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`project-${project.id}`}
                        checked={selectedProjectIds.has(project.id)}
                        onChange={() => toggleProject(project.id)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`project-${project.id}`} className="font-normal cursor-pointer">
                        {project.name} (v{project.version})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suppliers */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Suppliers</Label>
                  <div className="space-x-2">
                    <Button variant="ghost" size="sm" onClick={selectAllSuppliers}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearAllSuppliers}>
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {suppliers.map((supplier) => (
                    <div key={supplier.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`supplier-${supplier.id}`}
                        checked={selectedSupplierIds.has(supplier.id)}
                        onChange={() => toggleSupplier(supplier.id)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`supplier-${supplier.id}`} className="font-normal cursor-pointer">
                        {supplier.name}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  Includes all projects, activities, and parts for selected suppliers
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {scope === 'selective' && (
        <Card>
          <CardHeader>
            <CardTitle>Include Options</CardTitle>
            <CardDescription>Additional data to include in export</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeScheduleInstances"
                checked={includeScheduleInstances}
                onChange={(e) => setIncludeScheduleInstances(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="includeScheduleInstances" className="font-normal cursor-pointer">
                Include schedule item instances (dates, status)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeAttachments"
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="includeAttachments" className="font-normal cursor-pointer">
                Include attachments
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeSettings"
                checked={includeSettings}
                onChange={(e) => setIncludeSettings(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="includeSettings" className="font-normal cursor-pointer">
                Include settings (NMR ranks, PA ranks, propagation settings)
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleExport} disabled={!hasSelection || exporting} size="lg">
          {scope === 'full' ? (
            <>
              <FileDown className="mr-2 h-5 w-5" />
              Export Full Database
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Export Selected Data
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
