import {
  createAircraftIdentifier,
  createEmptyBody,
} from "@/modules/screens/layoutTree";
import type {
  LocalProjectRepository,
  ResourceRepository,
} from "../application";
import {
  DOCUMENT_VERSION,
  LocalProjectNotFoundError,
  PROJECT_FORMAT_VERSION,
  ResourceNotFoundError,
  assertOwnerId,
  assertSafeIdentifier,
  type AircraftProject,
  type CatalogItemDocument,
  type CreateLocalProjectInput,
  type LayoutDocument,
  type LocalProjectSummary,
  type ProjectMetadata,
  type ProjectSettingsDocument,
  type PutResourceInput,
  type ResourceManifest,
  type ResourceMetadata,
  type ResourceReference,
  type ScreenDocument,
  type TriggerGraphDocument,
  type ThemeDocument,
} from "../domain";

const clone = <T>(value: T): T => {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};
const keyOf = (ownerId: string, projectId: string): string =>
  ownerId + "\0" + projectId;

export class InMemoryLocalProjectRepository
  implements LocalProjectRepository
{
  private readonly projects = new Map<string, AircraftProject>();

  async listByOwner(
    ownerId: string,
  ): Promise<readonly LocalProjectSummary[]> {
    assertOwnerId(ownerId);
    return [...this.projects.values()]
      .filter((project) => project.manifest.ownerId === ownerId)
      .map(toSummary)
      .sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
  }

  async create(
    input: CreateLocalProjectInput,
  ): Promise<AircraftProject> {
    assertOwnerId(input.ownerId);
    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();
    const screenId = createAircraftIdentifier();
    const project: AircraftProject = {
      manifest: {
        documentVersion: DOCUMENT_VERSION,
        projectId,
        ownerId: input.ownerId,
        projectFormatVersion: PROJECT_FORMAT_VERSION,
        schemaVersion: input.schemaVersion,
        ...(input.schemaSourceRevision
          ? { schemaSourceRevision: input.schemaSourceRevision }
          : {}),
        createdAt: now,
        updatedAt: now,
      },
      metadata: {
        documentVersion: DOCUMENT_VERSION,
        projectId,
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
        status: "DRAFT",
        icon: "LAYOUT",
        accent: "BLUE",
        createdAt: now,
        updatedAt: now,
        source: "LOCAL",
        syncState: "LOCAL_ONLY",
      },
      screens: [
        {
          documentVersion: DOCUMENT_VERSION,
          screenId,
          name: "Home",
          description: "Pantalla principal",
          destination: screenId,
          context: "interface",
          isInitial: true,
          order: 0,
        },
      ],
      layouts: {
        [screenId]: {
          documentVersion: DOCUMENT_VERSION,
          screenId,
          tree: createEmptyBody(),
        },
      },
      triggerGraphs: {},
      catalogItems: [],
      resources: {
        documentVersion: DOCUMENT_VERSION,
        projectId,
        resources: [],
      },
      theme: {
        documentVersion: DOCUMENT_VERSION,
        projectId,
        theme: {},
        componentTheme: {},
      },
      settings: {
        documentVersion: DOCUMENT_VERSION,
        projectId,
        activeScreenId: screenId,
        activeWorkspace: "components",
        selectedDevice: "iphone-15",
        zoom: 100,
      },
    };
    this.projects.set(keyOf(input.ownerId, projectId), clone(project));
    return clone(project);
  }

  async load(
    ownerId: string,
    projectId: string,
  ): Promise<AircraftProject> {
    return clone(this.require(ownerId, projectId));
  }

  async saveMetadata(
    ownerId: string,
    projectId: string,
    document: ProjectMetadata,
  ): Promise<void> {
    this.update(ownerId, projectId, (project) => ({
      ...project,
      metadata: clone(document),
    }));
  }

  async saveScreen(
    ownerId: string,
    projectId: string,
    document: ScreenDocument,
  ): Promise<void> {
    this.update(ownerId, projectId, (project) => ({
      ...project,
      screens: [
        ...project.screens.filter(
          (screen) => screen.screenId !== document.screenId,
        ),
        clone(document),
      ],
    }));
  }

  async deleteScreen(
    ownerId: string,
    projectId: string,
    screenId: string,
  ): Promise<void> {
    assertSafeIdentifier(screenId);
    this.update(ownerId, projectId, (project) => {
      const layouts = { ...project.layouts };
      const triggerGraphs = { ...project.triggerGraphs };
      delete layouts[screenId];
      delete triggerGraphs[screenId];
      return {
        ...project,
        screens: project.screens.filter(
          (screen) => screen.screenId !== screenId,
        ),
        layouts,
        triggerGraphs,
      };
    });
  }

  async saveLayout(
    ownerId: string,
    projectId: string,
    document: LayoutDocument,
  ): Promise<void> {
    assertSafeIdentifier(document.screenId);
    this.update(ownerId, projectId, (project) => ({
      ...project,
      layouts: {
        ...project.layouts,
        [document.screenId]: clone(document),
      },
    }));
  }

  async saveTriggerGraphs(
    ownerId: string,
    projectId: string,
    document: TriggerGraphDocument,
  ): Promise<void> {
    assertSafeIdentifier(document.screenId);
    this.update(ownerId, projectId, (project) => ({
      ...project,
      triggerGraphs: {
        ...project.triggerGraphs,
        [document.screenId]: clone(document),
      },
    }));
  }

  async saveCatalogItem(
    ownerId: string,
    projectId: string,
    document: CatalogItemDocument,
  ): Promise<void> {
    assertSafeIdentifier(document.catalogItemId);
    this.update(ownerId, projectId, (project) => ({
      ...project,
      catalogItems: [
        ...project.catalogItems.filter(
          (item) => item.catalogItemId !== document.catalogItemId,
        ),
        clone(document),
      ],
    }));
  }

  async deleteCatalogItem(
    ownerId: string,
    projectId: string,
    catalogItemId: string,
  ): Promise<void> {
    assertSafeIdentifier(catalogItemId);
    this.update(ownerId, projectId, (project) => ({
      ...project,
      catalogItems: project.catalogItems.filter(
        (item) => item.catalogItemId !== catalogItemId,
      ),
    }));
  }

  async saveTheme(
    ownerId: string,
    projectId: string,
    document: ThemeDocument,
  ): Promise<void> {
    this.update(ownerId, projectId, (project) => ({
      ...project,
      theme: clone(document),
    }));
  }

  async saveSettings(
    ownerId: string,
    projectId: string,
    document: ProjectSettingsDocument,
  ): Promise<void> {
    this.update(ownerId, projectId, (project) => ({
      ...project,
      settings: clone(document),
    }));
  }

  async saveResourceManifest(
    ownerId: string,
    projectId: string,
    document: ResourceManifest,
  ): Promise<void> {
    this.update(ownerId, projectId, (project) => ({
      ...project,
      resources: clone(document),
    }));
  }

  async deleteProject(
    ownerId: string,
    projectId: string,
  ): Promise<void> {
    this.require(ownerId, projectId);
    this.projects.delete(keyOf(ownerId, projectId));
  }

  private require(
    ownerId: string,
    projectId: string,
  ): AircraftProject {
    assertOwnerId(ownerId);
    assertSafeIdentifier(projectId);
    const project = this.projects.get(keyOf(ownerId, projectId));
    if (!project) throw new LocalProjectNotFoundError(projectId);
    return project;
  }

  private update(
    ownerId: string,
    projectId: string,
    update: (project: AircraftProject) => AircraftProject,
  ): void {
    const project = this.require(ownerId, projectId);
    const updated = update(project);
    const now = new Date().toISOString();
    this.projects.set(keyOf(ownerId, projectId), {
      ...updated,
      manifest: { ...updated.manifest, updatedAt: now },
      metadata: { ...updated.metadata, updatedAt: now },
    });
  }
}

export class InMemoryResourceRepository
  implements ResourceRepository
{
  private readonly resources = new Map<
    string,
    Map<string, { metadata: ResourceMetadata; bytes: Uint8Array }>
  >();

  constructor(
    private readonly projects: InMemoryLocalProjectRepository,
  ) {}

  async list(
    ownerId: string,
    projectId: string,
  ): Promise<readonly ResourceMetadata[]> {
    const project = await this.projects.load(ownerId, projectId);
    return project.resources.resources.map(clone);
  }

  async put(input: PutResourceInput): Promise<ResourceReference> {
    await this.projects.load(input.ownerId, input.projectId);
    const sha256 = await sha256Hex(input.bytes);
    const bucketKey = keyOf(input.ownerId, input.projectId);
    const bucket = this.resources.get(bucketKey) ?? new Map();
    const existing = [...bucket.values()].find(
      (entry) => entry.metadata.sha256 === sha256,
    );
    if (existing) {
      return {
        resourceId: existing.metadata.id,
        sha256,
        storageKey: existing.metadata.storageKey,
      };
    }
    const id = crypto.randomUUID();
    const metadata: ResourceMetadata = {
      id,
      name: input.name,
      mimeType: input.mimeType,
      byteLength: input.bytes.byteLength,
      sha256,
      storageKey: sha256,
      createdAt: new Date().toISOString(),
      tags: [...(input.tags ?? [])],
    };
    bucket.set(id, { metadata, bytes: input.bytes.slice() });
    this.resources.set(bucketKey, bucket);
    const project = await this.projects.load(input.ownerId, input.projectId);
    await this.projects.saveResourceManifest(input.ownerId, input.projectId, {
      ...project.resources,
      resources: [...project.resources.resources, metadata],
    });
    return { resourceId: id, sha256, storageKey: sha256 };
  }

  async read(
    ownerId: string,
    projectId: string,
    resourceId: string,
  ): Promise<Uint8Array> {
    assertSafeIdentifier(resourceId);
    await this.projects.load(ownerId, projectId);
    const entry = this.resources
      .get(keyOf(ownerId, projectId))
      ?.get(resourceId);
    if (!entry) throw new ResourceNotFoundError(resourceId);
    return entry.bytes.slice();
  }

  async delete(
    ownerId: string,
    projectId: string,
    resourceId: string,
  ): Promise<void> {
    assertSafeIdentifier(resourceId);
    const project = await this.projects.load(ownerId, projectId);
    const bucket = this.resources.get(keyOf(ownerId, projectId));
    if (!bucket?.delete(resourceId)) {
      throw new ResourceNotFoundError(resourceId);
    }
    await this.projects.saveResourceManifest(ownerId, projectId, {
      ...project.resources,
      resources: project.resources.resources.filter(
        (resource) => resource.id !== resourceId,
      ),
    });
  }
}

function toSummary(
  project: AircraftProject,
): LocalProjectSummary {
  return {
    id: project.manifest.projectId,
    ownerId: project.manifest.ownerId,
    name: project.metadata.name,
    description: project.metadata.description,
    status: project.metadata.status,
    screensCount: project.screens.length,
    updatedAt: project.metadata.updatedAt,
    icon: project.metadata.icon,
    accent: project.metadata.accent,
    source: "LOCAL",
    syncState: "LOCAL_ONLY",
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
