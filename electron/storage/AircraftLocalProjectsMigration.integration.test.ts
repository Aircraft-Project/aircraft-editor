/** @jest-environment node */

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SafeStorage } from "electron";
import type { AircraftProject } from "../../src/modules/local-project/domain/models";
import { AircraftLocalProjectsMigration } from "./AircraftLocalProjectsMigration";
import { AIRCRAFT_LOCAL_PROJECT_STORE_MARKER } from "./AircraftLocalProjectStoreConfig";
import { AtomicFileStore } from "./AtomicFileStore";
import { KeyManager } from "./KeyManager";
import { LocalProjectFileStore } from "./LocalProjectFileStore";

const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) =>
    Buffer.from("protected|" + value, "utf8"),
  decryptString: (value: Buffer) => {
    const serialized = value.toString("utf8");
    if (!serialized.startsWith("protected|")) throw new Error("corrupt");
    return serialized.slice("protected|".length);
  },
} as unknown as SafeStorage;

describe("Aircraft local project store migration integration", () => {
  let temporaryPath: string;

  beforeEach(async () => {
    temporaryPath = await mkdtemp(
      path.join(tmpdir(), "aircraft-store-integration-"),
    );
  });

  afterEach(async () => {
    await rm(temporaryPath, { recursive: true, force: true });
  });

  it("moves only project bytes, opens them from workspace, and leaves legacy unchanged", async () => {
    const files = new AtomicFileStore();
    const legacyRoot = path.join(temporaryPath, "legacy-local-projects");
    const workspaceRoot = path.join(
      temporaryPath,
      "workspace",
      "local-projects",
    );
    const masterKeyPath = path.join(
      temporaryPath,
      "workspace",
      "security",
      ".master-key",
    );
    const ownerId = "usr-admin-001";

    const legacyKeys = new KeyManager(
      masterKeyPath,
      fakeSafeStorage,
      files,
    );
    const legacyStore = new LocalProjectFileStore(
      legacyRoot,
      legacyKeys,
      files,
    );
    const created = (await legacyStore.create({
      ownerId,
      name: "Legacy migration project",
      description: "Created before project-root migration",
      schemaVersion: "snapshot-1",
      schemaSourceRevision: "migration-integration",
    })) as unknown as AircraftProject;
    const projectId = created.manifest.projectId;
    const screenId = created.screens[0].screenId;
    const updatedLayout = {
      ...created.layouts[screenId],
      tree: {
        ...created.layouts[screenId].tree,
        properties: {
          ...created.layouts[screenId].tree.properties,
          text: "Persisted before migration",
        },
      },
    };
    await legacyStore.saveLayout({
      ownerId,
      projectId,
      document: updatedLayout,
    });

    const legacyProjectPath = path.join(
      legacyRoot,
      "users",
      legacyKeys.ownerKey(ownerId),
      "projects",
      projectId,
    );
    const legacyMetadataPath = path.join(
      legacyProjectPath,
      "metadata",
      "project.airmeta",
    );
    const legacyLayoutPath = path.join(
      legacyProjectPath,
      "layouts",
      screenId + ".airlayout",
    );
    const legacySnapshot = (await legacyStore.load(
      ownerId,
      projectId,
    )) as unknown as AircraftProject;
    const metadataBefore = await readFile(legacyMetadataPath);
    const layoutBefore = await readFile(legacyLayoutPath);

    const result = await new AircraftLocalProjectsMigration(files).migrate({
      legacyProjectRoot: legacyRoot,
      workspaceProjectRoot: workspaceRoot,
    });
    expect(result).toEqual({
      status: "MIGRATED",
      projectRootPath: workspaceRoot,
    });

    const workspaceKeys = new KeyManager(
      masterKeyPath,
      fakeSafeStorage,
      files,
    );
    const workspaceStore = new LocalProjectFileStore(
      workspaceRoot,
      workspaceKeys,
      files,
    );
    const loaded = (await workspaceStore.load(
      ownerId,
      projectId,
    )) as unknown as AircraftProject;

    expect(loaded.metadata).toEqual(legacySnapshot.metadata);
    expect(loaded.screens).toEqual(legacySnapshot.screens);
    expect(loaded.layouts[screenId]).toEqual(updatedLayout);
    expect(await workspaceStore.listByOwner("usr-developer-001")).toEqual([]);

    const renamed = {
      ...loaded.metadata,
      name: "Workspace project updated",
      updatedAt: new Date().toISOString(),
    };
    await workspaceStore.saveMetadata({
      ownerId,
      projectId,
      document: renamed,
    });

    const reopenedKeys = new KeyManager(
      masterKeyPath,
      fakeSafeStorage,
      files,
    );
    const reopenedStore = new LocalProjectFileStore(
      workspaceRoot,
      reopenedKeys,
      files,
    );
    const reopened = (await reopenedStore.load(
      ownerId,
      projectId,
    )) as unknown as AircraftProject;

    expect(reopened.metadata.name).toBe("Workspace project updated");
    expect(await readFile(legacyMetadataPath)).toEqual(metadataBefore);
    expect(await readFile(legacyLayoutPath)).toEqual(layoutBefore);
    expect((await stat(masterKeyPath)).isFile()).toBe(true);
    await expect(stat(path.join(workspaceRoot, ".master-key")))
      .rejects.toMatchObject({ code: "ENOENT" });
    expect(
      (
        await stat(
          path.join(workspaceRoot, AIRCRAFT_LOCAL_PROJECT_STORE_MARKER),
        )
      ).isFile(),
    ).toBe(true);
  });
});
