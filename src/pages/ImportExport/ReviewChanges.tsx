import { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Pencil, AlertCircle, CheckCircle2, Plus, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MatchResult, ImportAnalysis } from '@shared/types';
import { EditIncomingModal } from './EditIncomingModal';

interface ReviewChangesProps {
  analysis: ImportAnalysis;
  onBack: () => void;
  onProceed: (selectedMatches: MatchResult[]) => void;
}

type StatusFilter = 'all' | 'new' | 'modified' | 'conflict';

export function ReviewChanges({ analysis, onBack, onProceed }: ReviewChangesProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingMatch, setEditingMatch] = useState<MatchResult | null>(null);
  const [modifiedMatches, setModifiedMatches] = useState<Map<string, MatchResult>>(new Map());

  // Get unique entity types
  const entityTypes = Array.from(new Set(analysis.matches.map(m => m.entityType)));

  // Filter matches
  const filteredMatches = analysis.matches.filter(match => {
    // Status filter
    if (statusFilter === 'new' && match.status !== 'NEW') return false;
    if (statusFilter === 'modified' && match.status !== 'MODIFIED') return false;
    if (statusFilter === 'conflict' && match.status !== 'CONFLICT') return false;

    // Entity type filter
    if (entityTypeFilter !== 'all' && match.entityType !== entityTypeFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchKey = match.matchKey.toLowerCase();
      return matchKey.includes(query);
    }

    return true;
  });

  // Get counts for filters
  const newCount = analysis.matches.filter(m => m.status === 'NEW').length;
  const modifiedCount = analysis.matches.filter(m => m.status === 'MODIFIED').length;
  const conflictCount = analysis.matches.filter(m => m.status === 'CONFLICT').length;

  function toggleSelection(matchKey: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(matchKey)) {
      newSet.delete(matchKey);
    } else {
      newSet.add(matchKey);
    }
    setSelectedIds(newSet);
  }

  function selectAll() {
    const allKeys = filteredMatches
      .filter(m => m.status !== 'CONFLICT' && m.status !== 'UNCHANGED')
      .map(m => m.matchKey);
    setSelectedIds(new Set(allKeys));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function selectAllModified() {
    const modifiedKeys = filteredMatches
      .filter(m => m.status === 'MODIFIED')
      .map(m => m.matchKey);
    setSelectedIds(new Set(modifiedKeys));
  }

  function toggleExpanded(matchKey: string) {
    const newSet = new Set(expandedIds);
    if (newSet.has(matchKey)) {
      newSet.delete(matchKey);
    } else {
      newSet.add(matchKey);
    }
    setExpandedIds(newSet);
  }

  function handleEditMatch(match: MatchResult) {
    setEditingMatch(match);
  }

  function handleSaveEdit(matchKey: string, updatedMatch: MatchResult) {
    const newModified = new Map(modifiedMatches);
    newModified.set(matchKey, updatedMatch);
    setModifiedMatches(newModified);
    setEditingMatch(null);
  }

  function handleProceed() {
    // Get selected matches (use modified version if available)
    const selected = analysis.matches
      .filter(m => selectedIds.has(m.matchKey))
      .map(m => modifiedMatches.get(m.matchKey) || m);

    onProceed(selected);
  }

  function getStatusIcon(status: MatchResult['status']) {
    switch (status) {
      case 'NEW':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'MODIFIED':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'UNCHANGED':
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
      case 'CONFLICT':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  }

  function getStatusBadge(status: MatchResult['status']) {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded text-xs font-medium";
    switch (status) {
      case 'NEW':
        return <span className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>NEW</span>;
      case 'MODIFIED':
        return <span className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`}>MODIFIED</span>;
      case 'UNCHANGED':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200`}>UNCHANGED</span>;
      case 'CONFLICT':
        return <span className={`${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`}>ERROR</span>;
    }
  }

  function formatMatchLabel(match: MatchResult): string {
    // Remove entity type prefix from match key
    const parts = match.matchKey.split(':');
    if (parts.length > 1) {
      return parts[1].replace(/\//g, ' / ');
    }
    return match.matchKey;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Changes</CardTitle>
          <CardDescription>
            Review and edit changes before applying. Select which changes to apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Status Filter */}
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="statusFilter" className="text-sm mb-2 block">Status</Label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full h-10 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="all">All ({analysis.matches.length})</option>
                <option value="new">New ({newCount})</option>
                <option value="modified">Modified ({modifiedCount})</option>
                <option value="conflict">Conflicts ({conflictCount})</option>
              </select>
            </div>

            {/* Entity Type Filter */}
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="entityTypeFilter" className="text-sm mb-2 block">Entity Type</Label>
              <select
                id="entityTypeFilter"
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="w-full h-10 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="all">All Types</option>
                {entityTypes.map(type => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search" className="text-sm mb-2 block">Search</Label>
              <Input
                id="search"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All Actionable
            </Button>
            <Button variant="outline" size="sm" onClick={selectAllModified}>
              Select All Modified
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
            <div className="ml-auto text-sm text-muted-foreground">
              Selected: {selectedIds.size} of {filteredMatches.filter(m => m.status !== 'UNCHANGED').length}
            </div>
          </div>

          {/* Change List */}
          <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
            {filteredMatches.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No changes match the current filters
              </div>
            ) : (
              filteredMatches.map((match) => {
                const isExpanded = expandedIds.has(match.matchKey);
                const isSelected = selectedIds.has(match.matchKey);
                const isActionable = match.status !== 'UNCHANGED' && match.status !== 'CONFLICT';
                const displayMatch = modifiedMatches.get(match.matchKey) || match;

                return (
                  <div key={match.matchKey} className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {isActionable && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(match.matchKey)}
                          className="h-4 w-4 mt-1"
                        />
                      )}
                      {!isActionable && <div className="w-4" />}

                      {/* Status Icon */}
                      <div className="mt-1">
                        {getStatusIcon(match.status)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <button
                                onClick={() => toggleExpanded(match.matchKey)}
                                className="text-sm font-medium hover:underline text-left"
                              >
                                {formatMatchLabel(displayMatch)}
                              </button>
                              {getStatusBadge(match.status)}
                              {modifiedMatches.has(match.matchKey) && (
                                <span className="text-xs text-blue-600 dark:text-blue-400">(edited)</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {match.entityType.replace(/_/g, ' ')}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {isActionable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditMatch(displayMatch)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(match.matchKey)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-3 pl-4 border-l-2 border-muted space-y-2">
                            {match.status === 'CONFLICT' && match.errors && (
                              <div className="text-sm text-destructive space-y-1">
                                <p className="font-medium">Errors:</p>
                                {match.errors.map((error, idx) => (
                                  <p key={idx}>• {error}</p>
                                ))}
                              </div>
                            )}

                            {match.status === 'MODIFIED' && match.changes && match.changes.length > 0 && (
                              <div className="text-sm space-y-1">
                                <p className="font-medium">Changes:</p>
                                {match.changes.map((change, idx) => (
                                  <div key={idx} className="flex gap-2">
                                    <span className="text-muted-foreground">{change.field}:</span>
                                    <span className="line-through text-muted-foreground">{String(change.oldValue)}</span>
                                    <span>→</span>
                                    <span className="text-blue-600 dark:text-blue-400">{String(change.newValue)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {match.status === 'NEW' && (
                              <div className="text-sm text-muted-foreground">
                                This record will be created
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Analysis
        </Button>
        <Button
          onClick={handleProceed}
          disabled={selectedIds.size === 0}
          size="lg"
        >
          Apply {selectedIds.size} Change{selectedIds.size !== 1 ? 's' : ''} →
        </Button>
      </div>

      {/* Edit Modal */}
      {editingMatch && (
        <EditIncomingModal
          match={editingMatch}
          onSave={(updated) => handleSaveEdit(editingMatch.matchKey, updated)}
          onCancel={() => setEditingMatch(null)}
        />
      )}
    </div>
  );
}
