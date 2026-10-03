/** @jest-environment node */

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SafeStorage } from "electron";
import { AtomicFileStore } from "./AtomicFileStore";
import { KeyManager, LocalStorageUnavailableError } from "./KeyManager";

const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from("protected|" + value, "utf8"),
  decryptString: (value: Buffer) => {
    const serialized = value.toString("utf8");
    if (!serialized.startsWith("protected|")) throw new Error("corrupt");
    return serialized.slice("protected|".length);
  },
} as unknown as SafeStorage;

describe("KeyManager", () => {
  let temporaryPath: string;
  let projectRootPath: string;
  let masterKeyPath: string;
  let files: AtomicFileStore;

  beforeEach(async () => {
    temporaryPath = await mkdtemp(path.join(tmpdir(), "aircraft-key-manager-"));
    projectRootPath = path.join(temporaryPath, "legacy-projects");
    masterKeyPath = path.join(
      temporaryPath,
      "workspace",
      "security",
      ".master-key",
    );
    files = new AtomicFileStore();
  });

  afterEach(async () => {
    await rm(temporaryPath, { recursive: true, force: true });
  });

  it("creates the protected key at the explicit masterKeyPath only", async () => {
    const keys = new KeyManager(masterKeyPath, fakeSafeStorage, files);

    await keys.projectKey("owner-a", "project-a");

    expect((await stat(masterKeyPath)).isFile()).toBe(true);
    await expect(
      stat(path.join(projectRootPath, ".master-key")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("loads the same existing master key from masterKeyPath", async () => {
    const first = new KeyManager(masterKeyPath, fakeSafeStorage, files);
    const expected = await first.projectKey("owner-a", "project-a");
    const protectedBytes = await readFile(masterKeyPath);

    const second = new KeyManager(masterKeyPath, fakeSafeStorage, files);
    const loaded = await second.projectKey("owner-a", "project-a");

    expect(loaded.equals(expected)).toBe(true);
    expect(await readFile(masterKeyPath)).toEqual(protectedBytes);
  });

  it("keeps owner and project derivation domains independent", async () => {
    const keys = new KeyManager(masterKeyPath, fakeSafeStorage, files);

    const ownerAProjectA = await keys.projectKey("owner-a", "project-a");
    const ownerAProjectB = await keys.projectKey("owner-a", "project-b");
    const ownerBProjectA = await keys.projectKey("owner-b", "project-a");

    expect(ownerAProjectA.equals(ownerAProjectB)).toBe(false);
    expect(ownerAProjectA.equals(ownerBProjectA)).toBe(false);
  });

  it("fails closed when operating-system protection is unavailable", async () => {
    const unavailable = {
      isEncryptionAvailable: () => false,
    } as unknown as SafeStorage;
    const keys = new KeyManager(masterKeyPath, unavailable, files);

    await expect(keys.projectKey("owner-a", "project-a")).rejects
      .toBeInstanceOf(LocalStorageUnavailableError);
  });

  it("rejects an existing protected key that does not decode to 32 bytes", async () => {
    await files.write(
      masterKeyPath,
      fakeSafeStorage.encryptString(Buffer.alloc(16).toString("base64")),
    );
    const keys = new KeyManager(masterKeyPath, fakeSafeStorage, files);

    await expect(keys.projectKey("owner-a", "project-a")).rejects
      .toBeInstanceOf(LocalStorageUnavailableError);
  });
});
