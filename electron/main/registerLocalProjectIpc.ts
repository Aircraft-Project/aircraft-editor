import { ipcMain, safeStorage } from "electron";
import path from "node:path";
import { LOCAL_PROJECT_CHANNELS } from "../shared/localProjectIpc";
import { AtomicFileStore } from "../storage/AtomicFileStore";
import { KeyManager } from "../storage/KeyManager";
import { LocalProjectFileStore } from "../storage/LocalProjectFileStore";

export function registerLocalProjectIpc(userDataPath: string): void {
  const files = new AtomicFileStore();
  const rootPath = path.join(userDataPath, "local-projects");
  const keys = new KeyManager(rootPath, safeStorage, files);
  const store = new LocalProjectFileStore(rootPath, keys, files);

  ipcMain.handle(LOCAL_PROJECT_CHANNELS.list, (_event, ownerId: unknown) =>
    store.listByOwner(requireString(ownerId)),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.create, (_event, input: unknown) =>
    store.create(input),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.load, (_event, request: unknown) => {
    const data = requireRecord(request);
    return store.load(
      requireString(data.ownerId),
      requireString(data.projectId),
    );
  });
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.saveMetadata, (_event, request: unknown) =>
    store.saveMetadata(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.saveScreen, (_event, request: unknown) =>
    store.saveScreen(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.deleteScreen, (_event, request: unknown) =>
    store.deleteScreen(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.saveLayout, (_event, request: unknown) =>
    store.saveLayout(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.saveTriggerGraphs, (_event, request: unknown) =>
    store.saveTriggerGraphs(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.saveSettings, (_event, request: unknown) =>
    store.saveSettings(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.deleteProject, (_event, request: unknown) =>
    store.deleteProject(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.listResources, (_event, request: unknown) =>
    store.listResources(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.putResource, (_event, request: unknown) =>
    store.putResource(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.readResource, (_event, request: unknown) =>
    store.readResource(request),
  );
  ipcMain.handle(LOCAL_PROJECT_CHANNELS.deleteResource, (_event, request: unknown) =>
    store.deleteResource(request),
  );
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid local project request.");
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new Error("Invalid local project request.");
  }
  return value;
}
