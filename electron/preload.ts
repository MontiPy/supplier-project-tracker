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
  CreateProjectActivityParams,
  UpdateProjectActivityParams,
  CreateScheduleItemParams,
  UpdateScheduleItemParams,
  ProjectActivityDetail,
  ProjectDetail,
  ScheduleItemWithDates,
  APIResponse,
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
    get: (id: number): Promise<APIResponse<ActivityTemplate>> =>
      ipcRenderer.invoke('activity-templates:get', id),
    create: (params: CreateActivityTemplateParams): Promise<APIResponse<ActivityTemplate>> =>
      ipcRenderer.invoke('activity-templates:create', params),
    update: (params: UpdateActivityTemplateParams): Promise<APIResponse<ActivityTemplate>> =>
      ipcRenderer.invoke('activity-templates:update', params),
    delete: (id: number): Promise<APIResponse<void>> =>
      ipcRenderer.invoke('activity-templates:delete', id),
  },

  // Projects API
  projects: {
    list: (): Promise<APIResponse<Project[]>> => ipcRenderer.invoke('projects:list'),
    get: (id: number): Promise<APIResponse<Project>> => ipcRenderer.invoke('projects:get', id),
    getDetail: (id: number): Promise<APIResponse<ProjectDetail>> =>
      ipcRenderer.invoke('projects:get-detail', id),
    create: (params: CreateProjectParams): Promise<APIResponse<Project>> =>
      ipcRenderer.invoke('projects:create', params),
    update: (params: UpdateProjectParams): Promise<APIResponse<Project>> =>
      ipcRenderer.invoke('projects:update', params),
    delete: (id: number): Promise<APIResponse<void>> => ipcRenderer.invoke('projects:delete', id),
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
    get: (id: number) => Promise<APIResponse<Supplier>>;
    create: (params: CreateSupplierParams) => Promise<APIResponse<Supplier>>;
    update: (params: UpdateSupplierParams) => Promise<APIResponse<Supplier>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  activityTemplates: {
    list: () => Promise<APIResponse<ActivityTemplate[]>>;
    get: (id: number) => Promise<APIResponse<ActivityTemplate>>;
    create: (params: CreateActivityTemplateParams) => Promise<APIResponse<ActivityTemplate>>;
    update: (params: UpdateActivityTemplateParams) => Promise<APIResponse<ActivityTemplate>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  projects: {
    list: () => Promise<APIResponse<Project[]>>;
    get: (id: number) => Promise<APIResponse<Project>>;
    getDetail: (id: number) => Promise<APIResponse<ProjectDetail>>;
    create: (params: CreateProjectParams) => Promise<APIResponse<Project>>;
    update: (params: UpdateProjectParams) => Promise<APIResponse<Project>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  projectActivities: {
    list: (projectId: number) => Promise<APIResponse<ProjectActivity[]>>;
    get: (id: number) => Promise<APIResponse<ProjectActivityDetail>>;
    create: (params: CreateProjectActivityParams) => Promise<APIResponse<ProjectActivity>>;
    update: (params: UpdateProjectActivityParams) => Promise<APIResponse<ProjectActivity>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
  scheduleItems: {
    list: (projectActivityId: number) => Promise<APIResponse<ScheduleItemWithDates[]>>;
    get: (id: number) => Promise<APIResponse<ProjectScheduleItem>>;
    create: (params: CreateScheduleItemParams) => Promise<APIResponse<ProjectScheduleItem>>;
    update: (params: UpdateScheduleItemParams) => Promise<APIResponse<ProjectScheduleItem>>;
    delete: (id: number) => Promise<APIResponse<void>>;
  };
}

declare global {
  interface Window {
    sqts: SQTSAPI;
  }
}
