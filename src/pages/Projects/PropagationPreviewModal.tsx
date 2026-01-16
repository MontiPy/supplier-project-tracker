import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import type { PropagationPreview, PropagationResult } from '../../../shared/types';
import { AlertCircle, CheckCircle2, Lock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PropagationPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  onSuccess?: () => void;
}

export default function PropagationPreviewModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: PropagationPreviewModalProps) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<PropagationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showProtected, setShowProtected] = useState(false);

  // Load preview when dialog opens
  async function loadPreview() {
    if (!open) return;

    setLoading(true);
    try {
      const response = await window.sqts.projects.previewPropagation(projectId);
      if (response.success && response.data) {
        setPreview(response.data);
      } else {
        toast({ title: 'Error', description: `Error loading preview: ${response.error}`, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: String(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // Apply propagation
  async function handleApplyPropagation() {
    if (!preview) return;

    const confirmed = confirm(
      `This will update ${preview.willChange.length} schedule item instances across ${preview.supplierCount} supplier(s). Continue?`
    );

    if (!confirmed) return;

    setApplying(true);
    try {
      const response = await window.sqts.projects.propagateChanges(projectId);
      if (response.success && response.data) {
        const result: PropagationResult = response.data;
        toast({ title: 'Success', description: `Successfully updated ${result.updated.length} instances. ${result.skipped.length} instances were skipped based on protection settings.`, variant: 'success' });
        onOpenChange(false);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({ title: 'Error', description: `Error applying propagation: ${response.error}`, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: String(error), variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  }

  // Load preview when dialog opens
  if (open && !preview && !loading) {
    loadPreview();
  }

  // Reset when dialog closes
  if (!open && preview) {
    setPreview(null);
    setShowProtected(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Propagate Changes to Suppliers</DialogTitle>
          <DialogDescription>
            {loading && 'Loading preview...'}
            {!loading && preview && (
              <>
                <span className="text-green-600 font-semibold">{preview.willChange.length} instances will update</span>
                {', '}
                <span className="text-gray-600">{preview.wontChange.length} instances are protected</span>
                {' across '}
                <span className="font-semibold">{preview.supplierCount} supplier(s)</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-500">Loading preview...</p>
          </div>
        )}

        {!loading && preview && (
          <div className="space-y-4">
            {/* Toggle button */}
            <div className="flex gap-2">
              <Button
                variant={!showProtected ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowProtected(false)}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Will Update ({preview.willChange.length})
              </Button>
              <Button
                variant={showProtected ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowProtected(true)}
              >
                <Shield className="h-4 w-4 mr-1" />
                Protected ({preview.wontChange.length})
              </Button>
            </div>

            {/* Will Change Table */}
            {!showProtected && preview.willChange.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Schedule Item</TableHead>
                      <TableHead>Current Date</TableHead>
                      <TableHead>→</TableHead>
                      <TableHead>New Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.willChange.map((change, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{change.supplierName}</TableCell>
                        <TableCell>{change.activityName}</TableCell>
                        <TableCell>{change.scheduleItemName}</TableCell>
                        <TableCell>{change.currentPlannedDate || <span className="text-gray-400">None</span>}</TableCell>
                        <TableCell>→</TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          {change.newPlannedDate || <span className="text-gray-400">None</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Empty state for Will Change */}
            {!showProtected && preview.willChange.length === 0 && (
              <div className="border rounded-lg p-8 text-center text-gray-500">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No instances will be updated</p>
                <p className="text-sm">All instances are either up to date or protected</p>
              </div>
            )}

            {/* Protected Table */}
            {showProtected && preview.wontChange.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Schedule Item</TableHead>
                      <TableHead>Current Date</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.wontChange.map((change, index) => (
                      <TableRow key={index} className="bg-gray-50">
                        <TableCell className="font-medium">{change.supplierName}</TableCell>
                        <TableCell>{change.activityName}</TableCell>
                        <TableCell>{change.scheduleItemName}</TableCell>
                        <TableCell>{change.currentPlannedDate || <span className="text-gray-400">None</span>}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                            {change.reason === 'Locked' && <Lock className="h-3 w-3" />}
                            {change.reason === 'Manually overridden' && <AlertCircle className="h-3 w-3" />}
                            {change.reason === 'Already complete' && <CheckCircle2 className="h-3 w-3" />}
                            {change.reason}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Empty state for Protected */}
            {showProtected && preview.wontChange.length === 0 && (
              <div className="border rounded-lg p-8 text-center text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No protected instances</p>
                <p className="text-sm">All instances will receive updates</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          {preview && preview.willChange.length > 0 && (
            <Button onClick={handleApplyPropagation} disabled={applying}>
              {applying ? 'Applying...' : 'Apply Changes to All Suppliers'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
