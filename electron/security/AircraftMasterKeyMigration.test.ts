/** @jest-environment node */

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SafeStorage } from "electron";
import type { AircraftProject } from "../../src/modules/local-project/domain/models";
import { AtomicFileStore } from "../storage/AtomicFileStore";
import { KeyManager } from "../storage/KeyManager";
import { LocalProjectFileStore } from "../storage/LocalProjectFileStore";
import {
  AircraftMasterKeyMigration,
  AircraftMasterKeyMigrationError,
} from "./AircraftMasterKeyMigration";

class TestSafeStorage {
  available = true;
  private nonce = 0;

  readonly api = {
    isEncryptionAvailable: () => this.available,
    encryptString: (value: string) =>
      Buffer.from("cipher-" + ++this.nonce + "|" + value, "utf8"),
    decryptString: (value: Buffer) => {
      const serialized = value.toString("utf8");
      const delimiter = serialized.indexOf("|");
      if (delimiter < 0) throw new Error("corrupt protected key");
      return serialized.slice(delimiter + 1);
    },
  } as unknown as SafeStorage;

  protect(key: Buffer, ciphertextId: string): Buffer {
    return Buffer.from(
      ciphertextId + "|" + key.toString("base64"),
      "utf8",
    );
  }
}

class FailingWriteStore extends AtomicFileStore {
  override async write(): Promise<void> {
    throw new Error("simulated write failure");
  }
}

describe("AircraftMasterKeyMigration", () => {
  let temporaryPath: string;
  let legacyPath: string;
  let workspacePath: string;
  let files: AtomicFileStore;
  let safeStorage: TestSafeStorage;

  beforeEach(async () => {
    temporaryPath = await mkdtemp(path.join(tmpdir(), "aircraft-key-migration-"));
    legacyPath = path.join(temporaryPath, "legacy", ".master-key");
    workspacePath = path.join(
      temporaryPath,
      "workspace",
      "security",
      ".master-key",
    );
    files = new AtomicFileStore();
    safeStorage = new TestSafeStorage();
  });

  afterEach(async () => {
    await rm(temporaryPath, { recursive: true, force: true });
  });

  function migration(store: AtomicFileStore = files) {
    return new AircraftMasterKeyMigration(safeStorage.api, store);
  }

  async function writeProtected(
    target: string,
    key: Buffer,
    ciphertextId: string,
  ): Promise<Buffer> {
    const protectedBytes = safeStorage.protect(key, ciphertextId);
    await files.write(target, protectedBytes);
    return protectedBytes;
  }

  const request = () => ({
    legacyMasterKeyPath: legacyPath,
    workspaceMasterKeyPath: workspacePath,
  });

  it("returns NOT_REQUIRED without creating either key", async () => {
    await expect(migration().migrate(request())).resolves.toEqual({
      status: "NOT_REQUIRED",
      masterKeyPath: workspacePath,
    });
    await expect(stat(legacyPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(workspacePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("migrates identical protected bytes and preserves the legacy key", async () => {
    const protectedBytes = await writeProtected(
      legacyPath,
      Buffer.alloc(32, 0x11),
      "legacy",
    );

    await expect(migration().migrate(request())).resolves.toEqual({
      status: "MIGRATED",
      masterKeyPath: workspacePath,
    });
    expect(await readFile(workspacePath)).toEqual(protectedBytes);
    expect(await readFile(legacyPath)).toEqual(protectedBytes);
  });

  it("uses a valid workspace key without recreating legacy", async () => {
    await writeProtected(workspacePath, Buffer.alloc(32, 0x22), "workspace");

    await expect(migration().migrate(request())).resolves.toMatchObject({
      status: "WORKSPACE_KEY",
    });
    await expect(stat(legacyPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("verifies identical protected files", async () => {
    const protectedBytes = await writeProtected(
      legacyPath,
      Buffer.alloc(32, 0x33),
      "same",
    );
    await files.write(workspacePath, protectedBytes);

    await expect(migration().migrate(request())).resolves.toMatchObject({
      status: "VERIFIED",
    });
  });

  it("verifies different ciphertexts containing the same master key", async () => {
    const masterKey = Buffer.alloc(32, 0x44);
    await writeProtected(legacyPath, masterKey, "legacy-ciphertext");
    await writeProtected(workspacePath, masterKey, "workspace-ciphertext");

    await expect(migration().migrate(request())).resolves.toMatchObject({
      status: "VERIFIED",
    });
  });

  it("fails closed when legacy and workspace plaintext keys conflict", async () => {
    await writeProtected(legacyPath, Buffer.alloc(32, 0x55), "legacy");
    await writeProtected(workspacePath, Buffer.alloc(32, 0x66), "workspace");

    await expect(migration().migrate(request())).rejects.toMatchObject({
      code: "MASTER_KEY_CONFLICT",
    });
    expect(AircraftMasterKeyMigrationError).toBeDefined();
  });

  it("reports an invalid legacy key", async () => {
    await files.write(legacyPath, Buffer.from("corrupt", "utf8"));

    await expect(migration().migrate(request())).rejects.toMatchObject({
      code: "INVALID_LEGACY_KEY",
    });
  });

  it("reports an invalid workspace key", async () => {
    await files.write(workspacePath, Buffer.from("corrupt", "utf8"));

    await expect(migration().migrate(request())).rejects.toMatchObject({
      code: "INVALID_WORKSPACE_KEY",
    });
  });

  it("fails closed when safeStorage is unavailable for validation", async () => {
    await writeProtected(legacyPath, Buffer.alloc(32, 0x77), "legacy");
    safeStorage.available = false;

    await expect(migration().migrate(request())).rejects.toMatchObject({
      code: "ENCRYPTION_UNAVAILABLE",
    });
  });

  it("leaves legacy intact when the target write fails", async () => {
    const protectedBytes = await writeProtected(
      legacyPath,
      Buffer.alloc(32, 0x88),
      "legacy",
    );

    await expect(
      migration(new FailingWriteStore()).migrate(request()),
    ).rejects.toMatchObject({ code: "WRITE_FAILED" });
    expect(await readFile(legacyPath)).toEqual(protectedBytes);
    await expect(stat(workspacePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("loads legacy project files after moving only the master key", async () => {
    const legacyProjectRoot = path.join(temporaryPath, "legacy-projects");
    legacyPath = path.join(legacyProjectRoot, ".master-key");
    const legacyKeys = new KeyManager(legacyPath, safeStorage.api, files);
    const legacyStore = new LocalProjectFileStore(
      legacyProjectRoot,
      legacyKeys,
      files,
    );
    const created = (await legacyStore.create({
      ownerId: "usr-admin-001",
      name: "Legacy project",
      description: "Key moves, project remains",
      schemaVersion: "snapshot-1",
      schemaSourceRevision: "migration-test",
    })) as unknown as AircraftProject;

    await migration().migrate(request());

    const workspaceKeys = new KeyManager(
      workspacePath,
      safeStorage.api,
      files,
    );
    const workspaceKeyStore = new LocalProjectFileStore(
      legacyProjectRoot,
      workspaceKeys,
      files,
    );
    const loaded = (await workspaceKeyStore.load(
      created.manifest.ownerId,
      created.manifest.projectId,
    )) as unknown as AircraftProject;

    expect(loaded.metadata.name).toBe("Legacy project");
    expect(loaded.manifest.projectId).toBe(created.manifest.projectId);
    expect((await stat(legacyPath)).isFile()).toBe(true);
    expect((await stat(workspacePath)).isFile()).toBe(true);
  });
});
