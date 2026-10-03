import path from "node:path";
import type { AircraftWorkspacePaths } from "./AircraftWorkspacePaths";

export interface WorkspacePathOperations {
  readonly isAbsolute: (value: string) => boolean;
  readonly resolve: (...values: string[]) => string;
  readonly join: (...values: string[]) => string;
}

export class AircraftWorkspaceResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AircraftWorkspaceResolutionError";
  }
}

export function resolveAircraftWorkspacePaths(
  homePath: string,
  paths: WorkspacePathOperations = path,
): AircraftWorkspacePaths {
  const normalizedHome = homePath.trim();
  if (!normalizedHome) {
    throw new AircraftWorkspaceResolutionError(
      "The operating-system home path is required.",
    );
  }
  if (!paths.isAbsolute(normalizedHome)) {
    throw new AircraftWorkspaceResolutionError(
      "The operating-system home path must be absolute.",
    );
  }

  const resolvedHome = paths.resolve(normalizedHome);
  const root = paths.join(resolvedHome, "AircraftEditor");
  const config = paths.join(root, "config");
  const security = paths.join(root, "security");
  const localProjects = paths.join(root, "local-projects");

  return {
    root,
    config,
    security,
    localProjects,
    logs: paths.join(root, "logs"),
    cache: paths.join(root, "cache"),
    temp: paths.join(root, "temp"),
    workspaceConfig: paths.join(config, "workspace.json"),
    masterKey: paths.join(security, ".master-key"),
  };
}
