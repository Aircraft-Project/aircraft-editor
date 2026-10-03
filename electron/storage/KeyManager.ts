import { createHash, hkdfSync, randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SafeStorage } from "electron";
import { decodeProtectedMasterKey } from "../security/MasterKeyProtection";
import { AtomicFileStore } from "./AtomicFileStore";

export class LocalStorageUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Encrypted local project storage is not available.", options);
    this.name = "LocalStorageUnavailableError";
  }
}

export class KeyManager {
  private masterKeyPromise: Promise<Buffer> | null = null;

  constructor(
    private readonly masterKeyPath: string,
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

    try {
      const protectedKey = await readFile(this.masterKeyPath);
      try {
        return decodeProtectedMasterKey(protectedKey, this.safeStorage);
      } catch (error) {
        throw new LocalStorageUnavailableError({ cause: error });
      }
    } catch (error) {
      if (error instanceof LocalStorageUnavailableError) throw error;
      if (!isMissingFile(error)) throw error;
    }

    await mkdir(path.dirname(this.masterKeyPath), { recursive: true });
    const key = randomBytes(32);
    const protectedKey = this.safeStorage.encryptString(
      key.toString("base64"),
    );
    await this.files.write(this.masterKeyPath, protectedKey);
    return key;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}
