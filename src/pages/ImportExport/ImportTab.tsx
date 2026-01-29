import { useState } from 'react';
import { Upload, FileJson, AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExportedData, ImportAnalysis, MatchResult } from '@shared/types';
import { ReviewChanges } from './ReviewChanges';

type ImportStep = 'select' | 'analyze' | 'review' | 'confirm' | 'complete';

interface ImportState {
  step: ImportStep;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  parsedData: ExportedData | null;
  analysis: ImportAnalysis | null;
  selectedMatches: MatchResult[];
  errors: Array<{ path: string; message: string; severity: 'error' | 'warning' }>;
}

export function ImportTab() {
  const [state, setState] = useState<ImportState>({
    step: 'select',
    filePath: null,
    fileName: null,
    fileSize: null,
    parsedData: null,
    analysis: null,
    selectedMatches: [],
    errors: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectFile() {
    setLoading(true);
    setError(null);

    try {
      const response = await window.sqts.importData.selectFile();

      if (!response.success) {
        setError(response.error || 'Failed to select file');
        setLoading(false);
        return;
      }

      if (!response.data) {
        // User cancelled
        setLoading(false);
        return;
      }

      const filePath = response.data;
      const fileName = filePath.split(/[/\\]/).pop() || 'unknown';

      // Get file size (we'll need to add a helper for this or estimate)
      setState({
        ...state,
        filePath,
        fileName,
        fileSize: null, // We can add file size later if needed
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!state.filePath) return;

    setLoading(true);
    setError(null);

    try {
      // Parse the file
      const parseResponse = await window.sqts.importData.parseFile(state.filePath);

      if (!parseResponse.success) {
        setError(parseResponse.error || 'Failed to parse file');
        setLoading(false);
        return;
      }

      const { data: parsedData, errors: parseErrors } = parseResponse.data;

      // If there are errors, show them
      if (parseErrors && parseErrors.length > 0) {
        setState({
          ...state,
          errors: parseErrors,
          step: 'select',
        });
        setError('Validation errors found in import file');
        setLoading(false);
        return;
      }

      // Analyze the data
      const analysisResponse = await window.sqts.importData.analyze(parsedData);

      if (!analysisResponse.success) {
        setError(analysisResponse.error || 'Failed to analyze import');
        setLoading(false);
        return;
      }

      setState({
        ...state,
        parsedData,
        analysis: analysisResponse.data || null,
        step: 'analyze',
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyChanges() {
    if (!state.parsedData || !state.analysis) return;

    setLoading(true);
    setError(null);

    try {
      const response = await window.sqts.importData.execute(state.parsedData, state.analysis);

      if (!response.success) {
        setError(response.error || 'Failed to apply changes');
        setLoading(false);
        return;
      }

      setState({
        ...state,
        step: 'complete',
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleBackToSelect() {
    setState({
      step: 'select',
      filePath: null,
      fileName: null,
      fileSize: null,
      parsedData: null,
      analysis: null,
      selectedMatches: [],
      errors: [],
    });
    setError(null);
  }

  function handleProceedToReview() {
    setState({
      ...state,
      step: 'review',
    });
  }

  function handleProceedToConfirm(selectedMatches: MatchResult[]) {
    setState({
      ...state,
      selectedMatches,
      step: 'confirm',
    });
  }

  function handleBackToAnalysis() {
    setState({
      ...state,
      step: 'analyze',
    });
  }

  function handleBackToReview() {
    setState({
      ...state,
      step: 'review',
    });
  }

  // Step 1: File Selection
  if (state.step === 'select') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Import File</CardTitle>
            <CardDescription>Choose a JSON file to import data from</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* File Selection Area */}
              <div
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                onClick={handleSelectFile}
              >
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Click to select a file</p>
                <p className="text-sm text-muted-foreground">JSON files only</p>
              </div>

              {state.filePath && (
                <div className="border rounded-lg p-4 bg-accent/20">
                  <div className="flex items-center gap-3">
                    <FileJson className="h-8 w-8 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{state.fileName}</p>
                      <p className="text-sm text-muted-foreground">Selected file</p>
                    </div>
                  </div>
                </div>
              )}

              {state.errors.length > 0 && (
                <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive mb-2">Validation Errors</p>
                      <div className="space-y-1 text-sm">
                        {state.errors.map((err, idx) => (
                          <div key={idx}>
                            <span className="font-mono text-xs">{err.path}:</span> {err.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleAnalyze}
                  disabled={!state.filePath || loading}
                  size="lg"
                >
                  {loading ? 'Analyzing...' : 'Analyze Import →'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Analysis Summary
  if (state.step === 'analyze' && state.analysis) {
    const { summary } = state.analysis;
    const totalNew = Object.values(summary).reduce((sum, s) => sum + s.new, 0);
    const totalModified = Object.values(summary).reduce((sum, s) => sum + s.modified, 0);
    const totalUnchanged = Object.values(summary).reduce((sum, s) => sum + s.unchanged, 0);
    const totalErrors = Object.values(summary).reduce((sum, s) => sum + s.errors, 0);
    const totalRecords = totalNew + totalModified + totalUnchanged + totalErrors;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Analysis</CardTitle>
            <CardDescription>Review the changes that will be made</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-accent">
                  <tr>
                    <th className="text-left p-3 font-semibold">Entity Type</th>
                    <th className="text-right p-3 font-semibold">New</th>
                    <th className="text-right p-3 font-semibold">Modified</th>
                    <th className="text-right p-3 font-semibold">Unchanged</th>
                    <th className="text-right p-3 font-semibold">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary).map(([entityType, counts]) => (
                    <tr key={entityType} className="border-t">
                      <td className="p-3 font-medium capitalize">
                        {entityType.replace(/_/g, ' ')}
                      </td>
                      <td className="p-3 text-right text-green-600 dark:text-green-400">
                        {counts.new}
                      </td>
                      <td className="p-3 text-right text-blue-600 dark:text-blue-400">
                        {counts.modified}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {counts.unchanged}
                      </td>
                      <td className="p-3 text-right text-destructive">
                        {counts.errors}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold bg-accent/50">
                    <td className="p-3">TOTAL</td>
                    <td className="p-3 text-right">{totalNew}</td>
                    <td className="p-3 text-right">{totalModified}</td>
                    <td className="p-3 text-right">{totalUnchanged}</td>
                    <td className="p-3 text-right">{totalErrors}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {totalErrors > 0 && (
              <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">
                      {totalErrors} error{totalErrors !== 1 ? 's' : ''} require{totalErrors === 1 ? 's' : ''} attention
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      These records will be skipped during import
                    </p>
                  </div>
                </div>
              </div>
            )}

            {totalModified > 0 && (
              <div className="border border-blue-500 rounded-lg p-4 bg-blue-500/10">
                <p className="text-sm">
                  ℹ {totalModified} record{totalModified !== 1 ? 's have' : ' has'} changes to review
                </p>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <p>Total records analyzed: {totalRecords}</p>
              <p className="mt-1">File: {state.fileName}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBackToSelect}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleProceedToReview} size="lg">
            Review Changes →
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Review Changes
  if (state.step === 'review' && state.analysis) {
    return (
      <ReviewChanges
        analysis={state.analysis}
        onBack={handleBackToAnalysis}
        onProceed={handleProceedToConfirm}
      />
    );
  }

  // Step 4: Confirm
  if (state.step === 'confirm') {
    const newCount = state.selectedMatches.filter(m => m.status === 'NEW').length;
    const modifiedCount = state.selectedMatches.filter(m => m.status === 'MODIFIED').length;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Confirm Import</CardTitle>
            <CardDescription>Review the final summary before applying changes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4 bg-accent/20">
              <p className="font-medium mb-3">You are about to apply the following changes:</p>
              <ul className="space-y-2 text-sm">
                {newCount > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-green-600 dark:text-green-400">{newCount}</span>
                    <span>new record{newCount !== 1 ? 's' : ''} will be created</span>
                  </li>
                )}
                {modifiedCount > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400">{modifiedCount}</span>
                    <span>record{modifiedCount !== 1 ? 's' : ''} will be updated</span>
                  </li>
                )}
              </ul>
            </div>

            <div className="border border-blue-500 rounded-lg p-4 bg-blue-500/10">
              <p className="text-sm font-medium mb-2">ℹ Note</p>
              <p className="text-sm text-muted-foreground">
                Import application and rollback functionality will be implemented in Phase 5.
                For now, this confirms your selection is ready to be applied.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="createRollback"
                  defaultChecked
                  disabled
                  className="h-4 w-4 mt-1"
                />
                <Label htmlFor="createRollback" className="font-normal cursor-not-allowed opacity-50">
                  Create rollback point before applying (available in Phase 5)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Rollback points allow you to undo this entire import if needed
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBackToReview}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Review
          </Button>
          <Button size="lg" onClick={handleApplyChanges} disabled={loading}>
            {loading ? 'Applying Changes...' : 'Apply Changes'}
          </Button>
        </div>
      </div>
    );
  }

  // Step 5: Complete
  if (state.step === 'complete') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Import Complete</CardTitle>
            <CardDescription>
              Changes have been successfully applied to the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <p className="text-sm text-green-800">
                The import has been completed successfully. All changes have been applied to the database.
              </p>
            </div>

            {state.analysis && (
              <div className="space-y-2">
                <h3 className="font-medium">Summary:</h3>
                <ul className="text-sm space-y-1">
                  {Object.entries(state.analysis.summary).map(([entityType, counts]) => {
                    const total = counts.new + counts.modified;
                    if (total === 0) return null;
                    return (
                      <li key={entityType}>
                        <strong>{entityType}:</strong> {counts.new} new, {counts.modified} modified
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleBackToSelect}>
            Import Another File
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
