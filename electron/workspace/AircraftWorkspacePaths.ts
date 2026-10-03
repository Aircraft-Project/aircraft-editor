export const AIRCRAFT_WORKSPACE_VERSION = 1 as const;
export const AIRCRAFT_LOCAL_PROJECTS_DIRECTORY = "local-projects" as const;

export interface AircraftWorkspacePaths {
  readonly root: string;
  readonly config: string;
  readonly security: string;
  readonly localProjects: string;
  readonly logs: string;
  readonly cache: string;
  readonly temp: string;
  readonly workspaceConfig: string;
  readonly masterKey: string;
}

export interface AircraftWorkspaceConfig {
  readonly workspaceVersion: typeof AIRCRAFT_WORKSPACE_VERSION;
  readonly localProjectsDirectory: typeof AIRCRAFT_LOCAL_PROJECTS_DIRECTORY;
}

export const DEFAULT_AIRCRAFT_WORKSPACE_CONFIG: AircraftWorkspaceConfig = {
  workspaceVersion: AIRCRAFT_WORKSPACE_VERSION,
  localProjectsDirectory: AIRCRAFT_LOCAL_PROJECTS_DIRECTORY,
};
