import type { BodyNode } from "@/modules/screens/layoutTree";
import {
  DOCUMENT_VERSION,
  type AircraftProject,
  type CreateLocalProjectInput,
  type ProjectMetadata,
  type ProjectSettingsDocument,
  type ResourceReference,
  type ScreenDocument,
  type TriggerGraphBindingDocument,
} from "../domain";
import type {
  LocalProjectRepository,
  ResourceRepository,
} from "./repositories";

export interface InternalScreenSeed {
  readonly screenId: string;
  readonly name: string;
  readonly description: string;
  readonly context: string;
  readonly isInitial: boolean;
  readonly order: number;
  readonly layout: BodyNode;
  readonly graphs?: Readonly<Record<string, TriggerGraphBindingDocument>>;
}

export interface InternalResourceSeed {
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly tags?: readonly string[];
}

export interface InternalProjectSeed {
  readonly project: CreateLocalProjectInput;
  readonly metadata?: Partial<
    Pick<ProjectMetadata, "status" | "icon" | "accent">
  >;
  readonly screens?: readonly InternalScreenSeed[];
  readonly settings?: Partial<
    Pick<
      ProjectSettingsDocument,
      "activeScreenId" | "activeWorkspace" | "selectedDevice" | "zoom"
    >
  >;
  readonly resources?: readonly InternalResourceSeed[];
}

export interface ProvisionedInternalProject {
  readonly project: AircraftProject;
  readonly resources: readonly ResourceReference[];
}

/**
 * Internal typed project materialization. This is intentionally not an
 * importer: callers provide Aircraft domain data and repositories select the
 * real in-memory or Electron storage pipeline.
 */
export class InternalProjectProvisioner {
  constructor(
    private readonly projects: LocalProjectRepository,
    private readonly resources: ResourceRepository,
  ) {}

  async provision(
    seed: InternalProjectSeed,
  ): Promise<ProvisionedInternalProject> {
    validateSeed(seed);
    const created = await this.projects.create(seed.project);
    const ownerId = created.manifest.ownerId;
    const projectId = created.manifest.projectId;

    try {
      if (seed.metadata) {
        await this.projects.saveMetadata(ownerId, projectId, {
          ...created.metadata,
          ...seed.metadata,
          documentVersion: DOCUMENT_VERSION,
          projectId,
        });
      }

      const screens = seed.screens?.map(toScreenDocument) ?? created.screens;
      if (seed.screens) {
        for (const screen of seed.screens) {
          await this.projects.saveScreen(
            ownerId,
            projectId,
            toScreenDocument(screen),
          );
          await this.projects.saveLayout(ownerId, projectId, {
            documentVersion: DOCUMENT_VERSION,
            screenId: screen.screenId,
            tree: screen.layout,
          });
          if (screen.graphs) {
            await this.projects.saveTriggerGraphs(ownerId, projectId, {
              documentVersion: DOCUMENT_VERSION,
              screenId: screen.screenId,
              graphs: screen.graphs,
            });
          }
        }

        const seededIds = new Set(seed.screens.map((screen) => screen.screenId));
        for (const generatedScreen of created.screens) {
          if (!seededIds.has(generatedScreen.screenId)) {
            await this.projects.deleteScreen(
              ownerId,
              projectId,
              generatedScreen.screenId,
            );
          }
        }
      }

      const initialScreen =
        screens.find((screen) => screen.isInitial) ?? screens[0];
      const activeScreenId =
        seed.settings?.activeScreenId ?? initialScreen.screenId;
      if (!screens.some((screen) => screen.screenId === activeScreenId)) {
        throw new Error(
          "Internal project seed settings reference an unknown active screen.",
        );
      }
      await this.projects.saveSettings(ownerId, projectId, {
        ...created.settings,
        ...seed.settings,
        documentVersion: DOCUMENT_VERSION,
        projectId,
        activeScreenId,
      });

      const references: ResourceReference[] = [];
      for (const resource of seed.resources ?? []) {
        references.push(
          await this.resources.put({
            ownerId,
            projectId,
            name: resource.name,
            mimeType: resource.mimeType,
            bytes: resource.bytes,
            tags: resource.tags,
          }),
        );
      }

      return {
        project: await this.projects.load(ownerId, projectId),
        resources: references,
      };
    } catch (error) {
      await this.projects.deleteProject(ownerId, projectId).catch(() => {
        // Preserve the provisioning error; cleanup is best effort.
      });
      throw error;
    }
  }
}

function toScreenDocument(seed: InternalScreenSeed): ScreenDocument {
  return {
    documentVersion: DOCUMENT_VERSION,
    screenId: seed.screenId,
    name: seed.name,
    description: seed.description,
    context: seed.context,
    isInitial: seed.isInitial,
    order: seed.order,
  };
}

function validateSeed(seed: InternalProjectSeed): void {
  if (seed.screens === undefined) return;
  if (seed.screens.length === 0) {
    throw new Error("An internal project seed must contain at least one screen.");
  }

  const ids = new Set<string>();
  let initialScreens = 0;
  for (const screen of seed.screens) {
    if (ids.has(screen.screenId)) {
      throw new Error("Internal project seed contains duplicate screen IDs.");
    }
    ids.add(screen.screenId);
    if (screen.isInitial) initialScreens += 1;
  }
  if (initialScreens !== 1) {
    throw new Error(
      "An internal project seed must contain exactly one initial screen.",
    );
  }
  if (
    seed.settings?.activeScreenId &&
    !ids.has(seed.settings.activeScreenId)
  ) {
    throw new Error(
      "Internal project seed settings reference an unknown active screen.",
    );
  }
}

