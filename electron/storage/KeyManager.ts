import { createHash, hkdfSync, randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SafeStorage } from "electron";
import { AtomicFileStore } from "./AtomicFileStore";

export class LocalStorageUnavailableError extends Error {
  constructor() {
    super("Encrypted local project storage is not available.");
    this.name = "LocalStorageUnavailableError";
  }
}

export class KeyManager {
  private masterKeyPromise: Promise<Buffer> | null = null;

  constructor(
    private readonly rootPath: string,
    private readonly safeStorage: SafeStorage,
    private readonly files: AtomicFileStore,
  ) {}

  ownerKey(ownerId: string): string {
    return createHash("sha256").update(ownerId, "utf8").digest("hex");
  }

  async projectKey(
    ownerId: string,
    projectId: string,
  ): Promise<Buffer> {
    const masterKey = await this.masterKey();
    const ownerKey = Buffer.from(
      hkdfSync(
        "sha256",
        masterKey,
        Buffer.from(ownerId, "utf8"),
        Buffer.from("aircraft:user:v1", "utf8"),
        32,
      ),
    );
    return Buffer.from(
      hkdfSync(
        "sha256",
        ownerKey,
        Buffer.from(projectId, "utf8"),
        Buffer.from("aircraft:project:v1", "utf8"),
        32,
      ),
    );
  }

  private masterKey(): Promise<Buffer> {
    this.masterKeyPromise ??= this.loadOrCreateMasterKey();
    return this.masterKeyPromise;
  }

  private async loadOrCreateMasterKey(): Promise<Buffer> {
    if (!this.safeStorage.isEncryptionAvailable()) {
      throw new LocalStorageUnavailableError();
    }
    const keyPath = path.join(this.rootPath, ".master-key");
    try {
      const protectedKey = await readFile(keyPath);
      const plaintext = this.safeStorage.decryptString(protectedKey);
      const key = Buffer.from(plaintext, "base64");
      if (key.length !== 32) throw new LocalStorageUnavailableError();
      return key;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") throw error;
    }

    await mkdir(this.rootPath, { recursive: true });
    const key = randomBytes(32);
    const protectedKey = this.safeStorage.encryptString(
      key.toString("base64"),
    );
    await this.files.write(keyPath, protectedKey);
    return key;
  }
}
