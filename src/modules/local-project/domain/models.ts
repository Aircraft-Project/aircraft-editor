import type { SchemaValue } from "@/modules/aircraft-schema";
import type { EditorWorkspace } from "@/modules/editor";
import type { BodyNode } from "@/modules/screens/layoutTree";

export const PROJECT_FORMAT_VERSION = 1 as const;
export const DOCUMENT_VERSION = 1 as const;

export type ProjectSource = "LOCAL" | "CLOUD";
export type ProjectSyncState =
  | "LOCAL_ONLY"
  | "CLOUD_ONLY"
  | "SYNCED"
  | "LOCAL_CHANGES"
  | "CONFLICT";

export interface DocumentVersion {
  readonly documentVersion: typeof DOCUMENT_VERSION;
}

export interface ProjectManifest extends DocumentVersion {
  readonly projectId: string;
  readonly ownerId: string;
  readonly projectFormatVersion: typeof PROJECT_FORMAT_VERSION;
  readonly schemaVersion: string;
  readonly schemaSourceRevision?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface ProjectMetadata extends DocumentVersion {
  readonly projectId: string;
  readonly name: string;
  readonly description: string;
  readonly status: "ACTIVE" | "DRAFT" | "IN_REVIEW" | "PUBLISHED";
  readonly icon:
    | "SHOPPING_CART"
    | "USERS"
    | "WALLET"
    | "TRUCK"
    | "CHART"
    | "LAYOUT";
  readonly accent: "BLUE" | "PURPLE" | "GREEN" | "ORANGE" | "PINK";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly source: "LOCAL";
  readonly syncState: "LOCAL_ONLY";
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface LocalProjectSummary {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectMetadata["status"];
  readonly screensCount: number;
  readonly updatedAt: string;
  readonly icon: ProjectMetadata["icon"];
  readonly accent: ProjectMetadata["accent"];
  readonly source: "LOCAL";
  readonly syncState: "LOCAL_ONLY";
}

export interface ScreenDocument extends DocumentVersion {
  readonly screenId: string;
  readonly name: string;
  readonly description: string;
  readonly context: string;
  readonly isInitial: boolean;
  readonly order: number;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface LayoutDocument extends DocumentVersion {
  readonly screenId: string;
  readonly tree: BodyNode;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface TriggerGraphNodeDocument {
  readonly id: string;
  readonly kind: "event" | "trigger";
  readonly type: string;
  readonly label: string;
  readonly properties: Readonly<Record<string, SchemaValue>>;
}

export interface TriggerGraphEdgeDocument {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface TriggerGraphBindingDocument {
  readonly nodes: readonly TriggerGraphNodeDocument[];
  readonly edges: readonly TriggerGraphEdgeDocument[];
  readonly selectedNodeId: string | null;
}

export interface TriggerGraphDocument extends DocumentVersion {
  readonly screenId: string;
  readonly graphs: Readonly<Record<string, TriggerGraphBindingDocument>>;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface ResourceMetadata {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly storageKey: string;
  readonly createdAt: string;
  readonly tags: readonly string[];
}

export interface ResourceReference {
  readonly resourceId: string;
  readonly sha256: string;
  readonly storageKey: string;
}

export interface ResourceManifest extends DocumentVersion {
  readonly projectId: string;
  readonly resources: readonly ResourceMetadata[];
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface ProjectSettingsDocument extends DocumentVersion {
  readonly projectId: string;
  readonly activeScreenId: string;
  readonly activeWorkspace: EditorWorkspace;
  readonly selectedDevice: string;
  readonly zoom: number;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface AircraftProject {
  readonly manifest: ProjectManifest;
  readonly metadata: ProjectMetadata;
  readonly screens: readonly ScreenDocument[];
  readonly layouts: Readonly<Record<string, LayoutDocument>>;
  readonly triggerGraphs: Readonly<Record<string, TriggerGraphDocument>>;
  readonly resources: ResourceManifest;
  readonly settings: ProjectSettingsDocument;
}

export interface CreateLocalProjectInput {
  readonly ownerId: string;
  readonly name: string;
  readonly description?: string;
  readonly schemaVersion: string;
  readonly schemaSourceRevision?: string;
}

export interface PutResourceInput {
  readonly ownerId: string;
  readonly projectId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly tags?: readonly string[];
}
