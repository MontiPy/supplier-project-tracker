import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MatchResult } from '@shared/types';

interface EditIncomingModalProps {
  match: MatchResult;
  onSave: (updatedMatch: MatchResult) => void;
  onCancel: () => void;
}

export function EditIncomingModal({ match, onSave, onCancel }: EditIncomingModalProps) {
  const [editedData, setEditedData] = useState<any>({ ...match.incomingData });

  // Get all editable fields from incoming data
  const editableFields = Object.keys(match.incomingData).filter(
    key => !['id', 'createdAt', 'created_at'].includes(key)
  );

  function handleFieldChange(field: string, value: any) {
    setEditedData({
      ...editedData,
      [field]: value,
    });
  }

  function handleSave() {
    const updatedMatch: MatchResult = {
      ...match,
      incomingData: editedData,
      // Recalculate changes if this was a MODIFIED record
      changes: match.existingData
        ? Object.keys(editedData).map(field => {
            const oldValue = match.existingData?.[field];
            const newValue = editedData[field];
            if (oldValue !== newValue) {
              return { field, oldValue, newValue };
            }
            return null;
          }).filter(Boolean) as Array<{ field: string; oldValue: any; newValue: any }>
        : undefined,
    };

    onSave(updatedMatch);
  }

  function formatFieldName(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  function formatValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  function parseValue(field: string, stringValue: string): any {
    const originalValue = match.incomingData[field];

    // Handle empty strings
    if (stringValue === '') {
      if (typeof originalValue === 'string') return '';
      return null;
    }

    // Parse based on original type
    if (typeof originalValue === 'boolean') {
      return stringValue.toLowerCase() === 'true';
    }
    if (typeof originalValue === 'number') {
      const num = Number(stringValue);
      return isNaN(num) ? originalValue : num;
    }

    return stringValue;
  }

  function getFieldType(field: string): string {
    const value = match.incomingData[field];
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (field.toLowerCase().includes('date')) return 'date';
    return 'text';
  }

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Incoming Data</DialogTitle>
          <DialogDescription>
            Modify the incoming values before applying this change
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {editableFields.map(field => {
            const fieldType = getFieldType(field);
            const existingValue = match.existingData?.[field];
            const hasExisting = match.existingData && field in match.existingData;

            return (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>{formatFieldName(field)}</Label>

                {hasExisting && (
                  <div className="text-sm text-muted-foreground">
                    Current: {formatValue(existingValue)}
                  </div>
                )}

                {fieldType === 'checkbox' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={field}
                      checked={editedData[field] === true}
                      onChange={(e) => handleFieldChange(field, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={field} className="font-normal cursor-pointer">
                      {editedData[field] ? 'True' : 'False'}
                    </Label>
                  </div>
                ) : (
                  <Input
                    id={field}
                    type={fieldType}
                    value={formatValue(editedData[field])}
                    onChange={(e) => handleFieldChange(field, parseValue(field, e.target.value))}
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
