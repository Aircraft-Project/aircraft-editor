/** @jest-environment node */

import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { SafeStorage } from "electron";
import type {
  AircraftProject,
  LayoutDocument,
  TriggerGraphDocument,
} from "../../src/modules/local-project/domain/models";
import { AtomicFileStore } from "./AtomicFileStore";
import {
  decryptEnvelope,
  DOCUMENT_TYPES,
  encryptEnvelope,
  ProjectDecryptionError,
  type AircraftDocumentType,
  UnsupportedDocumentVersionError,
  UnsupportedProjectVersionError,
} from "./AircraftEnvelope";
import { KeyManager, LocalStorageUnavailableError } from "./KeyManager";
import { LocalProjectFileStore } from "./LocalProjectFileStore";
import { MessagePackCodec } from "./MessagePackCodec";

const ownerA = "usr-admin-001";
const ownerB = "usr-developer-001";
const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) =>
    Buffer.from(value, "utf8").map((byte) => byte ^ 0xa5),
  decryptString: (value: Buffer) =>
    Buffer.from(Buffer.from(value).map((byte) => byte ^ 0xa5)).toString("utf8"),
} as unknown as SafeStorage;

function buildStore(rootPath: string) {
  const files = new AtomicFileStore();
  const keys = new KeyManager(
    path.join(rootPath, ".master-key"),
    fakeSafeStorage,
    files,
  );
  return {
    files,
    keys,
    store: new LocalProjectFileStore(rootPath, keys, files),
  };
}

async function createProject(store: LocalProjectFileStore) {
  return (await store.create({
    ownerId: ownerA,
    name: "Secret Aircraft Project",
    description: "Confidential description",
    schemaVersion: "snapshot-1",
    schemaSourceRevision: "aircraft-android-test",
  })) as AircraftProject;
}

describe("LocalProjectFileStore", () => {
  let temporaryPath: string;
  let rootPath: string;

  beforeEach(async () => {
    temporaryPath = await mkdtemp(path.join(tmpdir(), "aircraft-storage-"));
    rootPath = path.join(temporaryPath, "local-projects");
  });

  afterEach(async () => {
    await rm(temporaryPath, { recursive: true, force: true });
  });

  it("persists a complete encrypted project and reloads it with a fresh repository", async () => {
    const first = buildStore(rootPath);
    const project = await createProject(first.store);
    const projectId = project.manifest.projectId;
    const screenId = project.screens[0].screenId;
    const renamedScreen = {
      ...project.screens[0],
      name: "Home persisted",
      description: "Recovered after restart",
      mcpMetadata: { source: "assembler" },
      extensions: { futureScreen: "keep" },
    };
    const layout: LayoutDocument = {
      ...project.layouts[screenId],
      tree: {
        ...project.layouts[screenId].tree,
        id: "secret-component-text",
      },
    };
    const graphA = screenId + ":button-main:CLICK";
    const graphB = screenId + ":button-main:LONG_PRESS";
    const graph: TriggerGraphDocument = {
      documentVersion: 1,
      screenId,
      graphs: {
        [graphA]: {
          rootVertexId: "event-click",
          nodes: [
            {
              id: "event-click",
              kind: "trigger",
              type: "CLICK",
              label: "Click",
              properties: {},
              persistence: {
                localRuntime: true,
                pilotRuntime: false,
                globalRuntime: false,
                extensions: { cacheKey: "movie-list" },
              },
            },
          ],
          edges: [],
          selectedNodeId: "event-click",
          mcpMetadata: { graph: "keep" },
          extensions: { futureBinding: "keep" },
        },
        [graphB]: {
          rootVertexId: "event-long",
          nodes: [
            {
              id: "event-long",
              kind: "trigger",
              type: "LONG_PRESS",
              label: "Long press",
              properties: {},
            },
          ],
          edges: [],
          selectedNodeId: "event-long",
        },
      },
    };
    const metadata = {
      ...project.metadata,
      name: "Renamed secret project",
      extensions: { futureMetadata: "keep" },
    };
    const catalogItem = {
      documentVersion: 1 as const,
      catalogItemId: "movie-card",
      name: "movie-card",
      destination: "movie-card",
      context: "catalog-item" as const,
      mcpMetadata: { catalog: "keep" },
      extensions: { futureCatalog: "keep" },
      layout: {
        ...project.layouts[screenId].tree,
        properties: { surface: "secret-card" },
      },
    };
    const theme = {
      documentVersion: 1 as const,
      projectId,
      theme: { colors: { primary: "00CFFF" } },
      componentTheme: {
        textField: { focusedBorderColor: "$colors.primary" },
      },
    };

    await first.store.saveMetadata({ ownerId: ownerA, projectId, document: metadata });
    await first.store.saveScreen({ ownerId: ownerA, projectId, document: renamedScreen });
    await first.store.saveLayout({ ownerId: ownerA, projectId, document: layout });
    await first.store.saveTriggerGraphs({ ownerId: ownerA, projectId, document: graph });
    await first.store.saveCatalogItem({
      ownerId: ownerA,
      projectId,
      document: catalogItem,
    });
    await first.store.saveTheme({ ownerId: ownerA, projectId, document: theme });
    await first.store.saveSettings({
      ownerId: ownerA,
      projectId,
      document: {
        ...project.settings,
        activeWorkspace: "triggers",
        selectedDevice: "iphone-15-pro-max",
        zoom: 125,
        extensions: { futureSettings: "keep" },
      },
    });

    const resourceBytes = Uint8Array.from([0, 1, 2, 127, 128, 254, 255]);
    const reference = (await first.store.putResource({
      ownerId: ownerA,
      projectId,
      name: "aircraft.bin",
      mimeType: "application/octet-stream",
      bytes: resourceBytes,
      tags: ["binary"],
    })) as { resourceId: string; sha256: string; storageKey: string };
    const duplicate = await first.store.putResource({
      ownerId: ownerA,
      projectId,
      name: "aircraft-copy.bin",
      mimeType: "application/octet-stream",
      bytes: resourceBytes.slice(),
    });
    expect(duplicate).toEqual(reference);

    const projectPath = path.join(
      rootPath,
      "users",
      first.keys.ownerKey(ownerA),
      "projects",
      projectId,
    );
    await expect(readdir(projectPath)).resolves.toEqual(
      expect.arrayContaining([
        ".aircraft",
        "metadata",
        "screens",
        "layouts",
        "triggers",
        "catalog-items",
        "resources",
        "settings",
      ]),
    );
    const blobs = (await readdir(path.join(projectPath, "resources"))).filter(
      (name) => name.endsWith(".airblob"),
    );
    expect(blobs).toEqual([reference.sha256 + ".airblob"]);

    const metadataBytes = await readFile(
      path.join(projectPath, "metadata", "project.airmeta"),
    );
    const layoutBytes = await readFile(
      path.join(projectPath, "layouts", screenId + ".airlayout"),
    );
    const catalogBytes = await readFile(
      path.join(projectPath, "catalog-items", "movie-card.aircatalog"),
    );
    const themeBytes = await readFile(
      path.join(projectPath, "settings", "theme.airtheme"),
    );
    expect(metadataBytes.toString("utf8")).not.toContain("Renamed secret project");
    expect(metadataBytes.toString("utf8")).not.toContain(ownerA);
    expect(layoutBytes.toString("utf8")).not.toContain("secret-component-text");
    expect(catalogBytes.toString("utf8")).not.toContain("movie-card");
    expect(themeBytes.toString("utf8")).not.toContain("#00cfff");

    const fresh = buildStore(rootPath);
    const loaded = (await fresh.store.load(ownerA, projectId)) as unknown as AircraftProject;
    expect(loaded.metadata.name).toBe("Renamed secret project");
    expect(loaded.screens).toEqual([renamedScreen]);
    expect(loaded.layouts[screenId]).toEqual(layout);
    expect(loaded.triggerGraphs[screenId].graphs[graphA]).toEqual(graph.graphs[graphA]);
    expect(loaded.triggerGraphs[screenId].graphs[graphB]).toEqual(graph.graphs[graphB]);
    expect(loaded.triggerGraphs[screenId].graphs[graphA].nodes[0].persistence).toEqual({
      localRuntime: true,
      pilotRuntime: false,
      globalRuntime: false,
      extensions: { cacheKey: "movie-list" },
    });
    expect(loaded.catalogItems).toEqual([catalogItem]);
    expect(loaded.theme).toEqual(theme);
    expect(loaded.settings).toMatchObject({
      activeWorkspace: "triggers",
      selectedDevice: "iphone-15-pro-max",
      zoom: 125,
    });
    expect(await fresh.store.listResources({ ownerId: ownerA, projectId })).toHaveLength(1);
    expect(
      await fresh.store.readResource({
        ownerId: ownerA,
        projectId,
        resourceId: reference.resourceId,
      }),
    ).toEqual(resourceBytes);
  });

  it("loads legacy projects without catalog or theme files", async () => {
    const { store, keys } = buildStore(rootPath);
    const project = await createProject(store);
    const projectPath = path.join(
      rootPath,
      "users",
      keys.ownerKey(ownerA),
      "projects",
      project.manifest.projectId,
    );
    await rm(path.join(projectPath, "catalog-items"), { recursive: true, force: true });
    await rm(path.join(projectPath, "settings", "theme.airtheme"), { force: true });

    const loaded = (await store.load(
      ownerA,
      project.manifest.projectId,
    )) as unknown as AircraftProject;
    expect(loaded.catalogItems).toEqual([]);
    expect(loaded.theme).toEqual({
      documentVersion: 1,
      projectId: project.manifest.projectId,
      theme: {},
      componentTheme: {},
    });
  });

  it("isolates physical projects by owner hash", async () => {
    const { store } = buildStore(rootPath);
    const project = await createProject(store);

    await expect(store.listByOwner(ownerA)).resolves.toHaveLength(1);
    await expect(store.listByOwner(ownerB)).resolves.toEqual([]);
    await expect(
      store.load(ownerB, project.manifest.projectId),
    ).rejects.toBeDefined();
  });

  it("lists summaries without hydrating heavy project documents", async () => {
    const { store, keys } = buildStore(rootPath);
    const project = await createProject(store);
    const projectPath = path.join(
      rootPath,
      "users",
      keys.ownerKey(ownerA),
      "projects",
      project.manifest.projectId,
    );

    await Promise.all([
      writeFile(
        path.join(
          projectPath,
          "layouts",
          project.screens[0].screenId + ".airlayout",
        ),
        Buffer.from("invalid layout"),
      ),
      writeFile(
        path.join(projectPath, "resources", "manifest.airres"),
        Buffer.from("invalid resources"),
      ),
      writeFile(
        path.join(projectPath, "settings", "project.airsettings"),
        Buffer.from("invalid settings"),
      ),
    ]);

    await expect(store.listByOwner(ownerA)).resolves.toEqual([
      expect.objectContaining({
        id: project.manifest.projectId,
        name: "Secret Aircraft Project",
        screensCount: 1,
      }),
    ]);
    await expect(
      store.load(ownerA, project.manifest.projectId),
    ).rejects.toBeDefined();
  });

  it.each(["../", "../../x", "....\\x", "C:\\temp"])(
    "rejects malicious project identifier %s",
    async (projectId) => {
      const { store } = buildStore(rootPath);
      await expect(store.load(ownerA, projectId)).rejects.toThrow(
        "Invalid projectId",
      );
    },
  );

  it("rejects a tampered ciphertext without returning partial data", async () => {
    const { store, keys } = buildStore(rootPath);
    const project = await createProject(store);
    const metadataPath = path.join(
      rootPath,
      "users",
      keys.ownerKey(ownerA),
      "projects",
      project.manifest.projectId,
      "metadata",
      "project.airmeta",
    );
    const bytes = await readFile(metadataPath);
    bytes[bytes.length - 1] ^= 0xff;
    await writeFile(metadataPath, bytes);

    await expect(
      store.load(ownerA, project.manifest.projectId),
    ).rejects.toBeInstanceOf(ProjectDecryptionError);
  });

  it("rejects unsupported future project versions", async () => {
    const { store, keys } = buildStore(rootPath);
    const project = await createProject(store);
    const manifestPath = path.join(
      rootPath,
      "users",
      keys.ownerKey(ownerA),
      "projects",
      project.manifest.projectId,
      ".aircraft",
    );
    const bytes = await readFile(manifestPath);
    bytes.writeUInt16BE(2, 10);
    await writeFile(manifestPath, bytes);

    await expect(
      store.load(ownerA, project.manifest.projectId),
    ).rejects.toBeInstanceOf(UnsupportedProjectVersionError);
  });

  it.each([
    ["project manifest", DOCUMENT_TYPES.PROJECT, ".aircraft"],
    ["metadata", DOCUMENT_TYPES.METADATA, "metadata/project.airmeta"],
    ["screen", DOCUMENT_TYPES.SCREEN, "screens/{screenId}.airscreen"],
    ["layout", DOCUMENT_TYPES.LAYOUT, "layouts/{screenId}.airlayout"],
    [
      "trigger graph",
      DOCUMENT_TYPES.TRIGGER_GRAPH,
      "triggers/{screenId}.airgraph",
    ],
    [
      "resource manifest",
      DOCUMENT_TYPES.RESOURCE_MANIFEST,
      "resources/manifest.airres",
    ],
    ["settings", DOCUMENT_TYPES.SETTINGS, "settings/project.airsettings"],
    [
      "catalog item",
      DOCUMENT_TYPES.CATALOG_ITEM,
      "catalog-items/catalog-item-version.aircatalog",
    ],
    ["theme", DOCUMENT_TYPES.THEME, "settings/theme.airtheme"],
  ] as const)(
    "rejects unsupported documentVersion in %s",
    async (_label, documentType, relativePathTemplate) => {
      const { store, keys, files } = buildStore(rootPath);
      const project = await createProject(store);
      const projectId = project.manifest.projectId;
      const screenId = project.screens[0].screenId;
      if (documentType === DOCUMENT_TYPES.CATALOG_ITEM) {
        await store.saveCatalogItem({
          ownerId: ownerA,
          projectId,
          document: {
            documentVersion: 1,
            catalogItemId: "catalog-item-version",
            name: "Versioned item",
            destination: "catalog-item-version",
            context: "catalog-item",
            layout: project.layouts[screenId].tree,
          },
        });
      }
      if (documentType === DOCUMENT_TYPES.TRIGGER_GRAPH) {
        await store.saveTriggerGraphs({
          ownerId: ownerA,
          projectId,
          document: {
            documentVersion: 1,
            screenId,
            graphs: {},
          },
        });
      }

      const projectPath = path.join(
        rootPath,
        "users",
        keys.ownerKey(ownerA),
        "projects",
        projectId,
      );
      const filePath = path.join(
        projectPath,
        relativePathTemplate.replace("{screenId}", screenId),
      );
      const key = await keys.projectKey(ownerA, projectId);
      const codec = new MessagePackCodec();
      const decoded = codec.decode(
        decryptEnvelope(
          documentType as AircraftDocumentType,
          await files.read(filePath),
          key,
        ),
      );
      if (
        typeof decoded !== "object" ||
        decoded === null ||
        Array.isArray(decoded)
      ) {
        throw new Error("Expected a structured Aircraft document.");
      }
      await files.write(
        filePath,
        encryptEnvelope(
          documentType as AircraftDocumentType,
          codec.encode({ ...decoded, documentVersion: 2 }),
          key,
        ),
      );

      await expect(store.load(ownerA, projectId)).rejects.toBeInstanceOf(
        UnsupportedDocumentVersionError,
      );
    },
  );
  it("fails closed when operating-system key protection is unavailable", async () => {
    const files = new AtomicFileStore();
    const unavailable = {
      isEncryptionAvailable: () => false,
    } as unknown as SafeStorage;
    const keys = new KeyManager(
      path.join(rootPath, ".master-key"),
      unavailable,
      files,
    );

    await expect(keys.projectKey(ownerA, "project-safe")).rejects.toBeInstanceOf(
      LocalStorageUnavailableError,
    );
  });
});
