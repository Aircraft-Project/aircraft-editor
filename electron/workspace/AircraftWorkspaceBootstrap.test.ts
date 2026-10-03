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
import {
  AircraftWorkspaceBootstrap,
  AircraftWorkspaceBootstrapError,
} from "./AircraftWorkspaceBootstrap";
import { resolveAircraftWorkspacePaths } from "./AircraftWorkspaceResolver";
import type { AircraftWorkspacePaths } from "./AircraftWorkspacePaths";

describe("AircraftWorkspaceBootstrap", () => {
  let temporaryHome: string;
  let paths: AircraftWorkspacePaths;
  let bootstrap: AircraftWorkspaceBootstrap;

  beforeEach(async () => {
    temporaryHome = await mkdtemp(path.join(tmpdir(), "aircraft-workspace-"));
    paths = resolveAircraftWorkspacePaths(temporaryHome);
    bootstrap = new AircraftWorkspaceBootstrap();
  });

  afterEach(async () => {
    await rm(temporaryHome, { recursive: true, force: true });
  });

  async function expectDirectory(directory: string): Promise<void> {
    expect((await stat(directory)).isDirectory()).toBe(true);
  }

  it("creates the complete workspace and initial portable config", async () => {
    await bootstrap.bootstrap(paths);

    await Promise.all(
      [
        paths.root,
        paths.config,
        paths.security,
        paths.localProjects,
        paths.logs,
        paths.cache,
        paths.temp,
      ].map(expectDirectory),
    );
    expect(JSON.parse(await readFile(paths.workspaceConfig, "utf8"))).toEqual({
      workspaceVersion: 1,
      localProjectsDirectory: "local-projects",
    });
  });

  it("is idempotent", async () => {
    await bootstrap.bootstrap(paths);
    const firstConfig = await readFile(paths.workspaceConfig, "utf8");

    await bootstrap.bootstrap(paths);

    expect(await readFile(paths.workspaceConfig, "utf8")).toBe(firstConfig);
  });

  it("validates but does not overwrite an existing valid config", async () => {
    await mkdir(paths.config, { recursive: true });
    const existing =
      '{\n  "workspaceVersion": 1,\n  "localProjectsDirectory": "local-projects"\n}\n\n';
    await writeFile(paths.workspaceConfig, existing, "utf8");

    await bootstrap.bootstrap(paths);

    expect(await readFile(paths.workspaceConfig, "utf8")).toBe(existing);
  });

  it("rejects corrupt JSON without replacing it", async () => {
    await mkdir(paths.config, { recursive: true });
    const corrupt = "{not-json";
    await writeFile(paths.workspaceConfig, corrupt, "utf8");

    await expect(bootstrap.bootstrap(paths)).rejects.toBeInstanceOf(
      AircraftWorkspaceBootstrapError,
    );
    expect(await readFile(paths.workspaceConfig, "utf8")).toBe(corrupt);
  });

  it("rejects an unsupported workspace version without replacing it", async () => {
    await mkdir(paths.config, { recursive: true });
    const unsupported = JSON.stringify({
      workspaceVersion: 2,
      localProjectsDirectory: "local-projects",
    });
    await writeFile(paths.workspaceConfig, unsupported, "utf8");

    await expect(bootstrap.bootstrap(paths)).rejects.toBeInstanceOf(
      AircraftWorkspaceBootstrapError,
    );
    expect(await readFile(paths.workspaceConfig, "utf8")).toBe(unsupported);
  });

  it("preserves existing workspace files", async () => {
    await mkdir(paths.logs, { recursive: true });
    await mkdir(paths.cache, { recursive: true });
    await mkdir(paths.localProjects, { recursive: true });
    await writeFile(path.join(paths.logs, "existing.log"), "log", "utf8");
    await writeFile(path.join(paths.cache, "existing.cache"), "cache", "utf8");
    await writeFile(
      path.join(paths.localProjects, "existing.project"),
      "project",
      "utf8",
    );

    await bootstrap.bootstrap(paths);

    expect(await readFile(path.join(paths.logs, "existing.log"), "utf8"))
      .toBe("log");
    expect(await readFile(path.join(paths.cache, "existing.cache"), "utf8"))
      .toBe("cache");
    expect(
      await readFile(
        path.join(paths.localProjects, "existing.project"),
        "utf8",
      ),
    ).toBe("project");
  });
});
