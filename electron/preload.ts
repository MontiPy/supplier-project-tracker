import { contextBridge, ipcRenderer } from 'electron';
import type {
  Supplier,
  SupplierLocationCode,
  ActivityTemplate,
  Project,
  ProjectActivity,
  ProjectScheduleItem,
  CreateSupplierParams,
  UpdateSupplierParams,
  CreateSupplierLocationCodeParams,
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
  ActivityTemplateApplicability,
  ActivityTemplateApplicabilityRule,
  ActivityTemplateApplicabilityClause,
  UpsertActivityTemplateApplicabilityRuleParams,
  CreateActivityTemplateApplicabilityClauseParams,
  UpdateActivityTemplateApplicabilityClauseParams,
  SyncProjectActivityFromTemplateParams,
  UpdateSupplierActivityInstanceParams,
  UpdateSupplierScheduleItemInstanceParams,
  CreateSupplierActivityAttachmentParams,
  ProjectActivityDetail,
  ProjectDetail,
  ScheduleItemWithDates,
  ActivityTemplateScheduleItem,
  SupplierProject,
  SupplierProjectDetail,
  SupplierProjectSummary,
  SupplierActivityInstance,
  SupplierScheduleItemInstance,
  SupplierActivityAttachment,
  Part,
  CreatePartParams,
  UpdatePartParams,
  PropagationPreview,
  PropagationResult,
  AuditEvent,
  AuditEventQuery,
  APIResponse,
  // Phase 5: Settings, Dashboard, Reports
  FileDialogResult,
  AppSettings,
  UpdateSettingParams,
  DashboardFilters,
  DashboardData,
  ReportsOverview,
  SupplierProgress,
  ProjectProgress,
  ReportScheduleItem,
  SupplierWithStats,
  ProjectWithStats,
  ActivityTemplateWithCounts,
  SupplierProjectWithProgress,
  ExportOptions,
  ExportedData,
  ImportAnalysis,
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
  supplierLocationCodes: {
    list: (supplierId: number): Promise<APIResponse<SupplierLocationCode[]>> =>
      ipcRenderer.invoke('supplier-location-codes:list', supplierId),
    create: (
      params: CreateSupplierLocationCodeParams
    ): Promise<APIResponse<SupplierLocationCode>> =>
      ipcRenderer.invoke('supplier-location-codes:create', params),
    delete: (id: number): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('supplier-location-codes:delete', id),
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
    applicability: {
      get: (activityTemplateId: number): Promise<APIResponse<ActivityTemplateApplicability>> =>
        ipcRenderer.invoke('activity-template-applicability:get', activityTemplateId),
      upsertRule: (
        params: UpsertActivityTemplateApplicabilityRuleParams
      ): Promise<APIResponse<ActivityTemplateApplicabilityRule>> =>
        ipcRenderer.invoke('activity-template-applicability:upsert-rule', params),
      deleteRule: (id: number): Promise<APIResponse<void>> =>
        ipcRenderer.invoke('activity-template-applicability:delete-rule', id),
      createClause: (
        params: CreateActivityTemplateApplicabilityClauseParams
      ): Promise<APIResponse<ActivityTemplateApplicabilityClause>> =>
        ipcRenderer.invoke('activity-template-applicability:create-clause', params),
      updateClause: (
        params: UpdateActivityTemplateApplicabilityClauseParams
      ): Promise<APIResponse<ActivityTemplateApplicabilityClause>> =>
        ipcRenderer.invoke('activity-template-applicability:update-clause', params),
      deleteClause: (id: number): Promise<APIResponse<void>> =>
        ipcRenderer.invoke('activity-template-applicability:delete-clause', id),
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

  supplierActivityAttachments: {
    list: (supplierActivityInstanceId: number): Promise<APIResponse<SupplierActivityAttachment[]>> =>
      ipcRenderer.invoke('supplier-activity-attachments:list', supplierActivityInstanceId),
    create: (
      params: CreateSupplierActivityAttachmentParams
    ): Promise<APIResponse<SupplierActivityAttachment>> =>
      ipcRenderer.invoke('supplier-activity-attachments:create', params),
    delete: (id: number): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('supplier-activity-attachments:delete', id),
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

  // Import/Export API
  exportData: {
    generateJson: (options: ExportOptions): Promise<APIResponse<ExportedData>> =>
      ipcRenderer.invoke('export:generate-json', options),
    saveToFile: (options: ExportOptions): Promise<APIResponse<string>> =>
      ipcRenderer.invoke('export:save-to-file', options),
    fullDatabase: (): Promise<APIResponse<string>> =>
      ipcRenderer.invoke('export:full-database'),
  },
  importData: {
    selectFile: (): Promise<APIResponse<string | null>> =>
      ipcRenderer.invoke('import:select-file'),
    parseFile: (filePath: string): Promise<APIResponse<any>> =>
      ipcRenderer.invoke('import:parse-file', filePath),
    analyze: (data: ExportedData): Promise<APIResponse<ImportAnalysis>> =>
      ipcRenderer.invoke('import:analyze', data),
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
    exportDatabase: (): Promise<APIResponse<FileDialogResult>> =>
      ipcRenderer.invoke('settings:export-database'),
    importDatabase: (): Promise<APIResponse<FileDialogResult>> =>
      ipcRenderer.invoke('settings:import-database'),
    wipeDatabase: (): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('settings:wipe-database'),
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
    getProjectProgress: (): Promise<APIResponse<ProjectProgress[]>> =>
      ipcRenderer.invoke('reports:get-project-progress'),
    getOverdueItems: (): Promise<APIResponse<ReportScheduleItem[]>> =>
      ipcRenderer.invoke('reports:get-overdue-items'),
    getDueSoonItems: (): Promise<APIResponse<ReportScheduleItem[]>> =>
      ipcRenderer.invoke('reports:get-due-soon-items'),
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
  supplierLocationCodes: {
    list: (supplierId: number) => Promise<APIResponse<SupplierLocationCode[]>>;
    create: (params: CreateSupplierLocationCodeParams) => Promise<APIResponse<SupplierLocationCode>>;
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
    applicability: {
      get: (activityTemplateId: number) => Promise<APIResponse<ActivityTemplateApplicability>>;
      upsertRule: (
        params: UpsertActivityTemplateApplicabilityRuleParams
      ) => Promise<APIResponse<ActivityTemplateApplicabilityRule>>;
      deleteRule: (id: number) => Promise<APIResponse<void>>;
      createClause: (
        params: CreateActivityTemplateApplicabilityClauseParams
      ) => Promise<APIResponse<ActivityTemplateApplicabilityClause>>;
      updateClause: (
        params: UpdateActivityTemplateApplicabilityClauseParams
      ) => Promise<APIResponse<ActivityTemplateApplicabilityClause>>;
      deleteClause: (id: number) => Promise<APIResponse<void>>;
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
  supplierActivityAttachments: {
    list: (supplierActivityInstanceId: number) => Promise<APIResponse<SupplierActivityAttachment[]>>;
    create: (
      params: CreateSupplierActivityAttachmentParams
    ) => Promise<APIResponse<SupplierActivityAttachment>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  parts: {
    list: (supplierProjectId: number) => Promise<APIResponse<Part[]>>;
    create: (params: CreatePartParams) => Promise<APIResponse<Part>>;
    update: (params: UpdatePartParams) => Promise<APIResponse<Part>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  exportData: {
    generateJson: (options: ExportOptions) => Promise<APIResponse<ExportedData>>;
    saveToFile: (options: ExportOptions) => Promise<APIResponse<string>>;
    fullDatabase: () => Promise<APIResponse<string>>;
  };
  importData: {
    selectFile: () => Promise<APIResponse<string | null>>;
    parseFile: (filePath: string) => Promise<APIResponse<any>>;
    analyze: (data: ExportedData) => Promise<APIResponse<ImportAnalysis>>;
  };
  audit: {
    list: (params: AuditEventQuery) => Promise<APIResponse<AuditEvent[]>>;
  };
  settings: {
    getAll: () => Promise<APIResponse<AppSettings>>;
    update: (params: UpdateSettingParams) => Promise<APIResponse<void>>;
    exportDatabase: () => Promise<APIResponse<FileDialogResult>>;
    importDatabase: () => Promise<APIResponse<FileDialogResult>>;
    wipeDatabase: () => Promise<APIResponse<void>>;
  };
  dashboard: {
    getData: (filters: DashboardFilters) => Promise<APIResponse<DashboardData>>;
  };
  reports: {
    getOverview: () => Promise<APIResponse<ReportsOverview>>;
    getSupplierProgress: () => Promise<APIResponse<SupplierProgress[]>>;
    getProjectProgress: () => Promise<APIResponse<ProjectProgress[]>>;
    getOverdueItems: () => Promise<APIResponse<ReportScheduleItem[]>>;
    getDueSoonItems: () => Promise<APIResponse<ReportScheduleItem[]>>;
  };
}

declare global {
  interface Window {
    sqts: SQTSAPI;
  }
}
