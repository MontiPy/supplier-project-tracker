// Shared TypeScript type definitions for Supplier-Project-Activity Tracking App
// Used by both Electron main process and React renderer

// ============================================================================
// Core Entities
// ============================================================================

export interface Supplier {
  id: number;
  name: string;
  nmrRank: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ActivityTemplate {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Project {
  id: number;
  name: string;
  version: string;
  defaultAnchorRule: string | null;
  createdAt: string;
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
  | 'PROJECT_ANCHOR'
  | 'SUPPLIER_ANCHOR'
  | 'SCHEDULE_ITEM'
  | 'COMPLETION';

export interface ProjectScheduleItem {
  id: number;
  projectActivityId: number;
  kind: ScheduleItemKind;
  name: string;
  anchorType: AnchorType;
  anchorRefId: number | null;
  offsetDays: number | null;
  fixedDate: string | null;
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
  supplierAnchorDate: string | null;
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

// ============================================================================
// Parts
// ============================================================================

export interface Part {
  id: number;
  supplierProjectId: number;
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
  createdAt: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

// Supplier operations
export interface CreateSupplierParams {
  name: string;
  nmrRank?: string;
  notes?: string;
}

export interface UpdateSupplierParams {
  id: number;
  name?: string;
  nmrRank?: string;
  notes?: string;
}

// Activity Template operations
export interface CreateActivityTemplateParams {
  name: string;
  description?: string;
}

export interface UpdateActivityTemplateParams {
  id: number;
  name?: string;
  description?: string;
}

// Project operations
export interface CreateProjectParams {
  name: string;
  version: string;
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
  fixedDate?: string; // YYYY-MM-DD
  sortOrder?: number;
}

export interface UpdateScheduleItemParams {
  id: number;
  name?: string;
  anchorType?: AnchorType;
  anchorRefId?: number;
  offsetDays?: number;
  fixedDate?: string; // YYYY-MM-DD
  sortOrder?: number;
}

// Computed schedule results
export interface ScheduleItemWithDates extends ProjectScheduleItem {
  plannedDate: string | null; // computed from anchor rules
  error?: string; // if date computation fails
}

export interface ProjectActivityDetail extends ProjectActivity {
  activityTemplateName: string;
  scheduleItems: ScheduleItemWithDates[];
}

export interface ProjectDetail extends Project {
  activities: ProjectActivityDetail[];
}

// Generic API Response
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
