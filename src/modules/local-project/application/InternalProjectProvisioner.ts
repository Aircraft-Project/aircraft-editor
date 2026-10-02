import type { SchemaValue } from "@/modules/aircraft-schema";
import type { BodyNode, McpMetadata } from "@/modules/screens/layoutTree";
import {
  DOCUMENT_VERSION,
  type AircraftProject,
  type CatalogItemDocument,
  type CreateLocalProjectInput,
  type ProjectMetadata,
  type ProjectSettingsDocument,
  type ResourceReference,
  type ScreenDocument,
  type TriggerGraphBindingDocument,
  type ThemeDocument,
} from "../domain";
import { AircraftProjectSemanticValidator } from "./AircraftProjectSemanticValidator";
import type {
  LocalProjectRepository,
  ResourceRepository,
} from "./repositories";

export interface InternalScreenSeed {
  readonly screenId: string;
  readonly name: string;
  readonly description: string;
  readonly destination?: string;
  readonly context: "interface";
  readonly mcpMetadata?: McpMetadata;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
  readonly layoutExtensions?: Readonly<Record<string, SchemaValue>>;
  readonly graphExtensions?: Readonly<Record<string, SchemaValue>>;
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
      "activeScreenId" | "activeWorkspace" | "selectedDevice" | "zoom" | "extensions"
    >
  >;
  readonly resources?: readonly InternalResourceSeed[];
  readonly catalogItems?: readonly Omit<CatalogItemDocument, "documentVersion">[];
  readonly theme?: Pick<
    ThemeDocument,
    "theme" | "componentTheme" | "extensions"
  >;
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
    validateSemanticSeed(seed);
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
            extensions: screen.layoutExtensions,
          });
          if (screen.graphs) {
            await this.projects.saveTriggerGraphs(ownerId, projectId, {
              documentVersion: DOCUMENT_VERSION,
              screenId: screen.screenId,
              graphs: screen.graphs,
              extensions: screen.graphExtensions,
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

      for (const catalogItem of seed.catalogItems ?? []) {
        await this.projects.saveCatalogItem(ownerId, projectId, {
          ...catalogItem,
          documentVersion: DOCUMENT_VERSION,
        });
      }

      if (seed.theme) {
        await this.projects.saveTheme(ownerId, projectId, {
          documentVersion: DOCUMENT_VERSION,
          projectId,
          ...seed.theme,
        });
      }

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
    destination: seed.destination ?? seed.screenId,
    context: "interface",
    mcpMetadata: seed.mcpMetadata,
    isInitial: seed.isInitial,
    order: seed.order,
    extensions: seed.extensions,
  };
}

function validateSeed(seed: InternalProjectSeed): void {
  const ids = new Set<string>();
  const interfaceDestinations = new Set<string>();

  if (seed.screens !== undefined) {
    if (seed.screens.length === 0) {
      throw new Error(
        "An internal project seed must contain at least one screen.",
      );
    }

    let initialScreens = 0;
    for (const screen of seed.screens) {
      if (ids.has(screen.screenId)) {
        throw new Error("Internal project seed contains duplicate screen IDs.");
      }
      ids.add(screen.screenId);
      if (screen.context !== "interface") {
        throw new Error("Internal screen seeds must use interface context.");
      }
      const destination = screen.destination ?? screen.screenId;
      if (
        !isValidDestination(destination) ||
        interfaceDestinations.has(destination)
      ) {
        throw new Error(
          "Internal project seed contains an empty or duplicate destination.",
        );
      }
      interfaceDestinations.add(destination);
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
  } else if (seed.settings?.activeScreenId) {
    throw new Error(
      "Internal project seed cannot reference an active screen without screens.",
    );
  }

  const catalogIds = new Set<string>();
  for (const catalogItem of seed.catalogItems ?? []) {
    if (catalogIds.has(catalogItem.catalogItemId)) {
      throw new Error(
        "Internal project seed contains duplicate catalog item IDs.",
      );
    }
    catalogIds.add(catalogItem.catalogItemId);
  }
}
function isValidDestination(destination: string): boolean {
  return (
    destination.length > 0 &&
    destination.trim() === destination &&
    !destination.includes("/") &&
    !destination.includes("\\")
  );
}

function validateSemanticSeed(seed: InternalProjectSeed): void {
  const screens = seed.screens?.map(toScreenDocument) ?? [];
  const layouts = Object.fromEntries(
    (seed.screens ?? []).map((screen) => [
      screen.screenId,
      {
        documentVersion: DOCUMENT_VERSION,
        screenId: screen.screenId,
        tree: screen.layout,
        extensions: screen.layoutExtensions,
      },
    ]),
  );
  const triggerGraphs = Object.fromEntries(
    (seed.screens ?? [])
      .filter((screen) => screen.graphs !== undefined)
      .map((screen) => [
        screen.screenId,
        {
          documentVersion: DOCUMENT_VERSION,
          screenId: screen.screenId,
          graphs: screen.graphs ?? {},
          extensions: screen.graphExtensions,
        },
      ]),
  );
  const catalogItems = (seed.catalogItems ?? []).map((item) => ({
    ...item,
    documentVersion: DOCUMENT_VERSION,
  }));
  const documents = { screens, layouts, triggerGraphs, catalogItems };
  const validator = new AircraftProjectSemanticValidator();
  if (seed.screens) validator.assertValid(documents);
  else validator.assertValidPartial(documents);
}

