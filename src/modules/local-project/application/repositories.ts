import type {
  AircraftProject,
  CatalogItemDocument,
  CreateLocalProjectInput,
  LayoutDocument,
  LocalProjectSummary,
  ProjectMetadata,
  ProjectSettingsDocument,
  PutResourceInput,
  ResourceMetadata,
  ResourceReference,
  ScreenDocument,
  TriggerGraphDocument,
  ThemeDocument,
} from "../domain";

export interface LocalProjectRepository {
  listByOwner(ownerId: string): Promise<readonly LocalProjectSummary[]>;
  create(input: CreateLocalProjectInput): Promise<AircraftProject>;
  load(ownerId: string, projectId: string): Promise<AircraftProject>;
  saveMetadata(
    ownerId: string,
    projectId: string,
    document: ProjectMetadata,
  ): Promise<void>;
  saveScreen(
    ownerId: string,
    projectId: string,
    document: ScreenDocument,
  ): Promise<void>;
  deleteScreen(
    ownerId: string,
    projectId: string,
    screenId: string,
  ): Promise<void>;
  saveLayout(
    ownerId: string,
    projectId: string,
    document: LayoutDocument,
  ): Promise<void>;
  saveTriggerGraphs(
    ownerId: string,
    projectId: string,
    document: TriggerGraphDocument,
  ): Promise<void>;
  saveCatalogItem(
    ownerId: string,
    projectId: string,
    document: CatalogItemDocument,
  ): Promise<void>;
  deleteCatalogItem(
    ownerId: string,
    projectId: string,
    catalogItemId: string,
  ): Promise<void>;
  saveTheme(
    ownerId: string,
    projectId: string,
    document: ThemeDocument,
  ): Promise<void>;
  saveSettings(
    ownerId: string,
    projectId: string,
    document: ProjectSettingsDocument,
  ): Promise<void>;
  deleteProject(ownerId: string, projectId: string): Promise<void>;
}

export interface ResourceRepository {
  list(
    ownerId: string,
    projectId: string,
  ): Promise<readonly ResourceMetadata[]>;
  put(input: PutResourceInput): Promise<ResourceReference>;
  read(
    ownerId: string,
    projectId: string,
    resourceId: string,
  ): Promise<Uint8Array>;
  delete(
    ownerId: string,
    projectId: string,
    resourceId: string,
  ): Promise<void>;
}

export interface AircraftCodec<T> {
  encode(value: T): Promise<Uint8Array>;
  decode(bytes: Uint8Array): Promise<T>;
}
