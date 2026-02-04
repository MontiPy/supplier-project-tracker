import { useEffect, useState } from 'react';
import { X, Plus, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { AppSettings } from '@shared/types';

const defaultSettings: AppSettings = {
  nmrRanks: ['A1', 'A2', 'B1', 'B2', 'C1'],
  paRanks: ['Critical', 'High', 'Medium', 'Low'],
  propagationSkipComplete: true,
  propagationSkipLocked: true,
  propagationSkipOverridden: true,
  autoPropagateTemplateChanges: false,
  autoPropagateToSuppliers: false,
  dateFormat: 'MM/DD/YYYY',
  useBusinessDays: false,
};

export function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNmrRank, setNewNmrRank] = useState('');
  const [newPaRank, setNewPaRank] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const response = await window.sqts.settings.getAll();
    if (response.success && response.data) {
      setSettings(response.data);
    }
    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    setSaving(true);
    await window.sqts.settings.update({ key, value });
    setSaving(false);
  }

  async function updateNmrRanks(ranks: string[]) {
    setSettings({ ...settings, nmrRanks: ranks });
    await saveSetting('nmr_ranks', JSON.stringify(ranks));
  }

  async function updatePaRanks(ranks: string[]) {
    setSettings({ ...settings, paRanks: ranks });
    await saveSetting('pa_ranks', JSON.stringify(ranks));
  }

  async function updatePropagationSetting(key: string, value: boolean) {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSetting(key.replace(/([A-Z])/g, '_$1').toLowerCase(), String(value));
  }

  async function updateDateFormat(format: AppSettings['dateFormat']) {
    setSettings({ ...settings, dateFormat: format });
    await saveSetting('date_format', format);
  }

  function addNmrRank() {
    if (newNmrRank.trim() && !settings.nmrRanks.includes(newNmrRank.trim())) {
      updateNmrRanks([...settings.nmrRanks, newNmrRank.trim()]);
      setNewNmrRank('');
    }
  }

  function removeNmrRank(rank: string) {
    updateNmrRanks(settings.nmrRanks.filter((r) => r !== rank));
  }

  function addPaRank() {
    if (newPaRank.trim() && !settings.paRanks.includes(newPaRank.trim())) {
      updatePaRanks([...settings.paRanks, newPaRank.trim()]);
      setNewPaRank('');
    }
  }

  function removePaRank(rank: string) {
    updatePaRanks(settings.paRanks.filter((r) => r !== rank));
  }

  async function resetToDefaults() {
    setSettings(defaultSettings);
    await saveSetting('nmr_ranks', JSON.stringify(defaultSettings.nmrRanks));
    await saveSetting('pa_ranks', JSON.stringify(defaultSettings.paRanks));
    await saveSetting('propagation_skip_complete', String(defaultSettings.propagationSkipComplete));
    await saveSetting('propagation_skip_locked', String(defaultSettings.propagationSkipLocked));
    await saveSetting('propagation_skip_overridden', String(defaultSettings.propagationSkipOverridden));
    await saveSetting('date_format', defaultSettings.dateFormat);
    await saveSetting('use_business_days', String(defaultSettings.useBusinessDays));
  }

  async function handleExportDatabase() {
    setExporting(true);
    const response = await window.sqts.settings.exportDatabase();
    setExporting(false);
    if (!response.success || !response.data) {
      toast({ title: 'Error', description: response.error || 'Failed to export database', variant: 'destructive' });
      return;
    }
    if (response.data.canceled) {
      return;
    }
    toast({ title: 'Success', description: `Backup exported to ${response.data.path}`, variant: 'success' });
  }

  async function handleImportDatabase() {
    const confirmed = confirm(
      'Importing a backup will replace your current data. Continue?'
    );
    if (!confirmed) {
      return;
    }
    setImporting(true);
    const response = await window.sqts.settings.importDatabase();
    setImporting(false);
    if (!response.success || !response.data) {
      toast({ title: 'Error', description: response.error || 'Failed to import database', variant: 'destructive' });
      return;
    }
    if (response.data.canceled) {
      return;
    }
    toast({ title: 'Success', description: 'Backup imported. The app will reload to reflect the new data.', variant: 'success' });
    window.location.reload();
  }

  async function handleWipeDatabase() {
    const confirmed = confirm(
      'This will permanently delete all data from this app on this device. Continue?'
    );
    if (!confirmed) {
      return;
    }
    const promptValue = prompt('Type WIPE to confirm:');
    if (promptValue !== 'WIPE') {
      return;
    }
    setWiping(true);
    const response = await window.sqts.settings.wipeDatabase();
    setWiping(false);
    if (!response.success) {
      toast({ title: 'Error', description: response.error || 'Failed to wipe database', variant: 'destructive' });
      return;
    }
    toast({ title: 'Success', description: 'All data wiped. The app will reload with a fresh database.', variant: 'success' });
    window.location.reload();
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure system-wide settings, ranks, and propagation policies
        </p>
      </div>

      <div className="space-y-6">
        {/* NMR Rank Scale */}
        <Card>
          <CardHeader>
            <CardTitle>Project NMR Rank Scale</CardTitle>
            <CardDescription>
              Define the available NMR ranking levels for supplier projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.nmrRanks.map((rank) => (
                <span
                  key={rank}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  {rank}
                  <button
                    onClick={() => removeNmrRank(rank)}
                    className="hover:bg-green-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add rank..."
                value={newNmrRank}
                onChange={(e) => setNewNmrRank(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNmrRank()}
                className="w-32"
              />
              <Button variant="outline" size="sm" onClick={addNmrRank}>
                <Plus className="h-4 w-4 mr-1" />
                Add Rank
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PA Rank Scale */}
        <Card>
          <CardHeader>
            <CardTitle>Part PA Rank Scale</CardTitle>
            <CardDescription>
              Define the available PA ranking levels for parts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.paRanks.map((rank) => (
                <span
                  key={rank}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {rank}
                  <button
                    onClick={() => removePaRank(rank)}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add rank..."
                value={newPaRank}
                onChange={(e) => setNewPaRank(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPaRank()}
                className="w-32"
              />
              <Button variant="outline" size="sm" onClick={addPaRank}>
                <Plus className="h-4 w-4 mr-1" />
                Add Rank
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status Definitions */}
        <Card>
          <CardHeader>
            <CardTitle>Status Definitions</CardTitle>
            <CardDescription>
              Schedule item status options and their meanings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <span className="font-medium">Not Started</span>
                  <span className="text-muted-foreground text-sm ml-2">(Default)</span>
                </div>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">Default</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <span className="font-medium">In Progress</span>
                  <span className="text-muted-foreground text-sm ml-2">(Active)</span>
                </div>
                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm">Active</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <span className="font-medium">Complete</span>
                  <span className="text-muted-foreground text-sm ml-2">(Final)</span>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Final</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <span className="font-medium">Blocked</span>
                  <span className="text-muted-foreground text-sm ml-2">(Alert)</span>
                </div>
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">Alert</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium">Late</span>
                  <span className="text-muted-foreground text-sm ml-2">(Alert)</span>
                </div>
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">Alert</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Propagation Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Propagation Policy</CardTitle>
            <CardDescription>
              Control which items are protected from date propagation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="skip-complete">Skip Complete Items</Label>
                  <p className="text-sm text-muted-foreground">
                    Don't update dates for items marked as complete
                  </p>
                </div>
                <Switch
                  id="skip-complete"
                  checked={settings.propagationSkipComplete}
                  onCheckedChange={(checked: boolean) =>
                    updatePropagationSetting('propagationSkipComplete', checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="skip-locked">Skip Locked Items</Label>
                  <p className="text-sm text-muted-foreground">
                    Don't update dates for items that are locked
                  </p>
                </div>
                <Switch
                  id="skip-locked"
                  checked={settings.propagationSkipLocked}
                  onCheckedChange={(checked: boolean) =>
                    updatePropagationSetting('propagationSkipLocked', checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="skip-overridden">Skip Overridden Items</Label>
                  <p className="text-sm text-muted-foreground">
                    Don't update dates for items with manual date overrides
                  </p>
                </div>
                <Switch
                  id="skip-overridden"
                  checked={settings.propagationSkipOverridden}
                  onCheckedChange={(checked: boolean) =>
                    updatePropagationSetting('propagationSkipOverridden', checked)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Propagation Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Auto-Propagation</CardTitle>
            <CardDescription>
              Automatically sync changes from activity templates to projects and suppliers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-propagate-templates">Auto-Sync Template Changes</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically update projects when activity template schedule items change
                  </p>
                </div>
                <Switch
                  id="auto-propagate-templates"
                  checked={settings.autoPropagateTemplateChanges}
                  onCheckedChange={(checked: boolean) =>
                    updatePropagationSetting('autoPropagateTemplateChanges', checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-propagate-suppliers">Auto-Propagate to Suppliers</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically propagate project changes to suppliers (only when auto-sync is enabled)
                  </p>
                </div>
                <Switch
                  id="auto-propagate-suppliers"
                  checked={settings.autoPropagateToSuppliers}
                  onCheckedChange={(checked: boolean) =>
                    updatePropagationSetting('autoPropagateToSuppliers', checked)
                  }
                  disabled={!settings.autoPropagateTemplateChanges}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Display Format */}
        <Card>
          <CardHeader>
            <CardTitle>Date Display Format</CardTitle>
            <CardDescription>
              Choose how dates are displayed throughout the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={settings.dateFormat} onValueChange={(value: string) => updateDateFormat(value as AppSettings['dateFormat'])}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Date Calculation Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Date Calculation</CardTitle>
            <CardDescription>
              Configure how offset days are calculated for schedule items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use-business-days">Use Business Days</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, offset day calculations skip weekends (Saturday and Sunday)
                </p>
              </div>
              <Switch
                id="use-business-days"
                checked={settings.useBusinessDays}
                onCheckedChange={(checked: boolean) =>
                  updatePropagationSetting('useBusinessDays', checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Backup and Restore */}
        <Card>
          <CardHeader>
            <CardTitle>Backup and Restore</CardTitle>
            <CardDescription>
              Export your database for backup or import to restore a previous snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Export Backup</p>
                  <p className="text-sm text-muted-foreground">
                    Save a copy of your current database to a file.
                  </p>
                </div>
                <Button variant="outline" onClick={handleExportDatabase} disabled={exporting}>
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Import Backup</p>
                  <p className="text-sm text-muted-foreground">
                    Replace your current data with a backup file.
                  </p>
                </div>
                <Button variant="outline" onClick={handleImportDatabase} disabled={importing}>
                  {importing ? 'Importing...' : 'Import'}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-red-600">Nuclear Wipe</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all data and reset the database.
                  </p>
                </div>
                <Button variant="destructive" onClick={handleWipeDatabase} disabled={wiping}>
                  {wiping ? 'Wiping...' : 'Wipe All Data'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex items-center justify-between border-t pt-6">
        <p className="text-sm text-muted-foreground">
          Changes are saved automatically
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
