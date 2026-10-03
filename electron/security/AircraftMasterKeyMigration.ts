import { timingSafeEqual } from "node:crypto";
import type { SafeStorage } from "electron";
import {
  decodeProtectedMasterKey,
  ProtectedMasterKeyError,
} from "./MasterKeyProtection";

export type AircraftMasterKeyMigrationStatus =
  | "NOT_REQUIRED"
  | "MIGRATED"
  | "WORKSPACE_KEY"
  | "VERIFIED";

export type AircraftMasterKeyMigrationErrorCode =
  | "ENCRYPTION_UNAVAILABLE"
  | "INVALID_LEGACY_KEY"
  | "INVALID_WORKSPACE_KEY"
  | "MASTER_KEY_CONFLICT"
  | "READ_FAILED"
  | "WRITE_FAILED";

export interface AircraftMasterKeyMigrationRequest {
  readonly legacyMasterKeyPath: string;
  readonly workspaceMasterKeyPath: string;
}

export interface AircraftMasterKeyMigrationResult {
  readonly status: AircraftMasterKeyMigrationStatus;
  readonly masterKeyPath: string;
}

export class AircraftMasterKeyMigrationError extends Error {
  constructor(
    readonly code: AircraftMasterKeyMigrationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AircraftMasterKeyMigrationError";
  }
}

interface MasterKeyFiles {
  read(filePath: string): Promise<Uint8Array>;
  write(filePath: string, bytes: Uint8Array): Promise<void>;
}

export class AircraftMasterKeyMigration {
  constructor(
    private readonly safeStorage: SafeStorage,
    private readonly files: MasterKeyFiles,
  ) {}

  async migrate(
    request: AircraftMasterKeyMigrationRequest,
  ): Promise<AircraftMasterKeyMigrationResult> {
    const legacy = await this.readOptional(
      request.legacyMasterKeyPath,
      "legacy",
    );
    const workspace = await this.readOptional(
      request.workspaceMasterKeyPath,
      "workspace",
    );

    if (!legacy && !workspace) {
      return {
        status: "NOT_REQUIRED",
        masterKeyPath: request.workspaceMasterKeyPath,
      };
    }

    if (legacy && !workspace) {
      const legacyMasterKey = this.decode(legacy, "legacy");
      try {
        await this.files.write(request.workspaceMasterKeyPath, legacy);
      } catch (error) {
        throw new AircraftMasterKeyMigrationError(
          "WRITE_FAILED",
          "The workspace master key could not be written.",
          { cause: error },
        );
      }

      const copied = await this.readRequiredWorkspace(
        request.workspaceMasterKeyPath,
      );
      const copiedMasterKey = this.decode(copied, "workspace");
      if (
        !this.bytesEqual(legacy, copied) ||
        !timingSafeEqual(legacyMasterKey, copiedMasterKey)
      ) {
        throw new AircraftMasterKeyMigrationError(
          "WRITE_FAILED",
          "The migrated workspace master key could not be verified.",
        );
      }
      return {
        status: "MIGRATED",
        masterKeyPath: request.workspaceMasterKeyPath,
      };
    }

    if (!legacy && workspace) {
      this.decode(workspace, "workspace");
      return {
        status: "WORKSPACE_KEY",
        masterKeyPath: request.workspaceMasterKeyPath,
      };
    }

    const legacyMasterKey = this.decode(legacy!, "legacy");
    const workspaceMasterKey = this.decode(workspace!, "workspace");
    if (!timingSafeEqual(legacyMasterKey, workspaceMasterKey)) {
      throw new AircraftMasterKeyMigrationError(
        "MASTER_KEY_CONFLICT",
        "Legacy and workspace master keys do not match.",
      );
    }

    return {
      status: "VERIFIED",
      masterKeyPath: request.workspaceMasterKeyPath,
    };
  }

  private async readOptional(
    filePath: string,
    source: "legacy" | "workspace",
  ): Promise<Uint8Array | null> {
    try {
      return await this.files.read(filePath);
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw new AircraftMasterKeyMigrationError(
        "READ_FAILED",
        "The " + source + " master key could not be read.",
        { cause: error },
      );
    }
  }

  private async readRequiredWorkspace(filePath: string): Promise<Uint8Array> {
    try {
      return await this.files.read(filePath);
    } catch (error) {
      throw new AircraftMasterKeyMigrationError(
        "WRITE_FAILED",
        "The migrated workspace master key could not be read.",
        { cause: error },
      );
    }
  }

  private decode(
    protectedKey: Uint8Array,
    source: "legacy" | "workspace",
  ): Buffer {
    try {
      return decodeProtectedMasterKey(protectedKey, this.safeStorage);
    } catch (error) {
      if (
        error instanceof ProtectedMasterKeyError &&
        error.code === "ENCRYPTION_UNAVAILABLE"
      ) {
        throw new AircraftMasterKeyMigrationError(
          "ENCRYPTION_UNAVAILABLE",
          "Operating-system key protection is unavailable.",
          { cause: error },
        );
      }
      throw new AircraftMasterKeyMigrationError(
        source === "legacy"
          ? "INVALID_LEGACY_KEY"
          : "INVALID_WORKSPACE_KEY",
        "The " + source + " master key is invalid.",
        { cause: error },
      );
    }
  }

  private bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    return (
      left.byteLength === right.byteLength &&
      timingSafeEqual(Buffer.from(left), Buffer.from(right))
    );
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
