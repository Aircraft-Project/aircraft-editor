import type { AircraftDesktopApi } from "../../../../electron/shared/localProjectIpc";
import type {
  LocalProjectRepository,
  ResourceRepository,
} from "../application";
import {
  LocalProjectCorruptedError,
  type AircraftProject,
  type CreateLocalProjectInput,
  type LayoutDocument,
  type LocalProjectSummary,
  type ProjectMetadata,
  type ProjectSettingsDocument,
  type PutResourceInput,
  type ResourceMetadata,
  type ResourceReference,
  type ScreenDocument,
  type TriggerGraphDocument,
} from "../domain";

function bridge(): AircraftDesktopApi {
  const api = (
    window as Window & {
      aircraftDesktop?: AircraftDesktopApi;
    }
  ).aircraftDesktop;
  if (!api) throw new Error("Aircraft Desktop bridge is unavailable.");
  return api;
}

export function hasAircraftDesktopBridge(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(
      (
        window as Window & {
          aircraftDesktop?: AircraftDesktopApi;
        }
      ).aircraftDesktop,
    )
  );
}

export class ElectronLocalProjectRepository
  implements LocalProjectRepository
{
  async listByOwner(
    ownerId: string,
  ): Promise<readonly LocalProjectSummary[]> {
    return parseSummaries(
      await bridge().localProjects.list(ownerId),
    );
  }

  async create(
    input: CreateLocalProjectInput,
  ): Promise<AircraftProject> {
    return parseProject(await bridge().localProjects.create(input));
  }

  async load(
    ownerId: string,
    projectId: string,
  ): Promise<AircraftProject> {
    return parseProject(
      await bridge().localProjects.load({ ownerId, projectId }),
    );
  }

  async saveMetadata(
    ownerId: string,
    projectId: string,
    document: ProjectMetadata,
  ): Promise<void> {
    await bridge().localProjects.saveMetadata({
      ownerId,
      projectId,
      document,
    });
  }

  async saveScreen(
    ownerId: string,
    projectId: string,
    document: ScreenDocument,
  ): Promise<void> {
    await bridge().localProjects.saveScreen({
      ownerId,
      projectId,
      document,
    });
  }

  async deleteScreen(
    ownerId: string,
    projectId: string,
    screenId: string,
  ): Promise<void> {
    await bridge().localProjects.deleteScreen({
      ownerId,
      projectId,
      screenId,
    });
  }

  async saveLayout(
    ownerId: string,
    projectId: string,
    document: LayoutDocument,
  ): Promise<void> {
    await bridge().localProjects.saveLayout({
      ownerId,
      projectId,
      document,
    });
  }

  async saveTriggerGraphs(
    ownerId: string,
    projectId: string,
    document: TriggerGraphDocument,
  ): Promise<void> {
    await bridge().localProjects.saveTriggerGraphs({
      ownerId,
      projectId,
      document,
    });
  }

  async saveSettings(
    ownerId: string,
    projectId: string,
    document: ProjectSettingsDocument,
  ): Promise<void> {
    await bridge().localProjects.saveSettings({
      ownerId,
      projectId,
      document,
    });
  }

  async deleteProject(
    ownerId: string,
    projectId: string,
  ): Promise<void> {
    await bridge().localProjects.deleteProject({
      ownerId,
      projectId,
    });
  }
}

export class ElectronResourceRepository
  implements ResourceRepository
{
  async list(
    ownerId: string,
    projectId: string,
  ): Promise<readonly ResourceMetadata[]> {
    return parseResources(
      await bridge().resources.list({ ownerId, projectId }),
    );
  }

  async put(input: PutResourceInput): Promise<ResourceReference> {
    return parseReference(
      await bridge().resources.put({
        ownerId: input.ownerId,
        projectId: input.projectId,
        name: input.name,
        mimeType: input.mimeType,
        bytes: input.bytes,
        tags: input.tags ?? [],
      }),
    );
  }

  async read(
    ownerId: string,
    projectId: string,
    resourceId: string,
  ): Promise<Uint8Array> {
    const bytes = await bridge().resources.read({
      ownerId,
      projectId,
      resourceId,
    });
    if (!(bytes instanceof Uint8Array)) {
      throw new LocalProjectCorruptedError("RESOURCE_BLOB");
    }
    return bytes;
  }

  async delete(
    ownerId: string,
    projectId: string,
    resourceId: string,
  ): Promise<void> {
    await bridge().resources.delete({
      ownerId,
      projectId,
      resourceId,
    });
  }
}

function parseProject(value: unknown): AircraftProject {
  const record = requireRecord(value);
  requireRecord(record.manifest);
  requireRecord(record.metadata);
  requireArray(record.screens);
  requireRecord(record.layouts);
  requireRecord(record.triggerGraphs);
  requireRecord(record.resources);
  requireRecord(record.settings);
  return value as AircraftProject;
}

function parseSummaries(
  value: unknown,
): readonly LocalProjectSummary[] {
  return requireArray(value).map((entry) => {
    const record = requireRecord(entry);
    requireString(record.id);
    requireString(record.ownerId);
    requireString(record.name);
    if (record.source !== "LOCAL") {
      throw new LocalProjectCorruptedError("SUMMARY");
    }
    return entry as LocalProjectSummary;
  });
}

function parseResources(
  value: unknown,
): readonly ResourceMetadata[] {
  return requireArray(value).map((entry) => {
    const record = requireRecord(entry);
    requireString(record.id);
    requireString(record.sha256);
    requireString(record.storageKey);
    return entry as ResourceMetadata;
  });
}

function parseReference(value: unknown): ResourceReference {
  const record = requireRecord(value);
  return {
    resourceId: requireString(record.resourceId),
    sha256: requireString(record.sha256),
    storageKey: requireString(record.storageKey),
  };
}

function requireRecord(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LocalProjectCorruptedError();
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new LocalProjectCorruptedError();
  return value;
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new LocalProjectCorruptedError();
  }
  return value;
}
