import { mkdir, readFile } from "node:fs/promises";
import { AtomicFileStore } from "../storage/AtomicFileStore";
import {
  AIRCRAFT_LOCAL_PROJECTS_DIRECTORY,
  AIRCRAFT_WORKSPACE_VERSION,
  DEFAULT_AIRCRAFT_WORKSPACE_CONFIG,
  type AircraftWorkspaceConfig,
  type AircraftWorkspacePaths,
} from "./AircraftWorkspacePaths";

export class AircraftWorkspaceBootstrapError extends Error {
  constructor(
    message: string,
    readonly workspaceConfigPath: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AircraftWorkspaceBootstrapError";
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

function parseWorkspaceConfig(
  serialized: string,
  workspaceConfigPath: string,
): AircraftWorkspaceConfig {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new AircraftWorkspaceBootstrapError(
      "Aircraft workspace configuration is not valid JSON.",
      workspaceConfigPath,
      { cause: error },
    );
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AircraftWorkspaceBootstrapError(
      "Aircraft workspace configuration has an invalid structure.",
      workspaceConfigPath,
    );
  }

  const config = value as Record<string, unknown>;
  if (
    config.workspaceVersion !== AIRCRAFT_WORKSPACE_VERSION ||
    config.localProjectsDirectory !== AIRCRAFT_LOCAL_PROJECTS_DIRECTORY
  ) {
    throw new AircraftWorkspaceBootstrapError(
      "Aircraft workspace configuration version or local-projects directory is unsupported.",
      workspaceConfigPath,
    );
  }

  return DEFAULT_AIRCRAFT_WORKSPACE_CONFIG;
}

export class AircraftWorkspaceBootstrap {
  constructor(private readonly files = new AtomicFileStore()) {}

  async bootstrap(
    paths: AircraftWorkspacePaths,
  ): Promise<AircraftWorkspaceConfig> {
    await Promise.all(
      [
        paths.root,
        paths.config,
        paths.security,
        paths.localProjects,
        paths.logs,
        paths.cache,
        paths.temp,
      ].map((directory) => mkdir(directory, { recursive: true })),
    );

    try {
      const existing = await readFile(paths.workspaceConfig, "utf8");
      return parseWorkspaceConfig(existing, paths.workspaceConfig);
    } catch (error) {
      if (!isMissingFile(error)) {
        if (error instanceof AircraftWorkspaceBootstrapError) throw error;
        throw new AircraftWorkspaceBootstrapError(
          "Aircraft workspace configuration could not be read.",
          paths.workspaceConfig,
          { cause: error },
        );
      }
    }

    const serialized =
      JSON.stringify(DEFAULT_AIRCRAFT_WORKSPACE_CONFIG, null, 2) + "\n";
    try {
      await this.files.write(
        paths.workspaceConfig,
        new TextEncoder().encode(serialized),
      );
    } catch (error) {
      throw new AircraftWorkspaceBootstrapError(
        "Aircraft workspace configuration could not be created.",
        paths.workspaceConfig,
        { cause: error },
      );
    }
    return DEFAULT_AIRCRAFT_WORKSPACE_CONFIG;
  }
}
