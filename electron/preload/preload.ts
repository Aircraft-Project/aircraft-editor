import { contextBridge, ipcRenderer } from "electron";
import {
  LOCAL_PROJECT_CHANNELS,
  type AircraftDesktopApi,
} from "../shared/localProjectIpc";

const api: AircraftDesktopApi = {
  localProjects: {
    list: (ownerId) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.list, ownerId),
    create: (input) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.create, input),
    load: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.load, request),
    saveMetadata: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.saveMetadata, request),
    saveScreen: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.saveScreen, request),
    deleteScreen: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.deleteScreen, request),
    saveLayout: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.saveLayout, request),
    saveTriggerGraphs: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.saveTriggerGraphs, request),
    saveSettings: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.saveSettings, request),
    deleteProject: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.deleteProject, request),
  },
  resources: {
    list: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.listResources, request),
    put: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.putResource, request),
    read: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.readResource, request),
    delete: (request) =>
      ipcRenderer.invoke(LOCAL_PROJECT_CHANNELS.deleteResource, request),
  },
};

contextBridge.exposeInMainWorld("aircraftDesktop", api);
