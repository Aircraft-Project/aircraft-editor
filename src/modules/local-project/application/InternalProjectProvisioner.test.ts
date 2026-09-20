/** @jest-environment node */

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SafeStorage } from "electron";
import { AtomicFileStore } from "../../../../electron/storage/AtomicFileStore";
import { KeyManager } from "../../../../electron/storage/KeyManager";
import { LocalProjectFileStore } from "../../../../electron/storage/LocalProjectFileStore";
import type {
  AircraftProject,
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
} from "../domain";
import { InternalProjectProvisioner } from "./InternalProjectProvisioner";
import type {
  LocalProjectRepository,
  ResourceRepository,
} from "./repositories";

const ownerId = "usr-admin-001";
const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) =>
    Buffer.from(value, "utf8").map((byte) => byte ^ 0xa5),
  decryptString: (value: Buffer) =>
    Buffer.from(Buffer.from(value).map((byte) => byte ^ 0xa5)).toString("utf8"),
} as unknown as SafeStorage;

function buildFileStore(rootPath: string): {
  readonly store: LocalProjectFileStore;
  readonly keys: KeyManager;
} {
  const files = new AtomicFileStore();
  const keys = new KeyManager(rootPath, fakeSafeStorage, files);
  return {
    store: new LocalProjectFileStore(rootPath, keys, files),
    keys,
  };
}

function repositoryAdapters(store: LocalProjectFileStore): {
  readonly projects: LocalProjectRepository;
  readonly resources: ResourceRepository;
} {
  const projects: LocalProjectRepository = {
    listByOwner: async (owner) =>
      (await store.listByOwner(owner)) as unknown as readonly LocalProjectSummary[],
    create: async (input: CreateLocalProjectInput) =>
      (await store.create(input)) as AircraftProject,
    load: async (owner, projectId) =>
      (await store.load(owner, projectId)) as unknown as AircraftProject,
    saveMetadata: async (
      owner: string,
      projectId: string,
      document: ProjectMetadata,
    ) => store.saveMetadata({ ownerId: owner, projectId, document }),
    saveScreen: async (
      owner: string,
      projectId: string,
      document: ScreenDocument,
    ) => store.saveScreen({ ownerId: owner, projectId, document }),
    deleteScreen: async (owner, projectId, screenId) =>
      store.deleteScreen({ ownerId: owner, projectId, screenId }),
    saveLayout: async (
      owner: string,
      projectId: string,
      document: LayoutDocument,
    ) => store.saveLayout({ ownerId: owner, projectId, document }),
    saveTriggerGraphs: async (
      owner: string,
      projectId: string,
      document: TriggerGraphDocument,
    ) => store.saveTriggerGraphs({ ownerId: owner, projectId, document }),
    saveSettings: async (
      owner: string,
      projectId: string,
      document: ProjectSettingsDocument,
    ) => store.saveSettings({ ownerId: owner, projectId, document }),
    deleteProject: async (owner, projectId) =>
      store.deleteProject({ ownerId: owner, projectId }),
  };
  const resources: ResourceRepository = {
    list: async (owner, projectId) =>
      (await store.listResources({
        ownerId: owner,
        projectId,
      })) as readonly ResourceMetadata[],
    put: async (input: PutResourceInput) =>
      (await store.putResource(input)) as ResourceReference,
    read: (owner, projectId, resourceId) =>
      store.readResource({ ownerId: owner, projectId, resourceId }),
    delete: (owner, projectId, resourceId) =>
      store.deleteResource({ ownerId: owner, projectId, resourceId }),
  };
  return { projects, resources };
}

describe("InternalProjectProvisioner", () => {
  let temporaryPath: string;
  let rootPath: string;

  beforeEach(async () => {
    temporaryPath = await mkdtemp(path.join(tmpdir(), "aircraft-provisioner-"));
    rootPath = path.join(temporaryPath, "local-projects");
  });

  afterEach(async () => {
    await rm(temporaryPath, { recursive: true, force: true });
  });

  it("materializes a typed seed through the physical encrypted storage pipeline", async () => {
    const first = buildFileStore(rootPath);
    const repositories = repositoryAdapters(first.store);
    const provisioner = new InternalProjectProvisioner(
      repositories.projects,
      repositories.resources,
    );
    const screenId = "screen-seeded";
    const bindingKey = screenId + ":button-main:on-clic-event";
    const bytes = Uint8Array.from([0, 4, 8, 15, 16, 23, 42, 255]);

    const provisioned = await provisioner.provision({
      project: {
        ownerId,
        name: "Provisioned Aircraft Project",
        description: "Created from typed Aircraft data",
        schemaVersion: "snapshot-1",
        schemaSourceRevision: "aircraft-android-test",
      },
      metadata: {
        status: "ACTIVE",
        icon: "CHART",
        accent: "PURPLE",
      },
      screens: [
        {
          screenId,
          name: "Provisioned Home",
          description: "Typed screen",
          context: "interface",
          isInitial: true,
          order: 0,
          layout: {
            id: "body-seeded",
            kind: "body",
            columns: [
              {
                id: "column-seeded",
                kind: "column",
                weight: 1,
                rows: [],
              },
            ],
          },
          graphs: {
            [bindingKey]: {
              nodes: [
                {
                  id: "event-on-click",
                  kind: "event",
                  type: "on-clic-event",
                  label: "On click",
                  properties: {},
                },
                {
                  id: "trigger-navigation",
                  kind: "trigger",
                  type: "Navigation",
                  label: "Navigation",
                  properties: {},
                },
              ],
              edges: [
                {
                  id: "edge-navigation",
                  source: "event-on-click",
                  target: "trigger-navigation",
                },
              ],
              selectedNodeId: "trigger-navigation",
            },
          },
        },
      ],
      settings: {
        activeScreenId: screenId,
        activeWorkspace: "triggers",
        selectedDevice: "pixel-8-pro",
        zoom: 125,
      },
      resources: [
        {
          name: "seed.bin",
          mimeType: "application/octet-stream",
          bytes,
          tags: ["internal"],
        },
      ],
    });

    const projectId = provisioned.project.manifest.projectId;
    const projectPath = path.join(
      rootPath,
      "users",
      first.keys.ownerKey(ownerId),
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
        "resources",
        "settings",
      ]),
    );

    const fresh = buildFileStore(rootPath);
    const loaded = (await fresh.store.load(
      ownerId,
      projectId,
    )) as unknown as AircraftProject;
    expect(loaded.metadata).toMatchObject({
      name: "Provisioned Aircraft Project",
      status: "ACTIVE",
      icon: "CHART",
      accent: "PURPLE",
    });
    expect(loaded.screens).toEqual([
      expect.objectContaining({
        screenId,
        name: "Provisioned Home",
        isInitial: true,
      }),
    ]);
    expect(loaded.layouts[screenId].tree.id).toBe("body-seeded");
    expect(loaded.triggerGraphs[screenId].graphs[bindingKey]).toMatchObject({
      selectedNodeId: "trigger-navigation",
      nodes: [
        expect.objectContaining({ type: "on-clic-event" }),
        expect.objectContaining({ type: "Navigation" }),
      ],
    });
    expect(loaded.settings).toMatchObject({
      activeScreenId: screenId,
      activeWorkspace: "triggers",
      selectedDevice: "pixel-8-pro",
      zoom: 125,
    });
    expect(
      await fresh.store.readResource({
        ownerId,
        projectId,
        resourceId: provisioned.resources[0].resourceId,
      }),
    ).toEqual(bytes);
  });
});
