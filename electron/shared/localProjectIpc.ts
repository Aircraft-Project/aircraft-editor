export const LOCAL_PROJECT_CHANNELS = {
  list: "aircraft:local-projects:list",
  create: "aircraft:local-projects:create",
  load: "aircraft:local-projects:load",
  saveMetadata: "aircraft:local-projects:save-metadata",
  saveScreen: "aircraft:local-projects:save-screen",
  deleteScreen: "aircraft:local-projects:delete-screen",
  saveLayout: "aircraft:local-projects:save-layout",
  saveTriggerGraphs: "aircraft:local-projects:save-trigger-graphs",
  saveCatalogItem: "aircraft:local-projects:save-catalog-item",
  deleteCatalogItem: "aircraft:local-projects:delete-catalog-item",
  saveTheme: "aircraft:local-projects:save-theme",
  saveSettings: "aircraft:local-projects:save-settings",
  deleteProject: "aircraft:local-projects:delete",
  listResources: "aircraft:resources:list",
  putResource: "aircraft:resources:put",
  readResource: "aircraft:resources:read",
  deleteResource: "aircraft:resources:delete",
} as const;

// Transitional trust boundary: ownerId comes from the mock-auth Renderer.
// Main validates identifiers and isolates storage/keys, but does not yet own a
// verifiable session that can independently authorize the effective owner.
export interface OwnerProjectRequest {
  readonly ownerId: string;
  readonly projectId: string;
}

export interface OwnerProjectDocumentRequest extends OwnerProjectRequest {
  readonly document: unknown;
}

export interface DeleteScreenRequest extends OwnerProjectRequest {
  readonly screenId: string;
}

export interface DeleteCatalogItemRequest extends OwnerProjectRequest {
  readonly catalogItemId: string;
}

export interface ResourceRequest extends OwnerProjectRequest {
  readonly resourceId: string;
}

export interface PutResourceRequest extends OwnerProjectRequest {
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly tags: readonly string[];
}

export interface AircraftDesktopApi {
  readonly localProjects: {
    list(ownerId: string): Promise<unknown>;
    create(input: unknown): Promise<unknown>;
    load(request: OwnerProjectRequest): Promise<unknown>;
    saveMetadata(request: OwnerProjectDocumentRequest): Promise<void>;
    saveScreen(request: OwnerProjectDocumentRequest): Promise<void>;
    deleteScreen(request: DeleteScreenRequest): Promise<void>;
    saveLayout(request: OwnerProjectDocumentRequest): Promise<void>;
    saveTriggerGraphs(
      request: OwnerProjectDocumentRequest,
    ): Promise<void>;
    saveCatalogItem(request: OwnerProjectDocumentRequest): Promise<void>;
    deleteCatalogItem(request: DeleteCatalogItemRequest): Promise<void>;
    saveTheme(request: OwnerProjectDocumentRequest): Promise<void>;
    saveSettings(request: OwnerProjectDocumentRequest): Promise<void>;
    deleteProject(request: OwnerProjectRequest): Promise<void>;
  };
  readonly resources: {
    list(request: OwnerProjectRequest): Promise<unknown>;
    put(request: PutResourceRequest): Promise<unknown>;
    read(request: ResourceRequest): Promise<Uint8Array>;
    delete(request: ResourceRequest): Promise<void>;
  };
}
