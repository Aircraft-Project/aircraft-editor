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
  readonly destination: string;
  readonly context: "interface";
  readonly mcpMetadata?: Readonly<Record<string, string>>;
  readonly isInitial: boolean;
  readonly order: number;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface LayoutDocument extends DocumentVersion {
  readonly screenId: string;
  readonly tree: BodyNode;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface TriggerPersistenceMetadata {
  readonly localRuntime?: boolean;
  readonly pilotRuntime?: boolean;
  readonly globalRuntime?: boolean;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface TriggerGraphNodeDocument {
  readonly id: string;
  readonly kind: "trigger";
  readonly type: string;
  readonly label: string;
  readonly properties: Readonly<Record<string, SchemaValue>>;
  readonly mcpMetadata?: Readonly<Record<string, string>>;
  readonly persistence?: TriggerPersistenceMetadata;
}

export interface TriggerGraphEdgeDocument {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface TriggerGraphBindingDocument {
  readonly rootVertexId: string | null;
  readonly nodes: readonly TriggerGraphNodeDocument[];
  readonly edges: readonly TriggerGraphEdgeDocument[];
  readonly selectedNodeId: string | null;
  readonly mcpMetadata?: Readonly<Record<string, string>>;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
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

export interface CatalogItemDocument extends DocumentVersion {
  readonly catalogItemId: string;
  readonly name: string;
  readonly destination: string;
  readonly context: "catalog-item";
  readonly mcpMetadata?: Readonly<Record<string, string>>;
  readonly layout: BodyNode;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface ThemeTextStyle {
  readonly fontSize?: number;
  readonly fontWeight?: number;
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface ThemeConfig {
  readonly colors?: Readonly<Record<string, string>>;
  readonly typography?: Readonly<Record<string, ThemeTextStyle>>;
  readonly spacing?: Readonly<Record<string, number>>;
  readonly shapes?: Readonly<Record<string, number>>;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface TextFieldComponentTheme {
  readonly errorColor?: string;
  readonly focusedBorderColor?: string;
  readonly unfocusedBorderColor?: string;
  readonly focusedLabelColor?: string;
  readonly unfocusedLabelColor?: string;
  readonly cursorColor?: string;
  readonly focusedContainerColor?: string;
  readonly unfocusedContainerColor?: string;
  readonly disabledContainerColor?: string;
  readonly disabledTextColor?: string;
  readonly errorIndicatorColor?: string;
  readonly warningColor?: string;
  readonly warningIndicatorColor?: string;
  readonly shape?: string;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface TextLabelComponentTheme {
  readonly textColorDefault?: string;
  readonly textColorError?: string;
  readonly textColorOk?: string;
  readonly textColorWarning?: string;
  readonly textStyle?: string;
  readonly paddingHorizontal?: number | null;
  readonly paddingVertical?: number | null;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface ComponentThemeConfig {
  readonly textField?: TextFieldComponentTheme;
  readonly textLabel?: TextLabelComponentTheme;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface ThemeDocument extends DocumentVersion {
  readonly projectId: string;
  readonly theme: ThemeConfig;
  readonly componentTheme: ComponentThemeConfig;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface AircraftProject {
  readonly manifest: ProjectManifest;
  readonly metadata: ProjectMetadata;
  readonly screens: readonly ScreenDocument[];
  readonly layouts: Readonly<Record<string, LayoutDocument>>;
  readonly triggerGraphs: Readonly<Record<string, TriggerGraphDocument>>;
  readonly catalogItems: readonly CatalogItemDocument[];
  readonly resources: ResourceManifest;
  readonly settings: ProjectSettingsDocument;
  readonly theme: ThemeDocument;
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
