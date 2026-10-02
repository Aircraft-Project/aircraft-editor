import type { SchemaValue } from "@/modules/aircraft-schema";
import type {
  EditorTriggerGraph,
} from "@/modules/editor/application/useTriggerGraphStore";
import { parseTriggerBindingKey } from "@/modules/editor/application/useTriggerGraphStore";
import type { Project } from "@/modules/projects";
import type {
  BodyNode,
  ColumnNode,
  ComponentNode,
  McpMetadata,
  RowNode,
} from "@/modules/screens/layoutTree";
import type { EditorCatalogItem, EditorScreen } from "@/store/useEditorStore";
import {
  AircraftProjectSemanticError,
  DOCUMENT_VERSION,
  type AircraftProject,
  type CatalogItemDocument,
  type LayoutDocument,
  type LocalProjectSummary,
  type ScreenDocument,
  type TriggerGraphBindingDocument,
  type TriggerGraphDocument,
  type TriggerGraphNodeDocument,
} from "../domain";

export function localSummaryToProject(
  summary: LocalProjectSummary,
): Project {
  return { ...summary };
}

function normalizeRecord(
  value: Readonly<Record<string, SchemaValue>> | undefined,
): Record<string, SchemaValue> {
  return value ? { ...value } : {};
}

function normalizeMcpMetadata(
  value: McpMetadata | undefined,
): McpMetadata | undefined {
  return value ? { ...value } : undefined;
}

type LegacyColumn = Omit<ColumnNode, "rows"> & {
  readonly rows: readonly LegacyRow[];
  readonly weight?: number;
};

type LegacyRow = {
  readonly id: string;
  readonly kind: "row";
  readonly height?: RowNode["height"];
  readonly weight?: number;
  readonly properties?: Readonly<Record<string, SchemaValue>>;
  readonly mcpMetadata?: McpMetadata;
  readonly extensions?: Readonly<Record<string, SchemaValue>>;
  readonly content?: "empty" | "component" | "columns";
  readonly component?: ComponentNode;
  readonly columns?: readonly LegacyColumn[];
  readonly children?: readonly (ComponentNode | LegacyColumn)[];
};

function normalizeComponent(component: ComponentNode): ComponentNode {
  return {
    ...component,
    properties: normalizeRecord(component.properties),
    observers: (component.observers ?? []).map((observer) => ({ ...observer })),
    mcpMetadata: normalizeMcpMetadata(component.mcpMetadata),
    extensions: component.extensions ? { ...component.extensions } : undefined,
  };
}

function semanticError(
  code: string,
  message: string,
  path?: string,
): never {
  throw new AircraftProjectSemanticError([{ code, message, path }]);
}

function normalizedSizing(row: LegacyRow): Pick<RowNode, "height" | "weight"> {
  return typeof row.weight === "number" && Number.isFinite(row.weight)
    ? { weight: row.weight }
    : {
        height:
          typeof row.height === "number" ||
          row.height === "wrap_content" ||
          row.height === "match_parent"
            ? row.height
            : "wrap_content",
      };
}

function normalizeRow(row: RowNode | LegacyRow): RowNode {
  const source = row as LegacyRow;
  const common = {
    id: source.id,
    kind: "row" as const,
    ...normalizedSizing(source),
    properties: normalizeRecord(source.properties),
    mcpMetadata: normalizeMcpMetadata(source.mcpMetadata),
    extensions: source.extensions ? { ...source.extensions } : undefined,
  };

  if (source.content === "component") {
    if (
      !source.component ||
      (source.columns?.length ?? 0) > 0 ||
      (source.children?.length ?? 0) > 0
    ) {
      return semanticError(
        "H-3",
        `Row '${source.id}' declares component content without a component.`,
        source.id,
      );
    }
    return {
      ...common,
      content: "component",
      component: normalizeComponent(source.component),
    };
  }

  if (source.content === "columns") {
    const columns = (source.columns ?? []).map(normalizeColumn);
    if (
      !columns.length ||
      source.component !== undefined ||
      (source.children?.length ?? 0) > 0
    ) {
      return semanticError(
        "H-3",
        `Row '${source.id}' declares columns content without columns.`,
        source.id,
      );
    }
    return {
      ...common,
      content: "columns",
      columns: columns as [ColumnNode, ...ColumnNode[]],
    };
  }

  if (source.content === "empty") {
    if (
      source.component !== undefined ||
      (source.columns?.length ?? 0) > 0 ||
      (source.children?.length ?? 0) > 0
    ) {
      return semanticError(
        "H-3",
        `Row '${source.id}' declares empty content with nested content.`,
        source.id,
      );
    }
    return { ...common, content: "empty" };
  }

  const legacyChildren = source.children ?? [];
  const components = legacyChildren.filter(
    (child): child is ComponentNode => child.kind === "component",
  );
  const columns = legacyChildren.filter(
    (child): child is LegacyColumn => child.kind === "column",
  );
  if (
    components.length > 1 ||
    (components.length > 0 && columns.length > 0) ||
    components.length + columns.length !== legacyChildren.length
  ) {
    return semanticError(
      "H-3",
      `Legacy row '${source.id}' cannot be migrated losslessly because it mixes component and column content or contains multiple components.`,
      source.id,
    );
  }
  if (components.length === 1) {
    return {
      ...common,
      content: "component",
      component: normalizeComponent(components[0]),
    };
  }
  if (columns.length) {
    return {
      ...common,
      content: "columns",
      columns: columns.map(normalizeColumn) as [ColumnNode, ...ColumnNode[]],
    };
  }
  return { ...common, content: "empty" };
}

function normalizeColumn(column: ColumnNode | LegacyColumn): ColumnNode {
  const source = column as LegacyColumn;
  const legacyWeight =
    typeof source.weight === "number" && Number.isFinite(source.weight)
      ? source.weight
      : undefined;
  const editorMetadata =
    legacyWeight === undefined
      ? source.editorMetadata
      : {
          ...source.editorMetadata,
          legacyWeight,
        };
  return {
    id: source.id,
    kind: "column",
    properties: normalizeRecord(source.properties),
    rows: source.rows.map(normalizeRow),
    mcpMetadata: normalizeMcpMetadata(source.mcpMetadata),
    extensions: source.extensions ? { ...source.extensions } : undefined,
    editorMetadata,
  };
}

export function normalizeBody(body: BodyNode): BodyNode {
  return {
    id: body.id,
    kind: "body",
    properties: normalizeRecord(body.properties),
    columns: body.columns.map((column) =>
      normalizeColumn(column as ColumnNode | LegacyColumn),
    ),
    mcpMetadata: normalizeMcpMetadata(body.mcpMetadata),
    extensions: body.extensions ? { ...body.extensions } : undefined,
  };
}

type LegacyGraphBinding = Omit<
  TriggerGraphBindingDocument,
  "rootVertexId" | "nodes"
> & {
  readonly rootVertexId?: string | null;
  readonly nodes: readonly (
    | TriggerGraphNodeDocument
    | (Omit<TriggerGraphNodeDocument, "kind"> & { readonly kind: "event" })
  )[];
};

function normalizeGraphBinding(
  bindingKey: string,
  binding: TriggerGraphBindingDocument,
): EditorTriggerGraph {
  const source = binding as LegacyGraphBinding;
  const parsed = parseTriggerBindingKey(bindingKey);
  if (!parsed) {
    return semanticError(
      "D-2",
      `Trigger binding key '${bindingKey}' is invalid.`,
      bindingKey,
    );
  }
  const legacyEventNodes = source.nodes.filter(
    (node) => node.kind === "event",
  );
  if (legacyEventNodes.length > 1) {
    return semanticError(
      "D-2",
      `Trigger graph '${bindingKey}' contains multiple Event UI nodes.`,
      bindingKey,
    );
  }
  const triggerNodes = source.nodes.filter(
    (node): node is TriggerGraphNodeDocument => node.kind === "trigger",
  );
  const triggerIds = new Set(triggerNodes.map((node) => node.id));
  const legacyEventId = legacyEventNodes[0]?.id;
  const legacyEventEdges = legacyEventId
    ? source.edges.filter((edge) => edge.source === legacyEventId)
    : [];
  if (legacyEventEdges.length > 1) {
    return semanticError(
      "D-2",
      `Legacy trigger graph '${bindingKey}' has multiple Event outputs and cannot derive one root vertex.`,
      bindingKey,
    );
  }
  const rootVertexId =
    source.rootVertexId ??
    (legacyEventEdges.length === 1 ? legacyEventEdges[0].target : null);
  if (triggerNodes.length > 0 && !rootVertexId) {
    return semanticError(
      "D-2",
      `Trigger graph '${bindingKey}' has vertices but no root vertex.`,
      bindingKey,
    );
  }

  const eventId = `event:${parsed.eventType}`;
  const semanticEdges = source.edges.filter(
    (edge) => triggerIds.has(edge.source) && triggerIds.has(edge.target),
  );
  const selectedNodeId =
    source.selectedNodeId === legacyEventId
      ? eventId
      : source.selectedNodeId;

  return {
    rootVertexId,
    nodes: [
      {
        id: eventId,
        kind: "event",
        type: parsed.eventType,
        label: parsed.eventType,
        properties: {},
      },
      ...triggerNodes.map((node) => ({
        ...node,
        properties: normalizeRecord(node.properties),
        mcpMetadata: normalizeMcpMetadata(node.mcpMetadata),
        persistence: node.persistence
          ? {
              ...node.persistence,
              extensions: node.persistence.extensions
                ? { ...node.persistence.extensions }
                : undefined,
            }
          : undefined,
      })),
    ],
    edges: [
      ...(rootVertexId
        ? [
            {
              id: `event-root:${rootVertexId}`,
              source: eventId,
              target: rootVertexId,
            },
          ]
        : []),
      ...semanticEdges.map((edge) => ({ ...edge })),
    ],
    selectedNodeId,
    mcpMetadata: normalizeMcpMetadata(source.mcpMetadata),
    extensions: source.extensions ? { ...source.extensions } : undefined,
  };
}

export function projectToEditorState(project: AircraftProject) {
  const screens: EditorScreen[] = [...project.screens]
    .sort((left, right) => left.order - right.order)
    .map(
      ({
        screenId,
        name,
        description,
        destination,
        context,
        mcpMetadata,
        extensions,
      }) => {
        if (context !== "interface") {
          return semanticError(
            "SCREEN_CONTEXT",
            `Screen '${screenId}' must use context 'interface'.`,
            screenId,
          );
        }
        return {
          id: screenId,
          name,
          description,
          destination,
          context,
          mcpMetadata: normalizeMcpMetadata(mcpMetadata),
          extensions: extensions ? { ...extensions } : undefined,
        };
      },
    );
  const screenTrees = Object.fromEntries(
    Object.values(project.layouts).map((document) => [
      document.screenId,
      normalizeBody(document.tree),
    ]),
  );
  const catalogItems: EditorCatalogItem[] = project.catalogItems.map(
    (item) => {
      if (item.catalogItemId !== item.name) {
        return semanticError(
          "CATALOG_ITEM_IDENTITY_MISMATCH",
          `Catalog item identifier '${item.catalogItemId}' must equal its name '${item.name}'.`,
          item.catalogItemId,
        );
      }
      return {
        id: item.catalogItemId,
        name: item.name,
        destination: item.destination,
        context: item.context,
        mcpMetadata: normalizeMcpMetadata(item.mcpMetadata),
        layout: normalizeBody(item.layout),
        extensions: item.extensions ? { ...item.extensions } : undefined,
      };
    },
  );
  const graphs = Object.assign(
    {},
    ...Object.values(project.triggerGraphs).map((document) =>
      Object.fromEntries(
        Object.entries(document.graphs).map(([bindingKey, graph]) => [
          bindingKey,
          normalizeGraphBinding(bindingKey, graph),
        ]),
      ),
    ),
  ) as Record<string, EditorTriggerGraph>;

  return {
    screens,
    screenTrees,
    graphs,
    catalogItems,
    initialScreenId:
      project.screens.find((screen) => screen.isInitial)?.screenId ??
      screens[0]?.id ??
      "",
    activeScreenId: project.settings.activeScreenId,
    documentExtensions: {
      layouts: Object.fromEntries(
        Object.values(project.layouts).map((document) => [
          document.screenId,
          document.extensions,
        ]),
      ),
      triggerGraphs: Object.fromEntries(
        Object.values(project.triggerGraphs).map((document) => [
          document.screenId,
          document.extensions,
        ]),
      ),
      settings: project.settings.extensions,
    },
  };
}

export function createScreenDocuments(
  screens: readonly EditorScreen[],
  initialScreenId: string,
): readonly ScreenDocument[] {
  return screens.map((screen, order) => ({
    documentVersion: DOCUMENT_VERSION,
    screenId: screen.id,
    name: screen.name,
    description: screen.description,
    destination: screen.destination,
    context: "interface",
    mcpMetadata: screen.mcpMetadata,
    isInitial: screen.id === initialScreenId,
    order,
    extensions: screen.extensions,
  }));
}

export function createLayoutDocument(
  screenId: string,
  tree: LayoutDocument["tree"],
  extensions?: LayoutDocument["extensions"],
): LayoutDocument {
  return {
    documentVersion: DOCUMENT_VERSION,
    screenId,
    tree: normalizeBody(tree),
    extensions,
  };
}

export function createCatalogItemDocument(
  item: EditorCatalogItem,
): CatalogItemDocument {
  if (item.id !== item.name) {
    return semanticError(
      "CATALOG_ITEM_IDENTITY_MISMATCH",
      `Catalog item identifier '${item.id}' must equal its name '${item.name}'.`,
      item.id,
    );
  }
  return {
    documentVersion: DOCUMENT_VERSION,
    catalogItemId: item.id,
    name: item.name,
    destination: item.destination,
    context: "catalog-item",
    mcpMetadata: item.mcpMetadata,
    layout: normalizeBody(item.layout),
    extensions: item.extensions,
  };
}

export function createTriggerGraphDocument(
  screenId: string,
  graphs: Readonly<Record<string, EditorTriggerGraph>>,
  extensions?: TriggerGraphDocument["extensions"],
): TriggerGraphDocument {
  const prefix = encodeURIComponent(screenId) + ":";
  return {
    documentVersion: DOCUMENT_VERSION,
    screenId,
    graphs: Object.fromEntries(
      Object.entries(graphs)
        .filter(([bindingKey]) => bindingKey.startsWith(prefix))
        .map(([bindingKey, graph]) => {
          const triggerIds = new Set(
            graph.nodes
              .filter((node) => node.kind === "trigger")
              .map((node) => node.id),
          );
          return [
            bindingKey,
            {
              rootVertexId: graph.rootVertexId,
              nodes: graph.nodes
                .filter((node) => node.kind === "trigger")
                .map<TriggerGraphNodeDocument>((node) => ({
                  id: node.id,
                  kind: "trigger",
                  type: node.type,
                  label: node.label,
                  properties: node.properties,
                  mcpMetadata: node.mcpMetadata,
                  persistence: node.persistence,
                })),              edges: graph.edges.filter(
                (edge) =>
                  triggerIds.has(edge.source) && triggerIds.has(edge.target),
              ),
              selectedNodeId:
                graph.selectedNodeId &&
                triggerIds.has(graph.selectedNodeId)
                  ? graph.selectedNodeId
                  : null,
              mcpMetadata: graph.mcpMetadata,
              extensions: graph.extensions,
            },
          ];
        }),
    ),
    extensions,
  };
}
