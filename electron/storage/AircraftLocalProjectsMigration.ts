import {
  constants,
  copyFile,
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { AtomicFileStore } from "./AtomicFileStore";
import {
  AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
  AIRCRAFT_LOCAL_PROJECT_STORE_VERSION,
  DEFAULT_AIRCRAFT_LOCAL_PROJECT_STORE_CONFIG,
  type AircraftLocalProjectStoreConfig,
} from "./AircraftLocalProjectStoreConfig";

export type AircraftLocalProjectsMigrationStatus =
  | "EMPTY_INITIALIZED"
  | "MIGRATED"
  | "RESUMED"
  | "WORKSPACE_STORE";

export type AircraftLocalProjectsMigrationErrorCode =
  | "INVALID_MARKER"
  | "UNSUPPORTED_STORAGE_VERSION"
  | "FILE_CONFLICT"
  | "TARGET_EXTRA_DATA"
  | "TARGET_MASTER_KEY_ARTIFACT"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "VERIFY_FAILED";

export interface AircraftLocalProjectsMigrationRequest {
  readonly legacyProjectRoot: string;
  readonly workspaceProjectRoot: string;
}

export interface AircraftLocalProjectsMigrationResult {
  readonly status: AircraftLocalProjectsMigrationStatus;
  readonly projectRootPath: string;
}

export class AircraftLocalProjectsMigrationError extends Error {
  constructor(
    readonly code: AircraftLocalProjectsMigrationErrorCode,
    message: string,
    readonly relativePath?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AircraftLocalProjectsMigrationError";
  }
}

interface MigrationFiles {
  read(filePath: string): Promise<Uint8Array>;
  write(filePath: string, bytes: Uint8Array): Promise<void>;
}

export interface ProjectFileCopier {
  copy(sourcePath: string, targetPath: string): Promise<void>;
}

export class AtomicProjectFileCopier implements ProjectFileCopier {
  async copy(sourcePath: string, targetPath: string): Promise<void> {
    await mkdir(path.dirname(targetPath), { recursive: true });
    const temporaryPath =
      targetPath + ".aircraft-migration-" + randomUUID() + ".tmp";

    try {
      await copyFile(sourcePath, temporaryPath, constants.COPYFILE_EXCL);
      const handle = await open(temporaryPath, "r+");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }

      if (!(await filesHaveEqualContent(sourcePath, temporaryPath))) {
        throw new AircraftLocalProjectsMigrationError(
          "VERIFY_FAILED",
          "A copied project file could not be verified.",
        );
      }
      await rename(temporaryPath, targetPath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}

type TreeEntryKind = "directory" | "file";

interface TreeEntry {
  readonly kind: TreeEntryKind;
  readonly fullPath: string;
  readonly relativePath: string;
}

const MIGRATION_TEMP_PATTERN =
  /\.aircraft-migration-[0-9a-f-]+\.tmp$/i;

export class AircraftLocalProjectsMigration {
  constructor(
    private readonly files: MigrationFiles = new AtomicFileStore(),
    private readonly copier: ProjectFileCopier =
      new AtomicProjectFileCopier(),
  ) {}

  async migrate(
    request: AircraftLocalProjectsMigrationRequest,
  ): Promise<AircraftLocalProjectsMigrationResult> {
    try {
      await mkdir(request.workspaceProjectRoot, { recursive: true });
    } catch (error) {
      throw new AircraftLocalProjectsMigrationError(
        "WRITE_FAILED",
        "The workspace project store could not be created.",
        undefined,
        { cause: error },
      );
    }
    await this.rejectTargetMasterKey(request.workspaceProjectRoot);

    const markerPath = path.join(
      request.workspaceProjectRoot,
      AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
    );
    const marker = await this.readMarker(markerPath);
    if (marker) {
      return {
        status: "WORKSPACE_STORE",
        projectRootPath: request.workspaceProjectRoot,
      };
    }

    await cleanupMigrationTemps(request.workspaceProjectRoot);

    const sourceUsers = path.join(request.legacyProjectRoot, "users");
    const sourceEntries = await this.readSourceTree(sourceUsers);
    const targetEntries = await scanTree(request.workspaceProjectRoot, {
      excludeMarker: true,
    });

    if (!sourceEntries) {
      this.rejectExtraTargetData(targetEntries, new Map());
      await this.writeMarker(markerPath);
      return {
        status: "EMPTY_INITIALIZED",
        projectRootPath: request.workspaceProjectRoot,
      };
    }

    this.rejectExtraTargetData(targetEntries, sourceEntries);
    await this.verifyExistingTargetEntries(sourceEntries, targetEntries);

    const hadPartialData = targetEntries.size > 0;
    await this.copyMissingEntries(
      sourceEntries,
      targetEntries,
      request.workspaceProjectRoot,
    );

    const verifiedTarget = await scanTree(request.workspaceProjectRoot, {
      excludeMarker: true,
    });
    this.rejectExtraTargetData(verifiedTarget, sourceEntries);
    await this.verifyExistingTargetEntries(sourceEntries, verifiedTarget);
    await this.writeMarker(markerPath);

    return {
      status: hadPartialData ? "RESUMED" : "MIGRATED",
      projectRootPath: request.workspaceProjectRoot,
    };
  }

  private async rejectTargetMasterKey(targetRoot: string): Promise<void> {
    const accidentalKey = path.join(targetRoot, ".master-key");
    if (await pathExists(accidentalKey)) {
      throw new AircraftLocalProjectsMigrationError(
        "TARGET_MASTER_KEY_ARTIFACT",
        "The workspace project store contains an unexpected master-key artifact.",
        ".master-key",
      );
    }
  }

  private async readMarker(
    markerPath: string,
  ): Promise<AircraftLocalProjectStoreConfig | null> {
    let bytes: Uint8Array;
    try {
      bytes = await this.files.read(markerPath);
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw new AircraftLocalProjectsMigrationError(
        "READ_FAILED",
        "The local project store marker could not be read.",
        AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
        { cause: error },
      );
    }

    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    } catch (error) {
      throw new AircraftLocalProjectsMigrationError(
        "INVALID_MARKER",
        "The local project store marker is not valid JSON.",
        AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
        { cause: error },
      );
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new AircraftLocalProjectsMigrationError(
        "INVALID_MARKER",
        "The local project store marker has an invalid structure.",
        AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
      );
    }

    const storageVersion = (value as Record<string, unknown>).storageVersion;
    if (storageVersion !== AIRCRAFT_LOCAL_PROJECT_STORE_VERSION) {
      throw new AircraftLocalProjectsMigrationError(
        typeof storageVersion === "number"
          ? "UNSUPPORTED_STORAGE_VERSION"
          : "INVALID_MARKER",
        "The local project store marker version is unsupported.",
        AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
      );
    }
    return DEFAULT_AIRCRAFT_LOCAL_PROJECT_STORE_CONFIG;
  }

  private async writeMarker(markerPath: string): Promise<void> {
    const serialized =
      JSON.stringify(DEFAULT_AIRCRAFT_LOCAL_PROJECT_STORE_CONFIG, null, 2) +
      "\n";
    try {
      await this.files.write(
        markerPath,
        new TextEncoder().encode(serialized),
      );
    } catch (error) {
      throw new AircraftLocalProjectsMigrationError(
        "WRITE_FAILED",
        "The local project store marker could not be written.",
        AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
        { cause: error },
      );
    }
  }

  private async readSourceTree(
    sourceUsersPath: string,
  ): Promise<Map<string, TreeEntry> | null> {
    const sourceStat = await lstatOptional(sourceUsersPath);
    if (!sourceStat) return null;
    if (!sourceStat.isDirectory()) {
      throw new AircraftLocalProjectsMigrationError(
        "READ_FAILED",
        "The legacy users entry is not a directory.",
        "users",
      );
    }

    const entries = new Map<string, TreeEntry>();
    entries.set("users", {
      kind: "directory",
      fullPath: sourceUsersPath,
      relativePath: "users",
    });
    await collectTreeEntries(
      sourceUsersPath,
      path.dirname(sourceUsersPath),
      entries,
    );
    return entries;
  }

  private rejectExtraTargetData(
    targetEntries: Map<string, TreeEntry>,
    sourceEntries: Map<string, TreeEntry>,
  ): void {
    for (const [relativePath, target] of targetEntries) {
      const source = sourceEntries.get(relativePath);
      if (!source) {
        throw new AircraftLocalProjectsMigrationError(
          "TARGET_EXTRA_DATA",
          "The workspace project store contains data absent from the legacy source.",
          relativePath,
        );
      }
      if (source.kind !== target.kind) {
        throw new AircraftLocalProjectsMigrationError(
          "FILE_CONFLICT",
          "Legacy and workspace project entries have different types.",
          relativePath,
        );
      }
    }
  }

  private async verifyExistingTargetEntries(
    sourceEntries: Map<string, TreeEntry>,
    targetEntries: Map<string, TreeEntry>,
  ): Promise<void> {
    for (const [relativePath, source] of sourceEntries) {
      const target = targetEntries.get(relativePath);
      if (!target || source.kind === "directory") continue;
      let equal: boolean;
      try {
        equal = await filesHaveEqualContent(source.fullPath, target.fullPath);
      } catch (error) {
        throw new AircraftLocalProjectsMigrationError(
          "VERIFY_FAILED",
          "Legacy and workspace project files could not be compared.",
          relativePath,
          { cause: error },
        );
      }
      if (!equal) {
        throw new AircraftLocalProjectsMigrationError(
          "FILE_CONFLICT",
          "Legacy and workspace project files differ.",
          relativePath,
        );
      }
    }
  }

  private async copyMissingEntries(
    sourceEntries: Map<string, TreeEntry>,
    targetEntries: Map<string, TreeEntry>,
    targetRoot: string,
  ): Promise<void> {
    const ordered = [...sourceEntries.values()].sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }
      return left.relativePath.localeCompare(right.relativePath);
    });

    for (const source of ordered) {
      if (targetEntries.has(source.relativePath)) continue;
      const targetPath = path.join(
        targetRoot,
        ...source.relativePath.split("/"),
      );
      if (source.kind === "directory") {
        try {
          await mkdir(targetPath, { recursive: true });
        } catch (error) {
          throw new AircraftLocalProjectsMigrationError(
            "WRITE_FAILED",
            "A workspace project directory could not be created.",
            source.relativePath,
            { cause: error },
          );
        }
        continue;
      }

      try {
        await this.copier.copy(source.fullPath, targetPath);
      } catch (error) {
        if (error instanceof AircraftLocalProjectsMigrationError) throw error;
        throw new AircraftLocalProjectsMigrationError(
          "WRITE_FAILED",
          "A project file could not be copied.",
          source.relativePath,
          { cause: error },
        );
      }
    }
  }
}

async function scanTree(
  rootPath: string,
  options: { readonly excludeMarker: boolean },
): Promise<Map<string, TreeEntry>> {
  const entries = new Map<string, TreeEntry>();
  const rootStat = await lstatOptional(rootPath);
  if (!rootStat) return entries;
  if (!rootStat.isDirectory()) {
    throw new AircraftLocalProjectsMigrationError(
      "READ_FAILED",
      "The local project store root is not a directory.",
    );
  }
  await collectTreeEntries(rootPath, rootPath, entries, options);
  return entries;
}

async function collectTreeEntries(
  currentPath: string,
  rootPath: string,
  entries: Map<string, TreeEntry>,
  options: { readonly excludeMarker?: boolean } = {},
): Promise<void> {
  let children;
  try {
    children = await readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    throw new AircraftLocalProjectsMigrationError(
      "READ_FAILED",
      "A project directory could not be read.",
      toPortableRelative(rootPath, currentPath),
      { cause: error },
    );
  }

  for (const child of children) {
    if (
      options.excludeMarker &&
      currentPath === rootPath &&
      child.name === AIRCRAFT_LOCAL_PROJECT_STORE_MARKER
    ) {
      continue;
    }
    const fullPath = path.join(currentPath, child.name);
    const relativePath = toPortableRelative(rootPath, fullPath);

    if (child.isSymbolicLink()) {
      throw new AircraftLocalProjectsMigrationError(
        "READ_FAILED",
        "Symbolic links are not supported in the local project store.",
        relativePath,
      );
    }
    if (child.isDirectory()) {
      entries.set(relativePath, {
        kind: "directory",
        fullPath,
        relativePath,
      });
      await collectTreeEntries(fullPath, rootPath, entries, options);
      continue;
    }
    if (child.isFile()) {
      entries.set(relativePath, {
        kind: "file",
        fullPath,
        relativePath,
      });
      continue;
    }
    throw new AircraftLocalProjectsMigrationError(
      "READ_FAILED",
      "An unsupported filesystem entry exists in the local project store.",
      relativePath,
    );
  }
}

async function cleanupMigrationTemps(
  currentPath: string,
  rootPath: string = currentPath,
): Promise<void> {
  const rootStat = await lstatOptional(currentPath);
  if (!rootStat?.isDirectory()) return;

  let children;
  try {
    children = await readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    throw new AircraftLocalProjectsMigrationError(
      "READ_FAILED",
      "A workspace project directory could not be inspected for migration artifacts.",
      toPortableRelative(rootPath, currentPath),
      { cause: error },
    );
  }

  for (const child of children) {
    const fullPath = path.join(currentPath, child.name);
    if (child.isDirectory()) {
      await cleanupMigrationTemps(fullPath, rootPath);
    } else if (child.isFile() && MIGRATION_TEMP_PATTERN.test(child.name)) {
      try {
        await rm(fullPath, { force: true });
      } catch (error) {
        throw new AircraftLocalProjectsMigrationError(
          "WRITE_FAILED",
          "An incomplete migration artifact could not be removed.",
          toPortableRelative(rootPath, fullPath),
          { cause: error },
        );
      }
    }
  }
}

async function filesHaveEqualContent(
  leftPath: string,
  rightPath: string,
): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    sha256File(leftPath),
    sha256File(rightPath),
  ]);
  return timingSafeEqual(leftHash, rightHash);
}

async function sha256File(filePath: string): Promise<Buffer> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest();
}

async function lstatOptional(filePath: string) {
  try {
    return await lstat(filePath);
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw new AircraftLocalProjectsMigrationError(
      "READ_FAILED",
      "A local project store entry could not be inspected.",
      undefined,
      { cause: error },
    );
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  return (await lstatOptional(filePath)) !== null;
}

function toPortableRelative(rootPath: string, fullPath: string): string {
  return path.relative(rootPath, fullPath).split(path.sep).join("/");
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}
