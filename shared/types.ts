// Shared TypeScript type definitions for Supplier-Project-Activity Tracking App
// Used by both Electron main process and React renderer

// ============================================================================
// Core Entities
// ============================================================================

export interface Supplier {
  id: number;
  name: string;
  notes: string | null;
  createdAt: string;
}

export interface SupplierLocationCode {
  id: number;
  supplierId: number;
  supplierNumber: string;
  locationCode: string;
  createdAt: string;
}

export interface ActivityTemplate {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  updatedAt: string | null;
  createdAt: string;
}

export interface Project {
  id: number;
  name: string;
  version: string;
  defaultAnchorRule: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// ============================================================================
// Project Structure
// ============================================================================

export interface ProjectActivity {
  id: number;
  projectId: number;
  activityTemplateId: number;
  sortOrder: number;
  createdAt: string;
}

export type ScheduleItemKind = 'MILESTONE' | 'TASK';

export type AnchorType =
  | 'FIXED_DATE'
  | 'SCHEDULE_ITEM'
  | 'COMPLETION';

export interface ProjectScheduleItem {
  id: number;
  projectActivityId: number;
  templateItemId: number | null;
  kind: ScheduleItemKind;
  name: string;
  anchorType: AnchorType;
  anchorRefId: number | null;
  offsetDays: number | null;
  fixedDate: string | null;
  overrideDate: string | null;
  overrideEnabled: boolean;
  sortOrder: number;
  createdAt: string;
}

// ============================================================================
// Supplier Instances
// ============================================================================

export interface SupplierProject {
  id: number;
  supplierId: number;
  projectId: number;
  projectVersion: string;
  supplierProjectNmrRank?: string | null;
  supplierName?: string;
  projectName?: string;
  createdAt: string;
}

export type ActivityStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Blocked'
  | 'Complete'
  | 'Not Required';

export type ScopeOverride = 'REQUIRED' | 'NOT_REQUIRED' | null;

export interface SupplierActivityInstance {
  id: number;
  supplierProjectId: number;
  projectActivityId: number;
  status: ActivityStatus;
  scopeOverride: ScopeOverride;
  createdAt: string;
}

export interface SupplierScheduleItemInstance {
  id: number;
  supplierActivityInstanceId: number;
  projectScheduleItemId: number;
  plannedDate: string | null;
  actualDate: string | null;
  status: ActivityStatus;
  plannedDateOverride: boolean;
  scopeOverride: ScopeOverride;
  locked: boolean;
  createdAt: string;
}

export interface ActivityTemplateScheduleItem {
  id: number;
  activityTemplateId: number;
  kind: ScheduleItemKind;
  name: string;
  anchorType: AnchorType;
  anchorRefId: number | null;
  offsetDays: number | null;
  createdAt: string;
}

export type ApplicabilityOperator = 'ALL' | 'ANY';
export type ApplicabilitySubject = 'SUPPLIER_NMR' | 'PART_PA';
export type ApplicabilityComparator = 'IN' | 'NOT_IN' | 'EQ' | 'NEQ' | 'GTE' | 'LTE';

export interface ActivityTemplateApplicabilityRule {
  id: number;
  activityTemplateId: number;
  operator: ApplicabilityOperator;
  enabled: boolean;
  createdAt: string;
}

export interface ActivityTemplateApplicabilityClause {
  id: number;
  ruleId: number;
  subjectType: ApplicabilitySubject;
  comparator: ApplicabilityComparator;
  value: string;
  createdAt: string;
}

export interface ActivityTemplateApplicability {
  rule: ActivityTemplateApplicabilityRule | null;
  clauses: ActivityTemplateApplicabilityClause[];
}

export interface ProjectActivityDependency {
  id: number;
  projectActivityId: number;
  dependsOnProjectActivityId: number;
  createdAt: string;
}

export interface ProjectScheduleItemDependency {
  id: number;
  projectScheduleItemId: number;
  dependsOnItemId: number;
  createdAt: string;
}

export interface SupplierActivityAttachment {
  id: number;
  supplierActivityInstanceId: number;
  label: string | null;
  url: string;
  createdAt: string;
}

export interface SupplierProjectSummary extends SupplierProject {
  supplierName: string;
  projectName: string;
}

export interface SupplierScheduleItemDetail extends ProjectScheduleItem {
  supplierScheduleItemId: number;
  plannedDate: string | null;
  actualDate: string | null;
  status: ActivityStatus;
  plannedDateOverride: boolean;
  scopeOverride: ScopeOverride;
  locked: boolean;
}

export interface SupplierProjectActivityDetail extends SupplierActivityInstance {
  activityTemplateName: string;
  scheduleItems: SupplierScheduleItemDetail[];
  attachments: SupplierActivityAttachment[];
}

export interface SupplierProjectDetail extends SupplierProject {
  supplierName: string;
  projectName: string;
  supplierProjectNmrRank?: string | null;
  activities: SupplierProjectActivityDetail[];
}

// ============================================================================
// Parts
// ============================================================================

export interface Part {
  id: number;
  supplierProjectId: number; // Kept for backward compatibility
  supplierLocationCodeId: number;
  partNumber: string;
  description: string | null;
  paRank: string | null;
  notes: string | null;
  createdAt: string;
}

// ============================================================================
// Audit
// ============================================================================

export interface AuditEvent {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  payload: string | null;
  details: string | null;
  createdAt: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

// Supplier operations
export interface CreateSupplierParams {
  name: string;
  notes?: string;
}

export interface UpdateSupplierParams {
  id: number;
  name?: string;
  notes?: string;
}

export interface CreateSupplierLocationCodeParams {
  supplierId: number;
  supplierNumber: string;
  locationCode: string;
}

// Activity Template operations
export interface CreateActivityTemplateParams {
  name: string;
  description?: string;
  category?: string;
}

export interface UpdateActivityTemplateParams {
  id: number;
  name?: string;
  description?: string;
  category?: string;
}

// Project operations
export interface CreateProjectParams {
  name: string;
  version?: string;
  defaultAnchorRule?: string;
}

export interface UpdateProjectParams {
  id: number;
  name?: string;
  version?: string;
  defaultAnchorRule?: string;
}

// Project Activity operations
export interface CreateProjectActivityParams {
  projectId: number;
  activityTemplateId: number;
  sortOrder?: number;
}

export interface UpdateProjectActivityParams {
  id: number;
  sortOrder?: number;
}

// Schedule Item operations
export interface CreateScheduleItemParams {
  projectActivityId: number;
  kind: ScheduleItemKind;
  name: string;
  anchorType: AnchorType;
  anchorRefId?: number;
  offsetDays?: number;
  fixedDate?: string | null; // YYYY-MM-DD
  sortOrder?: number;
  templateItemId?: number;
  overrideDate?: string | null;
  overrideEnabled?: boolean;
}

export interface UpdateScheduleItemParams {
  id: number;
  name?: string;
  anchorType?: AnchorType;
  anchorRefId?: number;
  offsetDays?: number;
  fixedDate?: string | null; // YYYY-MM-DD
  sortOrder?: number;
  overrideDate?: string | null;
  overrideEnabled?: boolean;
}

// Activity template schedule item operations
export interface CreateActivityTemplateScheduleItemParams {
  activityTemplateId: number;
  kind: ScheduleItemKind;
  name: string;
  anchorType: AnchorType;
  anchorRefId?: number;
  offsetDays?: number;
}

export interface UpdateActivityTemplateScheduleItemParams {
  id: number;
  kind?: ScheduleItemKind;
  name?: string;
  anchorType?: AnchorType;
  anchorRefId?: number;
  offsetDays?: number;
}

export interface UpsertActivityTemplateApplicabilityRuleParams {
  activityTemplateId: number;
  operator: ApplicabilityOperator;
  enabled: boolean;
}

export interface UpdateActivityTemplateApplicabilityRuleParams {
  id: number;
  operator?: ApplicabilityOperator;
  enabled?: boolean;
}

export interface CreateActivityTemplateApplicabilityClauseParams {
  ruleId: number;
  subjectType: ApplicabilitySubject;
  comparator: ApplicabilityComparator;
  value: string;
}

export interface UpdateActivityTemplateApplicabilityClauseParams {
  id: number;
  subjectType?: ApplicabilitySubject;
  comparator?: ApplicabilityComparator;
  value?: string;
}

export interface SyncProjectActivityFromTemplateParams {
  projectActivityId: number;
  applyTemplateOffsets?: boolean;
}

// Supplier Project operations
export interface ApplySupplierProjectParams {
  supplierId: number;
  projectId: number;
  supplierProjectNmrRank?: string | null;
}

export interface UpdateSupplierProjectParams {
  id: number;
  supplierProjectNmrRank?: string | null;
}

export interface UpdateSupplierActivityInstanceParams {
  id: number;
  status?: ActivityStatus;
  scopeOverride?: ScopeOverride;
}

export interface UpdateSupplierScheduleItemInstanceParams {
  id: number;
  plannedDate?: string;
  actualDate?: string;
  status?: ActivityStatus;
  plannedDateOverride?: boolean;
  scopeOverride?: ScopeOverride;
  locked?: boolean;
}

export interface CreateSupplierActivityAttachmentParams {
  supplierActivityInstanceId: number;
  label?: string;
  url: string;
}

// Parts operations
export interface CreatePartParams {
  supplierProjectId: number; // Kept for backward compatibility - will be used to derive location code
  supplierLocationCodeId?: number; // Optional - will use DEFAULT location code if not provided
  partNumber: string;
  description?: string;
  paRank?: string;
  notes?: string;
}

export interface UpdatePartParams {
  id: number;
  partNumber?: string;
  description?: string;
  paRank?: string;
  notes?: string;
}

// Computed schedule results
export interface ScheduleItemWithDates extends ProjectScheduleItem {
  plannedDate: string | null; // computed from anchor rules
  error?: string; // if date computation fails
}

export interface ProjectActivityDetail extends ProjectActivity {
  activityTemplateName: string;
  activityTemplateCategory: string | null;
  scheduleItems: ScheduleItemWithDates[];
}

export interface ProjectDetail extends Project {
  activities: ProjectActivityDetail[];
}

// ============================================================================
// Phase 4: Propagation Engine + Overrides
// ============================================================================

// Propagation preview and results
export interface PropagationChange {
  supplierScheduleItemInstanceId: number;
  supplierName: string;
  projectName: string;
  activityName: string;
  scheduleItemName: string;
  currentPlannedDate: string | null;
  newPlannedDate: string | null;
  reason?: string; // why it won't change (locked, overridden, etc.)
}

export interface PropagationPreview {
  projectId: number;
  projectName: string;
  supplierCount: number;
  willChange: PropagationChange[];
  wontChange: PropagationChange[];
}

export interface PropagationResult {
  updated: PropagationChange[];
  skipped: PropagationChange[];
  errors: string[];
}

// Audit log query
export interface AuditEventQuery {
  entityType: string;
  entityId: number;
  limit?: number;
}

// Generic API Response
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Phase 5: Settings, Dashboard, Reports
// ============================================================================

// Settings
export interface Setting {
  key: string;
  value: string;
  updatedAt: string;
}

export interface FileDialogResult {
  canceled: boolean;
  path?: string;
}

export interface AppSettings {
  nmrRanks: string[];
  paRanks: string[];
  propagationSkipComplete: boolean;
  propagationSkipLocked: boolean;
  propagationSkipOverridden: boolean;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  useBusinessDays: boolean;
}

export interface UpdateSettingParams {
  key: string;
  value: string;
}

// Dashboard
export interface DashboardFilters {
  dueRange?: number; // days
  supplierId?: number;
  projectId?: number;
  status?: string;
}

export interface DashboardSummary {
  overdue: number;
  dueSoon: number;
  blocked: number;
  needsPropagation: number;
}

export interface ActionableItem {
  id: number;
  supplierScheduleItemInstanceId: number;
  dueDate: string | null;
  supplierId: number;
  supplierName: string;
  supplierProjectId: number;
  projectId: number;
  projectName: string;
  activityName: string;
  itemName: string;
  itemKind: ScheduleItemKind;
  status: ActivityStatus;
  isLate: boolean;
}

export interface DashboardData {
  summary: DashboardSummary;
  actionableItems: ActionableItem[];
}

// Reports
export interface ReportsOverview {
  overdueCount: number;
  dueSoonCount: number;
  overallCompletionPercent: number;
  totalItems: number;
  completedItems: number;
}

export interface SupplierProgress {
  supplierId: number;
  supplierName: string;
  totalItems: number;
  completedItems: number;
  overdueItems: number;
  progressPercent: number;
  status: 'On Track' | 'At Risk' | 'Behind';
}

export interface ProjectProgress {
  projectId: number;
  projectName: string;
  projectVersion: string;
  supplierCount: number;
  totalItems: number;
  completedItems: number;
  overdueItems: number;
  progressPercent: number;
  status: 'On Track' | 'At Risk' | 'Behind';
}

export interface ReportScheduleItem {
  supplierScheduleItemInstanceId: number;
  dueDate: string | null;
  supplierId: number;
  supplierName: string;
  projectId: number;
  projectName: string;
  activityName: string;
  itemName: string;
  itemKind: ScheduleItemKind;
  status: ActivityStatus;
  daysUntilDue: number;
}

// Supplier list with stats
export interface SupplierWithStats extends Supplier {
  activeProjects: number;
  overdueCount: number;
  dueSoonCount: number;
  status: 'On Track' | 'At Risk' | 'Behind';
}

// Project list with stats
export interface ProjectWithStats extends Project {
  activityCount: number;
  supplierCount: number;
  nextDue: string | null;
  nextDueDate: string | null; // alias for nextDue
  lastUpdated: string | null;
}

// Activity template with counts
export interface ActivityTemplateWithCounts extends ActivityTemplate {
  category: string | null;
  updatedAt: string | null;
  milestoneCount: number;
  taskCount: number;
}

// Supplier project with progress stats
export interface SupplierProjectWithProgress extends SupplierProjectSummary {
  activityName: string | null;
  totalItems: number;
  completedItems: number;
  overdueItems: number;
  overdueCount: number; // alias for overdueItems
  progressPercent: number;
  nextDue: string | null;
  nextDueDate: string | null; // alias for nextDue
  status: 'On Track' | 'At Risk' | 'Behind';
}

// ============================================================================
// Import/Export Types
// ============================================================================

export type ExportScope = 'full' | 'selective';

export interface ExportMetadata {
  version: string;
  exportedAt: string;
  source: string;
  scope: ExportScope;
}

export interface ExportedScheduleItem {
  id?: number; // Database ID for re-import matching
  name: string;
  kind: ScheduleItemKind;
  anchorType: AnchorType;
  offsetDays: number | null;
  anchorRef: string | null; // Name of anchor schedule item
  fixedDate?: string | null;
  sortOrder?: number;
  overrideDate?: string | null;
  overrideEnabled?: boolean;
}

export interface ExportedActivityTemplate {
  id?: number; // Database ID for re-import matching
  name: string;
  description: string | null;
  category: string | null;
  scheduleItems: ExportedScheduleItem[];
  applicabilityRules: {
    operator: ApplicabilityOperator;
    enabled: boolean;
    clauses: Array<{
      subjectType: ApplicabilitySubject;
      comparator: ApplicabilityComparator;
      value: string;
    }>;
  } | null;
}

export interface ExportedProjectActivity {
  id?: number; // Database ID for re-import matching
  activityTemplateName: string;
  sortOrder: number;
  scheduleItems: ExportedScheduleItem[];
  dependencies: string[]; // Array of activity template names
}

export interface ExportedProject {
  id?: number; // Database ID for re-import matching
  name: string;
  version: string;
  activities: ExportedProjectActivity[];
}

export interface ExportedSupplierScheduleItemInstance {
  id?: number; // Database ID for re-import matching
  name: string;
  plannedDate: string | null;
  actualDate: string | null;
  status: ActivityStatus;
  plannedDateOverride: boolean;
  scopeOverride: ScopeOverride;
  locked: boolean;
}

export interface ExportedSupplierActivityInstance {
  id?: number; // Database ID for re-import matching
  activityTemplateName: string;
  status: ActivityStatus;
  scopeOverride: ScopeOverride;
  scheduleItems: ExportedSupplierScheduleItemInstance[];
  attachments: Array<{
    label: string | null;
    url: string;
  }>;
}

export interface ExportedPart {
  id?: number; // Database ID for re-import matching
  supplierNumber: string;
  locationCode: string;
  partNumber: string;
  description: string | null;
  paRank: string | null;
  notes: string | null;
}

export interface ExportedSupplierProject {
  id?: number; // Database ID for re-import matching
  projectName: string;
  projectVersion: string;
  nmrRank: string | null;
  activities: ExportedSupplierActivityInstance[];
  parts: ExportedPart[];
}

export interface ExportedSupplierLocationCode {
  id?: number; // Database ID for re-import matching
  supplierNumber: string;
  locationCode: string;
}

export interface ExportedSupplier {
  id?: number; // Database ID for re-import matching
  name: string;
  notes: string | null;
  locationCodes: ExportedSupplierLocationCode[];
  projects: ExportedSupplierProject[];
}

export interface ExportedSettings {
  nmrRanks: string[];
  paRanks: string[];
  propagationSkipComplete: boolean;
  propagationSkipLocked: boolean;
  propagationSkipOverridden: boolean;
  dateFormat: string;
  useBusinessDays: boolean;
}

export interface ExportedData {
  exportMetadata: ExportMetadata;
  activityTemplates?: ExportedActivityTemplate[];
  projects?: ExportedProject[];
  suppliers?: ExportedSupplier[];
  settings?: ExportedSettings;
}

export type MatchStatus = 'NEW' | 'UNCHANGED' | 'MODIFIED' | 'CONFLICT';

export interface MatchResult {
  matchKey: string;
  status: MatchStatus;
  entityType: string;
  existingId?: number;
  incomingData: any;
  existingData?: any;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  errors?: string[];
}

export interface ImportAnalysis {
  summary: {
    [entityType: string]: {
      new: number;
      modified: number;
      unchanged: number;
      errors: number;
    };
  };
  matches: MatchResult[];
}

export interface ExportOptions {
  scope: ExportScope;
  activityTemplateIds?: number[];
  projectIds?: number[];
  supplierIds?: number[];
  includeScheduleInstances: boolean;
  includeAttachments: boolean;
  includeSettings: boolean;
}
