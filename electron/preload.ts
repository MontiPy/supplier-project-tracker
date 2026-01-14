import { contextBridge, ipcRenderer } from 'electron';
import type {
  Supplier,
  ActivityTemplate,
  Project,
  ProjectActivity,
  ProjectScheduleItem,
  CreateSupplierParams,
  UpdateSupplierParams,
  CreateActivityTemplateParams,
  UpdateActivityTemplateParams,
  CreateProjectParams,
  UpdateProjectParams,
  ApplySupplierProjectParams,
  UpdateSupplierProjectParams,
  CreateProjectActivityParams,
  UpdateProjectActivityParams,
  CreateScheduleItemParams,
  UpdateScheduleItemParams,
  CreateActivityTemplateScheduleItemParams,
  UpdateActivityTemplateScheduleItemParams,
  SyncProjectActivityFromTemplateParams,
  UpdateSupplierActivityInstanceParams,
  UpdateSupplierScheduleItemInstanceParams,
  ProjectActivityDetail,
  ProjectDetail,
  ScheduleItemWithDates,
  ActivityTemplateScheduleItem,
  SupplierProject,
  SupplierProjectDetail,
  SupplierProjectSummary,
  SupplierActivityInstance,
  SupplierScheduleItemInstance,
  Part,
  CreatePartParams,
  UpdatePartParams,
  PropagationPreview,
  PropagationResult,
  AuditEvent,
  AuditEventQuery,
  APIResponse,
  // Phase 5: Settings, Dashboard, Reports
  AppSettings,
  UpdateSettingParams,
  DashboardFilters,
  DashboardData,
  ReportsOverview,
  SupplierProgress,
  SupplierWithStats,
  ProjectWithStats,
  ActivityTemplateWithCounts,
  SupplierProjectWithProgress,
} from '../shared/types.js';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('sqts', {
  // Version info
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
  },

  // Suppliers API
  suppliers: {
    list: (): Promise<APIResponse<Supplier[]>> => ipcRenderer.invoke('suppliers:list'),
    listWithStats: (): Promise<APIResponse<SupplierWithStats[]>> =>
      ipcRenderer.invoke('suppliers:list-with-stats'),
    get: (id: number): Promise<APIResponse<Supplier>> => ipcRenderer.invoke('suppliers:get', id),
    create: (params: CreateSupplierParams): Promise<APIResponse<Supplier>> =>
      ipcRenderer.invoke('suppliers:create', params),
    update: (params: UpdateSupplierParams): Promise<APIResponse<Supplier>> =>
      ipcRenderer.invoke('suppliers:update', params),
    delete: (id: number): Promise<APIResponse<void>> => ipcRenderer.invoke('suppliers:delete', id),
  },

  // Activity Templates API
  activityTemplates: {
    list: (): Promise<APIResponse<ActivityTemplate[]>> =>
      ipcRenderer.invoke('activity-templates:list'),
    listWithCounts: (): Promise<APIResponse<ActivityTemplateWithCounts[]>> =>
      ipcRenderer.invoke('activity-templates:list-with-counts'),
    get: (id: number): Promise<APIResponse<ActivityTemplate>> =>
      ipcRenderer.invoke('activity-templates:get', id),
    create: (params: CreateActivityTemplateParams): Promise<APIResponse<ActivityTemplate>> =>
      ipcRenderer.invoke('activity-templates:create', params),
    update: (params: UpdateActivityTemplateParams): Promise<APIResponse<ActivityTemplate>> =>
      ipcRenderer.invoke('activity-templates:update', params),
    delete: (id: number): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('activity-templates:delete', id),
    duplicate: (id: number): Promise<APIResponse<ActivityTemplate>> =>
      ipcRenderer.invoke('activity-templates:duplicate', id),
    scheduleItems: {
      list: (activityTemplateId: number): Promise<APIResponse<ActivityTemplateScheduleItem[]>> =>
        ipcRenderer.invoke('activity-template-schedule-items:list', activityTemplateId),
      create: (
        params: CreateActivityTemplateScheduleItemParams
      ): Promise<APIResponse<ActivityTemplateScheduleItem>> =>
        ipcRenderer.invoke('activity-template-schedule-items:create', params),
      update: (
        params: UpdateActivityTemplateScheduleItemParams
      ): Promise<APIResponse<ActivityTemplateScheduleItem>> =>
        ipcRenderer.invoke('activity-template-schedule-items:update', params),
      delete: (id: number): Promise<APIResponse<void>> =>
        ipcRenderer.invoke('activity-template-schedule-items:delete', id),
    },
  },

  // Projects API
  projects: {
    list: (): Promise<APIResponse<Project[]>> => ipcRenderer.invoke('projects:list'),
    listWithStats: (): Promise<APIResponse<ProjectWithStats[]>> =>
      ipcRenderer.invoke('projects:list-with-stats'),
    get: (id: number): Promise<APIResponse<Project>> => ipcRenderer.invoke('projects:get', id),
    getDetail: (id: number): Promise<APIResponse<ProjectDetail>> =>
      ipcRenderer.invoke('projects:get-detail', id),
    create: (params: CreateProjectParams): Promise<APIResponse<Project>> =>
      ipcRenderer.invoke('projects:create', params),
    update: (params: UpdateProjectParams): Promise<APIResponse<Project>> =>
      ipcRenderer.invoke('projects:update', params),
    delete: (id: number): Promise<APIResponse<void>> => ipcRenderer.invoke('projects:delete', id),
    previewPropagation: (projectId: number): Promise<APIResponse<PropagationPreview>> =>
      ipcRenderer.invoke('projects:preview-propagation', projectId),
    propagateChanges: (projectId: number): Promise<APIResponse<PropagationResult>> =>
      ipcRenderer.invoke('projects:propagate-changes', projectId),
  },

  // Project Activities API
  projectActivities: {
    list: (projectId: number): Promise<APIResponse<ProjectActivity[]>> =>
      ipcRenderer.invoke('project-activities:list', projectId),
    get: (id: number): Promise<APIResponse<ProjectActivityDetail>> =>
      ipcRenderer.invoke('project-activities:get', id),
    create: (params: CreateProjectActivityParams): Promise<APIResponse<ProjectActivity>> =>
      ipcRenderer.invoke('project-activities:create', params),
    update: (params: UpdateProjectActivityParams): Promise<APIResponse<ProjectActivity>> =>
      ipcRenderer.invoke('project-activities:update', params),
    delete: (id: number): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('project-activities:delete', id),
    syncFromTemplate: (
      params: SyncProjectActivityFromTemplateParams
    ): Promise<APIResponse<ProjectActivity>> =>
      ipcRenderer.invoke('project-activities:sync-from-template', params),
  },

  // Schedule Items API
  scheduleItems: {
    list: (projectActivityId: number): Promise<APIResponse<ScheduleItemWithDates[]>> =>
      ipcRenderer.invoke('schedule-items:list', projectActivityId),
    get: (id: number): Promise<APIResponse<ProjectScheduleItem>> =>
      ipcRenderer.invoke('schedule-items:get', id),
    create: (params: CreateScheduleItemParams): Promise<APIResponse<ProjectScheduleItem>> =>
      ipcRenderer.invoke('schedule-items:create', params),
    update: (params: UpdateScheduleItemParams): Promise<APIResponse<ProjectScheduleItem>> =>
      ipcRenderer.invoke('schedule-items:update', params),
    delete: (id: number): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('schedule-items:delete', id),
  },

  supplierProjects: {
    list: (): Promise<APIResponse<SupplierProjectSummary[]>> =>
      ipcRenderer.invoke('supplier-projects:list'),
    listBySupplier: (supplierId: number): Promise<APIResponse<SupplierProjectSummary[]>> =>
      ipcRenderer.invoke('supplier-projects:list-by-supplier', supplierId),
    listBySupplierWithProgress: (supplierId: number): Promise<APIResponse<SupplierProjectWithProgress[]>> =>
      ipcRenderer.invoke('supplier-projects:list-by-supplier-with-progress', supplierId),
    getDetail: (id: number): Promise<APIResponse<SupplierProjectDetail>> =>
      ipcRenderer.invoke('supplier-projects:get-detail', id),
    apply: (params: ApplySupplierProjectParams): Promise<APIResponse<SupplierProject>> =>
      ipcRenderer.invoke('supplier-projects:apply', params),
    update: (params: UpdateSupplierProjectParams): Promise<APIResponse<SupplierProject>> =>
      ipcRenderer.invoke('supplier-projects:update', params),
  },

  supplierActivityInstances: {
    update: (
      params: UpdateSupplierActivityInstanceParams
    ): Promise<APIResponse<SupplierActivityInstance>> =>
      ipcRenderer.invoke('supplier-activity-instances:update', params),
  },

  supplierScheduleItemInstances: {
    update: (
      params: UpdateSupplierScheduleItemInstanceParams
    ): Promise<APIResponse<SupplierScheduleItemInstance>> =>
      ipcRenderer.invoke('supplier-schedule-item-instances:update', params),
  },

  parts: {
    list: (supplierProjectId: number): Promise<APIResponse<Part[]>> =>
      ipcRenderer.invoke('parts:list', supplierProjectId),
    create: (params: CreatePartParams): Promise<APIResponse<Part>> =>
      ipcRenderer.invoke('parts:create', params),
    update: (params: UpdatePartParams): Promise<APIResponse<Part>> =>
      ipcRenderer.invoke('parts:update', params),
    delete: (id: number): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('parts:delete', id),
  },

  // Audit API (Phase 4)
  audit: {
    list: (params: AuditEventQuery): Promise<APIResponse<AuditEvent[]>> =>
      ipcRenderer.invoke('audit:list', params),
  },

  // Settings API (Phase 5)
  settings: {
    getAll: (): Promise<APIResponse<AppSettings>> => ipcRenderer.invoke('settings:get-all'),
    update: (params: UpdateSettingParams): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('settings:update', params),
  },

  // Dashboard API (Phase 5)
  dashboard: {
    getData: (filters: DashboardFilters): Promise<APIResponse<DashboardData>> =>
      ipcRenderer.invoke('dashboard:get-data', filters),
  },

  // Reports API (Phase 5)
  reports: {
    getOverview: (): Promise<APIResponse<ReportsOverview>> =>
      ipcRenderer.invoke('reports:get-overview'),
    getSupplierProgress: (): Promise<APIResponse<SupplierProgress[]>> =>
      ipcRenderer.invoke('reports:get-supplier-progress'),
  },
});

// Type definition for TypeScript support
export interface SQTSAPI {
  versions: {
    node: () => string;
    chrome: () => string;
    electron: () => string;
  };
  suppliers: {
    list: () => Promise<APIResponse<Supplier[]>>;
    listWithStats: () => Promise<APIResponse<SupplierWithStats[]>>;
    get: (id: number) => Promise<APIResponse<Supplier>>;
    create: (params: CreateSupplierParams) => Promise<APIResponse<Supplier>>;
    update: (params: UpdateSupplierParams) => Promise<APIResponse<Supplier>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  activityTemplates: {
    list: () => Promise<APIResponse<ActivityTemplate[]>>;
    listWithCounts: () => Promise<APIResponse<ActivityTemplateWithCounts[]>>;
    get: (id: number) => Promise<APIResponse<ActivityTemplate>>;
    create: (params: CreateActivityTemplateParams) => Promise<APIResponse<ActivityTemplate>>;
    update: (params: UpdateActivityTemplateParams) => Promise<APIResponse<ActivityTemplate>>;
    delete: (id: number) => Promise<APIResponse<void>>;
    duplicate: (id: number) => Promise<APIResponse<ActivityTemplate>>;
    scheduleItems: {
      list: (activityTemplateId: number) => Promise<APIResponse<ActivityTemplateScheduleItem[]>>;
      create: (
        params: CreateActivityTemplateScheduleItemParams
      ) => Promise<APIResponse<ActivityTemplateScheduleItem>>;
      update: (
        params: UpdateActivityTemplateScheduleItemParams
      ) => Promise<APIResponse<ActivityTemplateScheduleItem>>;
      delete: (id: number) => Promise<APIResponse<void>>;
    };
  };
  projects: {
    list: () => Promise<APIResponse<Project[]>>;
    listWithStats: () => Promise<APIResponse<ProjectWithStats[]>>;
    get: (id: number) => Promise<APIResponse<Project>>;
    getDetail: (id: number) => Promise<APIResponse<ProjectDetail>>;
    create: (params: CreateProjectParams) => Promise<APIResponse<Project>>;
    update: (params: UpdateProjectParams) => Promise<APIResponse<Project>>;
    delete: (id: number) => Promise<APIResponse<void>>;
    previewPropagation: (projectId: number) => Promise<APIResponse<PropagationPreview>>;
    propagateChanges: (projectId: number) => Promise<APIResponse<PropagationResult>>;
  };
  projectActivities: {
    list: (projectId: number) => Promise<APIResponse<ProjectActivity[]>>;
    get: (id: number) => Promise<APIResponse<ProjectActivityDetail>>;
    create: (params: CreateProjectActivityParams) => Promise<APIResponse<ProjectActivity>>;
    update: (params: UpdateProjectActivityParams) => Promise<APIResponse<ProjectActivity>>;
    delete: (id: number) => Promise<APIResponse<void>>;
    syncFromTemplate: (
      params: SyncProjectActivityFromTemplateParams
    ) => Promise<APIResponse<ProjectActivity>>;
  };
  scheduleItems: {
    list: (projectActivityId: number) => Promise<APIResponse<ScheduleItemWithDates[]>>;
    get: (id: number) => Promise<APIResponse<ProjectScheduleItem>>;
    create: (params: CreateScheduleItemParams) => Promise<APIResponse<ProjectScheduleItem>>;
    update: (params: UpdateScheduleItemParams) => Promise<APIResponse<ProjectScheduleItem>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  supplierProjects: {
    list: () => Promise<APIResponse<SupplierProjectSummary[]>>;
    listBySupplier: (supplierId: number) => Promise<APIResponse<SupplierProjectSummary[]>>;
    listBySupplierWithProgress: (supplierId: number) => Promise<APIResponse<SupplierProjectWithProgress[]>>;
    getDetail: (id: number) => Promise<APIResponse<SupplierProjectDetail>>;
    apply: (params: ApplySupplierProjectParams) => Promise<APIResponse<SupplierProject>>;
    update: (params: UpdateSupplierProjectParams) => Promise<APIResponse<SupplierProject>>;
  };
  supplierActivityInstances: {
    update: (
      params: UpdateSupplierActivityInstanceParams
    ) => Promise<APIResponse<SupplierActivityInstance>>;
  };
  supplierScheduleItemInstances: {
    update: (
      params: UpdateSupplierScheduleItemInstanceParams
    ) => Promise<APIResponse<SupplierScheduleItemInstance>>;
  };
  parts: {
    list: (supplierProjectId: number) => Promise<APIResponse<Part[]>>;
    create: (params: CreatePartParams) => Promise<APIResponse<Part>>;
    update: (params: UpdatePartParams) => Promise<APIResponse<Part>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  audit: {
    list: (params: AuditEventQuery) => Promise<APIResponse<AuditEvent[]>>;
  };
  settings: {
    getAll: () => Promise<APIResponse<AppSettings>>;
    update: (params: UpdateSettingParams) => Promise<APIResponse<void>>;
  };
  dashboard: {
    getData: (filters: DashboardFilters) => Promise<APIResponse<DashboardData>>;
  };
  reports: {
    getOverview: () => Promise<APIResponse<ReportsOverview>>;
    getSupplierProgress: () => Promise<APIResponse<SupplierProgress[]>>;
  };
}

declare global {
  interface Window {
    sqts: SQTSAPI;
  }
}
