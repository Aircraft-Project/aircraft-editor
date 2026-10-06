/** @jest-environment node */

import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AtomicFileStore } from "./AtomicFileStore";
import {
  AircraftLocalProjectsMigration,
  AircraftLocalProjectsMigrationError,
  AtomicProjectFileCopier,
  type ProjectFileCopier,
} from "./AircraftLocalProjectsMigration";
import {
  AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
  DEFAULT_AIRCRAFT_LOCAL_PROJECT_STORE_CONFIG,
} from "./AircraftLocalProjectStoreConfig";

class InterruptingCopier implements ProjectFileCopier {
  private copied = false;
  private readonly delegate = new AtomicProjectFileCopier();

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    await this.delegate.copy(sourcePath, targetPath);
    if (!this.copied) {
      this.copied = true;
      throw new Error("simulated interruption");
    }
  }
}

describe("AircraftLocalProjectsMigration", () => {
  let temporaryPath: string;
  let legacyRoot: string;
  let targetRoot: string;
  let files: AtomicFileStore;

  beforeEach(async () => {
    temporaryPath = await mkdtemp(
      path.join(tmpdir(), "aircraft-project-migration-"),
    );
    legacyRoot = path.join(temporaryPath, "legacy-local-projects");
    targetRoot = path.join(temporaryPath, "workspace-local-projects");
    files = new AtomicFileStore();
  });

  afterEach(async () => {
    await rm(temporaryPath, { recursive: true, force: true });
  });

  function migrate(
    copier?: ProjectFileCopier,
  ): Promise<{
    readonly status: string;
    readonly projectRootPath: string;
  }> {
    return new AircraftLocalProjectsMigration(
      files,
      copier ?? new AtomicProjectFileCopier(),
    ).migrate({
      legacyProjectRoot: legacyRoot,
      workspaceProjectRoot: targetRoot,
    });
  }

  async function writeLegacy(
    relativePath: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const filePath = path.join(legacyRoot, ...relativePath.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    return filePath;
  }

  async function writeTarget(
    relativePath: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const filePath = path.join(targetRoot, ...relativePath.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    return filePath;
  }

  async function writeMarker(value: unknown): Promise<void> {
    await files.write(
      path.join(targetRoot, AIRCRAFT_LOCAL_PROJECT_STORE_MARKER),
      Buffer.from(JSON.stringify(value), "utf8"),
    );
  }

  it("initializes an empty official store when legacy users do not exist", async () => {
    await expect(migrate()).resolves.toEqual({
      status: "EMPTY_INITIALIZED",
      projectRootPath: targetRoot,
    });
    expect(
      JSON.parse(
        await readFile(
          path.join(targetRoot, AIRCRAFT_LOCAL_PROJECT_STORE_MARKER),
          "utf8",
        ),
      ),
    ).toEqual(DEFAULT_AIRCRAFT_LOCAL_PROJECT_STORE_CONFIG);
    await expect(stat(path.join(targetRoot, "users"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("migrates project bytes losslessly without copying or deleting the legacy master key", async () => {
    const projectBytes = Buffer.from([0, 1, 2, 127, 128, 254, 255]);
    const relative = "users/owner-a/projects/project-a/.aircraft";
    const legacyFile = await writeLegacy(relative, projectBytes);
    const legacyMasterKey = await writeLegacy(
      ".master-key",
      Buffer.from("protected-key-backup", "utf8"),
    );

    await expect(migrate()).resolves.toMatchObject({ status: "MIGRATED" });

    expect(await readFile(path.join(targetRoot, relative))).toEqual(projectBytes);
    expect(await readFile(legacyFile)).toEqual(projectBytes);
    expect(await readFile(legacyMasterKey, "utf8")).toBe(
      "protected-key-backup",
    );
    await expect(stat(path.join(targetRoot, ".master-key")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("resumes partial identical data and fills missing files before marking", async () => {
    const first = Buffer.from("first", "utf8");
    const second = Buffer.from("second", "utf8");
    await writeLegacy(
      "users/owner-a/projects/project-a/metadata/project.airmeta",
      first,
    );
    await writeLegacy(
      "users/owner-a/projects/project-a/layouts/home.airlayout",
      second,
    );
    await writeTarget(
      "users/owner-a/projects/project-a/metadata/project.airmeta",
      first,
    );

    await expect(migrate()).resolves.toMatchObject({ status: "RESUMED" });
    expect(
      await readFile(
        path.join(
          targetRoot,
          "users/owner-a/projects/project-a/layouts/home.airlayout",
        ),
      ),
    ).toEqual(second);
    expect(
      (await stat(
        path.join(targetRoot, AIRCRAFT_LOCAL_PROJECT_STORE_MARKER),
      )).isFile(),
    ).toBe(true);
  });

  it("fails closed when matching files contain different bytes", async () => {
    const relative = "users/owner-a/projects/project-a/.aircraft";
    await writeLegacy(relative, Buffer.from("source", "utf8"));
    await writeTarget(relative, Buffer.from("target", "utf8"));

    await expect(migrate()).rejects.toMatchObject({
      code: "FILE_CONFLICT",
      relativePath: relative,
    });
    expect(AircraftLocalProjectsMigrationError).toBeDefined();
    await expect(
      stat(path.join(targetRoot, AIRCRAFT_LOCAL_PROJECT_STORE_MARKER)),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects target data that has no legacy source equivalent", async () => {
    const extra = "users/owner-extra/projects/project-extra/.aircraft";
    await writeLegacy(
      "users/owner-a/projects/project-a/.aircraft",
      Buffer.from("source", "utf8"),
    );
    await writeTarget(extra, Buffer.from("extra", "utf8"));

    await expect(migrate()).rejects.toMatchObject({
      code: "TARGET_EXTRA_DATA",
    });
  });

  it("uses a valid marker as the authority and does not import legacy again", async () => {
    await writeMarker(DEFAULT_AIRCRAFT_LOCAL_PROJECT_STORE_CONFIG);
    const relative = "users/owner-a/projects/project-a/.aircraft";
    await writeLegacy(relative, Buffer.from("legacy", "utf8"));

    await expect(migrate()).resolves.toEqual({
      status: "WORKSPACE_STORE",
      projectRootPath: targetRoot,
    });
    await expect(stat(path.join(targetRoot, relative))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects corrupt and unsupported markers without replacing them", async () => {
    const markerPath = path.join(
      targetRoot,
      AIRCRAFT_LOCAL_PROJECT_STORE_MARKER,
    );
    await mkdir(targetRoot, { recursive: true });
    await writeFile(markerPath, "{broken", "utf8");

    await expect(migrate()).rejects.toMatchObject({
      code: "INVALID_MARKER",
    });
    expect(await readFile(markerPath, "utf8")).toBe("{broken");

    await writeFile(
      markerPath,
      JSON.stringify({ storageVersion: 2 }),
      "utf8",
    );
    await expect(migrate()).rejects.toMatchObject({
      code: "UNSUPPORTED_STORAGE_VERSION",
    });
  });

  it("returns WORKSPACE_STORE when migration is executed again", async () => {
    await writeLegacy(
      "users/owner-a/projects/project-a/.aircraft",
      Buffer.from("project", "utf8"),
    );
    await expect(migrate()).resolves.toMatchObject({ status: "MIGRATED" });
    await expect(migrate()).resolves.toMatchObject({
      status: "WORKSPACE_STORE",
    });
  });

  it("resumes after interruption before marker creation", async () => {
    await writeLegacy(
      "users/owner-a/projects/project-a/one.airfuture",
      Buffer.from("one", "utf8"),
    );
    await writeLegacy(
      "users/owner-a/projects/project-a/two.airfuture",
      Buffer.from("two", "utf8"),
    );

    await expect(migrate(new InterruptingCopier())).rejects.toMatchObject({
      code: "WRITE_FAILED",
    });
    await expect(
      stat(path.join(targetRoot, AIRCRAFT_LOCAL_PROJECT_STORE_MARKER)),
    ).rejects.toMatchObject({ code: "ENOENT" });

    await expect(migrate()).resolves.toMatchObject({ status: "RESUMED" });
  });

  it("preserves nested unknown files and large binary resources byte-for-byte", async () => {
    const large = Buffer.alloc(3 * 1024 * 1024, 0x7f);
    const relative =
      "users/owner-a/projects/project-a/resources/nested/large.airblob";
    await writeLegacy(relative, large);
    await writeLegacy(
      "users/owner-a/projects/project-a/future/unknown.descriptor",
      Buffer.from([0, 255, 17, 42]),
    );

    await expect(migrate()).resolves.toMatchObject({ status: "MIGRATED" });
    expect(await readFile(path.join(targetRoot, relative))).toEqual(large);
    expect(
      await readFile(
        path.join(
          targetRoot,
          "users/owner-a/projects/project-a/future/unknown.descriptor",
        ),
      ),
    ).toEqual(Buffer.from([0, 255, 17, 42]));
  }, 20_000);

  it("rejects an accidental master key inside the target project store", async () => {
    await writeTarget(
      ".master-key",
      Buffer.from("must-not-be-used", "utf8"),
    );

    await expect(migrate()).rejects.toMatchObject({
      code: "TARGET_MASTER_KEY_ARTIFACT",
      relativePath: ".master-key",
    });
  });

  it("removes only controlled orphan migration temp files", async () => {
    await writeLegacy(
      "users/owner-a/projects/project-a/.aircraft",
      Buffer.from("project", "utf8"),
    );
    const orphan = await writeTarget(
      "users/owner-a/projects/project-a/.aircraft.aircraft-migration-123e4567-e89b-12d3-a456-426614174000.tmp",
      Buffer.from("partial", "utf8"),
    );

    await expect(migrate()).resolves.toMatchObject({ status: "RESUMED" });
    await expect(stat(orphan)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
