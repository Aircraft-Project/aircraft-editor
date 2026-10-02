import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  mkdir,
  readdir,
  rm,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { AtomicFileStore } from "./AtomicFileStore";
import {
  DOCUMENT_TYPES,
  decryptEnvelope,
  encryptEnvelope,
  type AircraftDocumentType,
  UnsupportedDocumentVersionError,
} from "./AircraftEnvelope";
import { KeyManager } from "./KeyManager";
import { MessagePackCodec } from "./MessagePackCodec";

type UnknownRecord = Record<string, unknown>;

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const DOCUMENT_VERSION = 1;
const PROJECT_FORMAT_VERSION = 1;

export class LocalProjectFileStore {
  private readonly codec = new MessagePackCodec();
  private readonly projectQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly rootPath: string,
    private readonly keys: KeyManager,
    private readonly files: AtomicFileStore,
  ) {}

  async listByOwner(ownerId: string): Promise<readonly unknown[]> {
    this.assertOwnerId(ownerId);
    const projectsPath = path.join(
      this.rootPath,
      "users",
      this.keys.ownerKey(ownerId),
      "projects",
    );
    let entries;
    try {
      entries = await readdir(projectsPath, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const summaries: UnknownRecord[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !SAFE_IDENTIFIER.test(entry.name)) continue;
      try {
        const projectId = entry.name;
        const projectPath = this.projectPath(ownerId, projectId);
        const key = await this.keys.projectKey(ownerId, projectId);
        const manifest = requireRecord(
          await this.readStructured(
            path.join(projectPath, ".aircraft"),
            DOCUMENT_TYPES.PROJECT,
            key,
          ),
          "manifest",
        );
        this.validateManifestOwnership(manifest, ownerId, projectId);
        const metadata = requireRecord(
          await this.readStructured(
            path.join(projectPath, "metadata", "project.airmeta"),
            DOCUMENT_TYPES.METADATA,
            key,
          ),
          "metadata",
        );
        const screensCount = await this.countDocuments(
          path.join(projectPath, "screens"),
          ".airscreen",
        );
        summaries.push({
          id: projectId,
          ownerId,
          name: requireString(metadata.name, "name"),
          description: requireString(metadata.description, "description"),
          status: requireString(metadata.status, "status"),
          screensCount,
          updatedAt: requireString(metadata.updatedAt, "updatedAt"),
          icon: requireString(metadata.icon, "icon"),
          accent: requireString(metadata.accent, "accent"),
          source: "LOCAL",
          syncState: "LOCAL_ONLY",
        });
      } catch (error) {
        console.error(
          "[local-projects] Unable to list project " +
            entry.name +
            ": " +
            errorName(error),
        );
      }
    }
    return summaries.sort((left, right) =>
      String(right.updatedAt).localeCompare(String(left.updatedAt)),
    );
  }

  async create(input: unknown): Promise<unknown> {
    const data = requireRecord(input, "create input");
    const ownerId = requireString(data.ownerId, "ownerId");
    const name = requireString(data.name, "name").trim();
    const description =
      typeof data.description === "string"
        ? data.description.trim()
        : "";
    const schemaVersion = requireString(
      data.schemaVersion,
      "schemaVersion",
    );
    const schemaSourceRevision =
      typeof data.schemaSourceRevision === "string"
        ? data.schemaSourceRevision
        : undefined;
    this.assertOwnerId(ownerId);
    if (!name) throw new Error("Project name is required.");

    const projectId = randomUUID();
    const screenId = randomBytes(8).toString("hex");
    const now = new Date().toISOString();
    const project = {
      manifest: {
        documentVersion: DOCUMENT_VERSION,
        projectId,
        ownerId,
        projectFormatVersion: PROJECT_FORMAT_VERSION,
        schemaVersion,
        ...(schemaSourceRevision ? { schemaSourceRevision } : {}),
        createdAt: now,
        updatedAt: now,
      },
      metadata: {
        documentVersion: DOCUMENT_VERSION,
        projectId,
        name,
        description,
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
          tree: {
            id: randomBytes(8).toString("hex"),
            kind: "body",
            properties: {},
            columns: [
              {
                id: randomBytes(8).toString("hex"),
                kind: "column",
                properties: {},
                rows: [],
              },
            ],
          },
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

    const projectPath = this.projectPath(ownerId, projectId);
    await mkdir(path.dirname(projectPath), { recursive: true });
    await mkdir(projectPath, { recursive: false });
    await Promise.all(
      ["metadata", "screens", "layouts", "triggers", "catalog-items", "resources", "settings"].map(
        (directory) =>
          mkdir(path.join(projectPath, directory), { recursive: false }),
      ),
    );
    const key = await this.keys.projectKey(ownerId, projectId);
    try {
      await this.writeStructured(
        path.join(projectPath, ".aircraft"),
        DOCUMENT_TYPES.PROJECT,
        key,
        project.manifest,
      );
      await this.writeStructured(
        path.join(projectPath, "metadata", "project.airmeta"),
        DOCUMENT_TYPES.METADATA,
        key,
        project.metadata,
      );
      await this.writeStructured(
        path.join(projectPath, "screens", screenId + ".airscreen"),
        DOCUMENT_TYPES.SCREEN,
        key,
        project.screens[0],
      );
      await this.writeStructured(
        path.join(projectPath, "layouts", screenId + ".airlayout"),
        DOCUMENT_TYPES.LAYOUT,
        key,
        project.layouts[screenId],
      );
      await this.writeStructured(
        path.join(projectPath, "resources", "manifest.airres"),
        DOCUMENT_TYPES.RESOURCE_MANIFEST,
        key,
        project.resources,
      );
      await this.writeStructured(
        path.join(projectPath, "settings", "theme.airtheme"),
        DOCUMENT_TYPES.THEME,
        key,
        project.theme,
      );
      await this.writeStructured(
        path.join(projectPath, "settings", "project.airsettings"),
        DOCUMENT_TYPES.SETTINGS,
        key,
        project.settings,
      );
    } catch (error) {
      await rm(projectPath, { recursive: true, force: true });
      throw error;
    }
    return project;
  }

  async load(ownerId: string, projectId: string): Promise<UnknownRecord> {
    const projectPath = this.projectPath(ownerId, projectId);
    const key = await this.keys.projectKey(ownerId, projectId);
    const manifest = requireRecord(
      await this.readStructured(
        path.join(projectPath, ".aircraft"),
        DOCUMENT_TYPES.PROJECT,
        key,
      ),
      "manifest",
    );
    this.validateManifestOwnership(manifest, ownerId, projectId);
    const metadata = await this.readStructured(
      path.join(projectPath, "metadata", "project.airmeta"),
      DOCUMENT_TYPES.METADATA,
      key,
    );
    const screens = await this.readDirectoryDocuments(
      path.join(projectPath, "screens"),
      ".airscreen",
      DOCUMENT_TYPES.SCREEN,
      key,
    );
    const layoutDocuments = await this.readDirectoryDocuments(
      path.join(projectPath, "layouts"),
      ".airlayout",
      DOCUMENT_TYPES.LAYOUT,
      key,
    );
    const graphDocuments = await this.readDirectoryDocuments(
      path.join(projectPath, "triggers"),
      ".airgraph",
      DOCUMENT_TYPES.TRIGGER_GRAPH,
      key,
    );
    const catalogItems = await this.readDirectoryDocuments(
      path.join(projectPath, "catalog-items"),
      ".aircatalog",
      DOCUMENT_TYPES.CATALOG_ITEM,
      key,
    );
    const resources = await this.readStructured(
      path.join(projectPath, "resources", "manifest.airres"),
      DOCUMENT_TYPES.RESOURCE_MANIFEST,
      key,
    );
    const settings = await this.readStructured(
      path.join(projectPath, "settings", "project.airsettings"),
      DOCUMENT_TYPES.SETTINGS,
      key,
    );
    const theme = await this.readOptionalStructured(
      path.join(projectPath, "settings", "theme.airtheme"),
      DOCUMENT_TYPES.THEME,
      key,
      {
        documentVersion: DOCUMENT_VERSION,
        projectId,
        theme: {},
        componentTheme: {},
      },
    );
    return {
      manifest,
      metadata,
      screens,
      layouts: indexBy(layoutDocuments, "screenId"),
      triggerGraphs: indexBy(graphDocuments, "screenId"),
      catalogItems,
      resources,
      settings,
      theme,
    };
  }

  async saveMetadata(request: unknown): Promise<void> {
    await this.saveDocumentRequest(
      request,
      "projectId",
      DOCUMENT_TYPES.METADATA,
      () => "metadata/project.airmeta",
    );
  }

  async saveScreen(request: unknown): Promise<void> {
    await this.saveDocumentRequest(
      request,
      "screenId",
      DOCUMENT_TYPES.SCREEN,
      (document) =>
        "screens/" +
        this.requireSafeId(document.screenId, "screenId") +
        ".airscreen",
    );
  }

  async deleteScreen(request: unknown): Promise<void> {
    const data = this.ownerProjectRequest(request);
    const screenId = this.requireSafeId(data.screenId, "screenId");
    await this.enqueue(data.ownerId, data.projectId, async () => {
      const projectPath = this.projectPath(data.ownerId, data.projectId);
      await Promise.all([
        unlink(path.join(projectPath, "screens", screenId + ".airscreen")).catch(
          ignoreMissing,
        ),
        unlink(path.join(projectPath, "layouts", screenId + ".airlayout")).catch(
          ignoreMissing,
        ),
        unlink(path.join(projectPath, "triggers", screenId + ".airgraph")).catch(
          ignoreMissing,
        ),
      ]);
      await this.touch(data.ownerId, data.projectId);
    });
  }

  async saveLayout(request: unknown): Promise<void> {
    await this.saveDocumentRequest(
      request,
      "screenId",
      DOCUMENT_TYPES.LAYOUT,
      (document) =>
        "layouts/" +
        this.requireSafeId(document.screenId, "screenId") +
        ".airlayout",
    );
  }

  async saveTriggerGraphs(request: unknown): Promise<void> {
    await this.saveDocumentRequest(
      request,
      "screenId",
      DOCUMENT_TYPES.TRIGGER_GRAPH,
      (document) =>
        "triggers/" +
        this.requireSafeId(document.screenId, "screenId") +
        ".airgraph",
    );
  }

  async saveCatalogItem(request: unknown): Promise<void> {
    await this.saveDocumentRequest(
      request,
      "catalogItemId",
      DOCUMENT_TYPES.CATALOG_ITEM,
      (document) =>
        "catalog-items/" +
        this.requireSafeId(document.catalogItemId, "catalogItemId") +
        ".aircatalog",
    );
  }

  async deleteCatalogItem(request: unknown): Promise<void> {
    const data = this.ownerProjectRequest(request);
    const catalogItemId = this.requireSafeId(
      data.catalogItemId,
      "catalogItemId",
    );
    await this.enqueue(data.ownerId, data.projectId, async () => {
      await unlink(
        path.join(
          this.projectPath(data.ownerId, data.projectId),
          "catalog-items",
          catalogItemId + ".aircatalog",
        ),
      ).catch(ignoreMissing);
      await this.touch(data.ownerId, data.projectId);
    });
  }

  async saveTheme(request: unknown): Promise<void> {
    await this.saveDocumentRequest(
      request,
      "projectId",
      DOCUMENT_TYPES.THEME,
      () => "settings/theme.airtheme",
    );
  }

  async saveSettings(request: unknown): Promise<void> {
    await this.saveDocumentRequest(
      request,
      "projectId",
      DOCUMENT_TYPES.SETTINGS,
      () => "settings/project.airsettings",
    );
  }

  async deleteProject(request: unknown): Promise<void> {
    const { ownerId, projectId } = this.ownerProjectRequest(request);
    await this.enqueue(ownerId, projectId, () =>
      rm(this.projectPath(ownerId, projectId), {
        recursive: true,
        force: false,
      }),
    );
  }

  async listResources(request: unknown): Promise<unknown> {
    const { ownerId, projectId } = this.ownerProjectRequest(request);
    const manifest = requireRecord(
      await this.readResourceManifest(ownerId, projectId),
      "resource manifest",
    );
    return requireArray(manifest.resources, "resources");
  }

  async putResource(request: unknown): Promise<unknown> {
    const data = this.ownerProjectRequest(request);
    const name = requireString(data.name, "name");
    const mimeType = requireString(data.mimeType, "mimeType");
    const bytes = data.bytes;
    if (!(bytes instanceof Uint8Array)) {
      throw new Error("Resource bytes are invalid.");
    }
    const tags = Array.isArray(data.tags)
      ? data.tags.map((tag) => requireString(tag, "tag"))
      : [];
    const sha256 = createHash("sha256")
      .update(bytes)
      .digest("hex");

    return this.enqueue(data.ownerId, data.projectId, async () => {
      const manifest = requireRecord(
        await this.readResourceManifest(data.ownerId, data.projectId),
        "resource manifest",
      );
      const resources = requireArray(
        manifest.resources,
        "resources",
      ).map((resource) => requireRecord(resource, "resource"));
      const existing = resources.find(
        (resource) => resource.sha256 === sha256,
      );
      if (existing) {
        return {
          resourceId: requireString(existing.id, "resource id"),
          sha256,
          storageKey: sha256,
        };
      }

      const key = await this.keys.projectKey(
        data.ownerId,
        data.projectId,
      );
      const resourcePath = path.join(
        this.projectPath(data.ownerId, data.projectId),
        "resources",
        sha256 + ".airblob",
      );
      await this.files.write(
        resourcePath,
        encryptEnvelope(
          DOCUMENT_TYPES.RESOURCE_BLOB,
          bytes,
          key,
        ),
      );
      const id = randomUUID();
      const metadata = {
        id,
        name,
        mimeType,
        byteLength: bytes.byteLength,
        sha256,
        storageKey: sha256,
        createdAt: new Date().toISOString(),
        tags,
      };
      await this.writeResourceManifest(
        data.ownerId,
        data.projectId,
        { ...manifest, resources: [...resources, metadata] },
      );
      await this.touch(data.ownerId, data.projectId);
      return { resourceId: id, sha256, storageKey: sha256 };
    });
  }

  async readResource(request: unknown): Promise<Uint8Array> {
    const data = this.ownerProjectRequest(request);
    const resourceId = this.requireSafeId(
      data.resourceId,
      "resourceId",
    );
    const manifest = requireRecord(
      await this.readResourceManifest(data.ownerId, data.projectId),
      "resource manifest",
    );
    const resource = requireArray(
      manifest.resources,
      "resources",
    )
      .map((value) => requireRecord(value, "resource"))
      .find((value) => value.id === resourceId);
    if (!resource) throw new Error("Resource not found.");
    const storageKey = this.requireSafeHash(
      resource.storageKey,
      "storageKey",
    );
    const key = await this.keys.projectKey(
      data.ownerId,
      data.projectId,
    );
    const envelope = await this.files.read(
      path.join(
        this.projectPath(data.ownerId, data.projectId),
        "resources",
        storageKey + ".airblob",
      ),
    );
    return decryptEnvelope(
      DOCUMENT_TYPES.RESOURCE_BLOB,
      envelope,
      key,
    );
  }

  async deleteResource(request: unknown): Promise<void> {
    const data = this.ownerProjectRequest(request);
    const resourceId = this.requireSafeId(
      data.resourceId,
      "resourceId",
    );
    await this.enqueue(data.ownerId, data.projectId, async () => {
      const manifest = requireRecord(
        await this.readResourceManifest(data.ownerId, data.projectId),
        "resource manifest",
      );
      const resources = requireArray(
        manifest.resources,
        "resources",
      ).map((value) => requireRecord(value, "resource"));
      const selected = resources.find(
        (resource) => resource.id === resourceId,
      );
      if (!selected) throw new Error("Resource not found.");
      const storageKey = this.requireSafeHash(
        selected.storageKey,
        "storageKey",
      );
      const remaining = resources.filter(
        (resource) => resource.id !== resourceId,
      );
      await this.writeResourceManifest(
        data.ownerId,
        data.projectId,
        { ...manifest, resources: remaining },
      );
      if (
        !remaining.some(
          (resource) => resource.storageKey === storageKey,
        )
      ) {
        await unlink(
          path.join(
            this.projectPath(data.ownerId, data.projectId),
            "resources",
            storageKey + ".airblob",
          ),
        ).catch(ignoreMissing);
      }
      await this.touch(data.ownerId, data.projectId);
    });
  }

  private async saveDocumentRequest(
    request: unknown,
    requiredIdentity: string,
    type: AircraftDocumentType,
    relativePath: (document: UnknownRecord) => string,
  ): Promise<void> {
    const data = this.ownerProjectRequest(request);
    const document = requireRecord(data.document, "document");
    if (document[requiredIdentity] === undefined) {
      throw new Error("Document identity is missing.");
    }
    if (
      typeof document.projectId === "string" &&
      document.projectId !== data.projectId
    ) {
      throw new Error("Document project identity mismatch.");
    }
    await this.enqueue(data.ownerId, data.projectId, async () => {
      const key = await this.keys.projectKey(
        data.ownerId,
        data.projectId,
      );
      await this.writeStructured(
        path.join(
          this.projectPath(data.ownerId, data.projectId),
          relativePath(document),
        ),
        type,
        key,
        document,
      );
      await this.touch(data.ownerId, data.projectId);
    });
  }

  private async touch(
    ownerId: string,
    projectId: string,
  ): Promise<void> {
    const projectPath = this.projectPath(ownerId, projectId);
    const key = await this.keys.projectKey(ownerId, projectId);
    const now = new Date().toISOString();
    const manifest = requireRecord(
      await this.readStructured(
        path.join(projectPath, ".aircraft"),
        DOCUMENT_TYPES.PROJECT,
        key,
      ),
      "manifest",
    );
    const metadata = requireRecord(
      await this.readStructured(
        path.join(projectPath, "metadata", "project.airmeta"),
        DOCUMENT_TYPES.METADATA,
        key,
      ),
      "metadata",
    );
    await Promise.all([
      this.writeStructured(
        path.join(projectPath, ".aircraft"),
        DOCUMENT_TYPES.PROJECT,
        key,
        { ...manifest, updatedAt: now },
      ),
      this.writeStructured(
        path.join(projectPath, "metadata", "project.airmeta"),
        DOCUMENT_TYPES.METADATA,
        key,
        { ...metadata, updatedAt: now },
      ),
    ]);
  }

  private async readResourceManifest(
    ownerId: string,
    projectId: string,
  ): Promise<unknown> {
    const key = await this.keys.projectKey(ownerId, projectId);
    return this.readStructured(
      path.join(
        this.projectPath(ownerId, projectId),
        "resources",
        "manifest.airres",
      ),
      DOCUMENT_TYPES.RESOURCE_MANIFEST,
      key,
    );
  }

  private async writeResourceManifest(
    ownerId: string,
    projectId: string,
    manifest: unknown,
  ): Promise<void> {
    const key = await this.keys.projectKey(ownerId, projectId);
    await this.writeStructured(
      path.join(
        this.projectPath(ownerId, projectId),
        "resources",
        "manifest.airres",
      ),
      DOCUMENT_TYPES.RESOURCE_MANIFEST,
      key,
      manifest,
    );
  }

  private async writeStructured(
    filePath: string,
    type: AircraftDocumentType,
    key: Uint8Array,
    value: unknown,
  ): Promise<void> {
    await this.files.write(
      filePath,
      encryptEnvelope(type, this.codec.encode(value), key),
    );
  }

  private async readStructured(
    filePath: string,
    type: AircraftDocumentType,
    key: Uint8Array,
  ): Promise<unknown> {
    const envelope = await this.files.read(filePath);
    const decoded = this.codec.decode(decryptEnvelope(type, envelope, key));
    const document = requireRecord(decoded, "document");
    if (document.documentVersion !== DOCUMENT_VERSION) {
      throw new UnsupportedDocumentVersionError(document.documentVersion);
    }
    return document;
  }

  private async readOptionalStructured(
    filePath: string,
    type: AircraftDocumentType,
    key: Uint8Array,
    fallback: unknown,
  ): Promise<unknown> {
    try {
      return await this.readStructured(filePath, type, key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return fallback;
      }
      throw error;
    }
  }

  private async readDirectoryDocuments(
    directoryPath: string,
    extension: string,
    type: AircraftDocumentType,
    key: Uint8Array,
  ): Promise<unknown[]> {
    let names: string[];
    try {
      names = await readdir(directoryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return Promise.all(
      names
        .filter((name) => name.endsWith(extension))
        .map((name) =>
          this.readStructured(
            path.join(directoryPath, name),
            type,
            key,
          ),
        ),
    );
  }

  private validateManifestOwnership(
    manifest: UnknownRecord,
    ownerId: string,
    projectId: string,
  ): void {
    if (manifest.ownerId !== ownerId || manifest.projectId !== projectId) {
      throw new Error("Project ownership validation failed.");
    }
    if (manifest.projectFormatVersion !== PROJECT_FORMAT_VERSION) {
      throw new Error("Unsupported project format version.");
    }
  }

  private async countDocuments(
    directoryPath: string,
    extension: string,
  ): Promise<number> {
    try {
      const names = await readdir(directoryPath);
      return names.filter((name) => name.endsWith(extension)).length;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
  }

  private projectPath(
    ownerId: string,
    projectId: string,
  ): string {
    this.assertOwnerId(ownerId);
    this.requireSafeId(projectId, "projectId");
    return path.join(
      this.rootPath,
      "users",
      this.keys.ownerKey(ownerId),
      "projects",
      projectId,
    );
  }

  private ownerProjectRequest(request: unknown): UnknownRecord & {
    ownerId: string;
    projectId: string;
  } {
    const data = requireRecord(request, "request");
    const ownerId = requireString(data.ownerId, "ownerId");
    const projectId = this.requireSafeId(
      data.projectId,
      "projectId",
    );
    this.assertOwnerId(ownerId);
    return { ...data, ownerId, projectId };
  }

  private assertOwnerId(ownerId: string): void {
    if (
      !ownerId.trim() ||
      ownerId.length > 256 ||
      /[\0\r\n]/.test(ownerId)
    ) {
      throw new Error("Invalid owner identity.");
    }
  }

  private requireSafeId(value: unknown, field: string): string {
    const id = requireString(value, field);
    if (!SAFE_IDENTIFIER.test(id)) {
      throw new Error("Invalid " + field + ".");
    }
    return id;
  }

  private requireSafeHash(value: unknown, field: string): string {
    const hash = requireString(value, field);
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error("Invalid " + field + ".");
    }
    return hash;
  }

  private enqueue<T>(
    ownerId: string,
    projectId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const queueKey = ownerId + "\0" + projectId;
    const previous = this.projectQueues.get(queueKey) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const settled = result
      .then(() => undefined, () => undefined)
      .finally(() => {
        if (this.projectQueues.get(queueKey) === settled) {
          this.projectQueues.delete(queueKey);
        }
      });
    this.projectQueues.set(queueKey, settled);
    return result;
  }
}

function indexBy(
  values: readonly unknown[],
  key: string,
): Record<string, unknown> {
  return Object.fromEntries(
    values.map((value) => {
      const record = requireRecord(value, "document");
      return [requireString(record[key], key), record];
    }),
  );
}

function requireRecord(
  value: unknown,
  field: string,
): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid " + field + ".");
  }
  return value as UnknownRecord;
}

function requireArray(
  value: unknown,
  field: string,
): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid " + field + ".");
  return value;
}

function requireString(
  value: unknown,
  field: string,
): string {
  if (typeof value !== "string" || !value) {
    throw new Error("Invalid " + field + ".");
  }
  return value;
}

function ignoreMissing(error: unknown): void {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
