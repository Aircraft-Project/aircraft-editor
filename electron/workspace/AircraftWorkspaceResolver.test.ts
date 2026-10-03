/** @jest-environment node */

import path from "node:path";
import {
  AircraftWorkspaceResolutionError,
  resolveAircraftWorkspacePaths,
} from "./AircraftWorkspaceResolver";

describe("resolveAircraftWorkspacePaths", () => {
  it("resolves the complete Windows workspace from the supplied home", () => {
    expect(
      resolveAircraftWorkspacePaths("C:\\Users\\jorge", path.win32),
    ).toEqual({
      root: "C:\\Users\\jorge\\AircraftEditor",
      config: "C:\\Users\\jorge\\AircraftEditor\\config",
      security: "C:\\Users\\jorge\\AircraftEditor\\security",
      localProjects:
        "C:\\Users\\jorge\\AircraftEditor\\local-projects",
      logs: "C:\\Users\\jorge\\AircraftEditor\\logs",
      cache: "C:\\Users\\jorge\\AircraftEditor\\cache",
      temp: "C:\\Users\\jorge\\AircraftEditor\\temp",
      workspaceConfig:
        "C:\\Users\\jorge\\AircraftEditor\\config\\workspace.json",
      masterKey:
        "C:\\Users\\jorge\\AircraftEditor\\security\\.master-key",
    });
  });

  it.each(["", "   ", "\t\r\n"])("rejects an empty home path", (home) => {
    expect(() => resolveAircraftWorkspacePaths(home)).toThrow(
      AircraftWorkspaceResolutionError,
    );
  });

  it("rejects a relative home path", () => {
    expect(() => resolveAircraftWorkspacePaths("Users/example"))
      .toThrow(AircraftWorkspaceResolutionError);
  });
});
