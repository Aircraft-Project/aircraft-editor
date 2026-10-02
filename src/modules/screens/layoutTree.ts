import { ComponentType } from "@/design/tokens";
import type { SchemaValue } from "@/modules/aircraft-schema";

export type RowHeight = "wrap_content" | "match_parent" | number;
export type McpMetadata = Readonly<Record<string, string>>;
export type NodeExtensions = Readonly<Record<string, SchemaValue>>;

export type HorizontalArrangement =
  | "Start"
  | "End"
  | "Center"
  | "SpaceBetween"
  | "SpaceAround"
  | "SpaceEvenly";

export type VerticalAlignment = "Top" | "Bottom" | "CenterVertically";

export type BodyProperties = Readonly<Record<string, SchemaValue>> & {
  readonly cardPadding?: number;
  readonly cardBackgroundColor?: string;
  readonly viewType?: string;
  readonly identifier?: string | null;
};

export type ColumnProperties = Readonly<Record<string, SchemaValue>> & {
  readonly padding?: number;
  readonly scrollable?: boolean;
};

export type RowProperties = Readonly<Record<string, SchemaValue>> & {
  readonly padding?: number;
  readonly horizontalArrangement?: HorizontalArrangement;
  readonly verticalAlignment?: VerticalAlignment;
};

export type ObserverReference = {
  readonly observerIdentifier: string;
};

export type ComponentNode = {
  readonly id: string;
  readonly kind: "component";
  readonly type: ComponentType;
  readonly subtype: string;
  readonly name: string;
  readonly properties: Record<string, SchemaValue>;
  readonly observers: readonly ObserverReference[];
  readonly mcpMetadata?: McpMetadata;
  readonly extensions?: NodeExtensions;
};

type RowNodeBase = {
  readonly id: string;
  readonly kind: "row";
  readonly height?: RowHeight;
  readonly weight?: number;
  readonly properties: RowProperties;
  readonly mcpMetadata?: McpMetadata;
  readonly extensions?: NodeExtensions;
};

export type EmptyRowNode = RowNodeBase & {
  readonly content: "empty";
};

export type ComponentRowNode = RowNodeBase & {
  readonly content: "component";
  readonly component: ComponentNode;
};

export type ColumnsRowNode = RowNodeBase & {
  readonly content: "columns";
  readonly columns: readonly [ColumnNode, ...ColumnNode[]];
};

/** Aircraft H-3 is encoded in the type: a row is empty, component, or columns. */
export type RowNode = EmptyRowNode | ComponentRowNode | ColumnsRowNode;

export type ColumnNode = {
  readonly id: string;
  readonly kind: "column";
  readonly properties: ColumnProperties;
  rows: RowNode[];
  readonly mcpMetadata?: McpMetadata;
  readonly extensions?: NodeExtensions;
  /** Editor-only compatibility data. It has no Assembler/runtime semantics. */
  readonly editorMetadata?: {
    readonly legacyWeight?: number;
  };
};

export type BodyNode = {
  readonly id: string;
  readonly kind: "body";
  readonly properties: BodyProperties;
  columns: ColumnNode[];
  readonly mcpMetadata?: McpMetadata;
  readonly extensions?: NodeExtensions;
};

export type DroppedPaletteItem = {
  readonly type: ComponentType;
  readonly subtype: string;
  readonly initialProperties?: Record<string, SchemaValue>;
};

const AIRCRAFT_IDENTIFIER_PATTERN = /^[0-9a-f]{16}$/;

export function isAircraftIdentifier(value: string): boolean {
  return AIRCRAFT_IDENTIFIER_PATTERN.test(value);
}

export function createAircraftIdentifier(
  usedIdentifiers: ReadonlySet<string> = new Set(),
): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Web Crypto is required to generate Aircraft identifiers.");
  }
  let identifier: string;
  do {
    const bytes = new Uint8Array(8);
    cryptoApi.getRandomValues(bytes);
    identifier = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  } while (usedIdentifiers.has(identifier));
  return identifier;
}

function takeIdentifier(usedIdentifiers: Set<string>): string {
  const identifier = createAircraftIdentifier(usedIdentifiers);
  usedIdentifiers.add(identifier);
  return identifier;
}

export function createComponentNode(
  type: ComponentType,
  subtype: string,
  displayIndex: number,
  initialProperties: Record<string, SchemaValue> = {},
  usedIdentifiers: Set<string> = new Set(),
): ComponentNode {
  return {
    id: takeIdentifier(usedIdentifiers),
    kind: "component",
    type,
    subtype,
    name: `${type} ${displayIndex}`,
    properties: initialProperties,
    observers: [],
  };
}

function rowBase(id: string): RowNodeBase {
  return {
    id,
    kind: "row",
    height: "wrap_content",
    properties: {},
  };
}

export function createEmptyRowNode(
  usedIdentifiers: Set<string> = new Set(),
): EmptyRowNode {
  return { ...rowBase(takeIdentifier(usedIdentifiers)), content: "empty" };
}

export function createComponentRowNode(
  component: ComponentNode,
  usedIdentifiers: Set<string> = new Set(),
): ComponentRowNode {
  return {
    ...rowBase(takeIdentifier(usedIdentifiers)),
    content: "component",
    component,
  };
}

export function createColumnsRowNode(
  columns: readonly [ColumnNode, ...ColumnNode[]],
  usedIdentifiers: Set<string> = new Set(),
): ColumnsRowNode {
  return {
    ...rowBase(takeIdentifier(usedIdentifiers)),
    content: "columns",
    columns,
  };
}

export function createColumnNode(
  usedIdentifiers: Set<string> = new Set(),
): ColumnNode {
  return {
    id: takeIdentifier(usedIdentifiers),
    kind: "column",
    properties: {},
    rows: [],
  };
}

export function createEmptyBody(
  existingIdentifiers: ReadonlySet<string> = new Set(),
): BodyNode {
  const usedIdentifiers = new Set(existingIdentifiers);
  const bodyId = takeIdentifier(usedIdentifiers);
  return {
    id: bodyId,
    kind: "body",
    properties: {},
    columns: [createColumnNode(usedIdentifiers)],
  };
}

export function getRowColumns(row: RowNode): readonly ColumnNode[] {
  return row.content === "columns" ? row.columns : [];
}

export function getRowComponent(row: RowNode): ComponentNode | undefined {
  return row.content === "component" ? row.component : undefined;
}

export function collectLayoutIdentifiers(body: BodyNode): Set<string> {
  const identifiers = new Set<string>([body.id]);
  const visitColumn = (column: ColumnNode) => {
    identifiers.add(column.id);
    for (const row of column.rows) {
      identifiers.add(row.id);
      if (row.content === "component") {
        identifiers.add(row.component.id);
      } else if (row.content === "columns") {
        row.columns.forEach(visitColumn);
      }
    }
  };
  body.columns.forEach(visitColumn);
  return identifiers;
}

export function countComponentsOfType(
  body: BodyNode,
  type: ComponentType,
): number {
  return listComponents(body).filter((component) => component.type === type)
    .length;
}

export function findComponent(
  body: BodyNode,
  componentId: string,
): ComponentNode | undefined {
  return listComponents(body).find((component) => component.id === componentId);
}

export function findRow(body: BodyNode, rowId: string): RowNode | undefined {
  const searchColumn = (column: ColumnNode): RowNode | undefined => {
    for (const row of column.rows) {
      if (row.id === rowId) return row;
      for (const child of getRowColumns(row)) {
        const found = searchColumn(child);
        if (found) return found;
      }
    }
    return undefined;
  };
  for (const column of body.columns) {
    const found = searchColumn(column);
    if (found) return found;
  }
  return undefined;
}

export function findColumn(
  body: BodyNode,
  columnId: string,
): ColumnNode | undefined {
  const searchColumn = (column: ColumnNode): ColumnNode | undefined => {
    if (column.id === columnId) return column;
    for (const row of column.rows) {
      for (const child of getRowColumns(row)) {
        const found = searchColumn(child);
        if (found) return found;
      }
    }
    return undefined;
  };
  for (const column of body.columns) {
    const found = searchColumn(column);
    if (found) return found;
  }
  return undefined;
}

function mapColumnRows(
  column: ColumnNode,
  mapRow: (row: RowNode) => RowNode,
): ColumnNode {
  return { ...column, rows: column.rows.map(mapRow) };
}

function mapRowColumns(
  row: RowNode,
  mapColumn: (column: ColumnNode) => ColumnNode,
): RowNode {
  return row.content === "columns"
    ? {
        ...row,
        columns: row.columns.map(mapColumn) as [
          ColumnNode,
          ...ColumnNode[],
        ],
      }
    : row;
}

export function updateColumnDeep(
  body: BodyNode,
  columnId: string,
  updater: (column: ColumnNode) => ColumnNode,
): BodyNode {
  const transform = (column: ColumnNode): ColumnNode => {
    if (column.id === columnId) return updater(column);
    return mapColumnRows(column, (row) => mapRowColumns(row, transform));
  };
  return { ...body, columns: body.columns.map(transform) };
}

export function updateRowDeep(
  body: BodyNode,
  rowId: string,
  updater: (row: RowNode) => RowNode,
): BodyNode {
  const transformColumn = (column: ColumnNode): ColumnNode =>
    mapColumnRows(column, (row) =>
      row.id === rowId
        ? updater(row)
        : mapRowColumns(row, transformColumn),
    );
  return { ...body, columns: body.columns.map(transformColumn) };
}

export function updateComponentDeep(
  body: BodyNode,
  componentId: string,
  updater: (component: ComponentNode) => ComponentNode,
): BodyNode {
  const transformColumn = (column: ColumnNode): ColumnNode =>
    mapColumnRows(column, (row) => {
      if (row.content === "component") {
        return row.component.id === componentId
          ? { ...row, component: updater(row.component) }
          : row;
      }
      return mapRowColumns(row, transformColumn);
    });
  return { ...body, columns: body.columns.map(transformColumn) };
}

export function removeRowDeep(body: BodyNode, rowId: string): BodyNode {
  const transformColumn = (column: ColumnNode): ColumnNode => ({
    ...column,
    rows: column.rows
      .filter((row) => row.id !== rowId)
      .map((row) => mapRowColumns(row, transformColumn)),
  });
  return { ...body, columns: body.columns.map(transformColumn) };
}

export function removeColumnDeep(
  body: BodyNode,
  columnId: string,
): BodyNode {
  const removeFromColumn = (column: ColumnNode): ColumnNode =>
    mapColumnRows(column, (row) => {
      if (row.content !== "columns") return row;
      const columns = row.columns
        .filter((child) => child.id !== columnId)
        .map(removeFromColumn);
      return columns.length
        ? {
            ...row,
            columns: columns as [ColumnNode, ...ColumnNode[]],
          }
        : {
            id: row.id,
            kind: "row",
            content: "empty",
            height: row.height,
            weight: row.weight,
            properties: row.properties,
            mcpMetadata: row.mcpMetadata,
            extensions: row.extensions,
          };
    });

  const isTopLevel = body.columns.some((column) => column.id === columnId);
  if (isTopLevel && body.columns.length <= 1) return body;
  return {
    ...body,
    columns: body.columns
      .filter((column) => column.id !== columnId)
      .map(removeFromColumn),
  };
}

export function listComponents(body: BodyNode): ComponentNode[] {
  const components: ComponentNode[] = [];
  const visitColumn = (column: ColumnNode) => {
    for (const row of column.rows) {
      if (row.content === "component") {
        components.push(row.component);
      } else if (row.content === "columns") {
        row.columns.forEach(visitColumn);
      }
    }
  };
  body.columns.forEach(visitColumn);
  return components;
}

export function cloneBody(
  body: BodyNode,
  existingIdentifiers: ReadonlySet<string> = new Set(),
): BodyNode {
  const usedIdentifiers = new Set(existingIdentifiers);
  collectLayoutIdentifiers(body).forEach((id) => usedIdentifiers.add(id));
  const cloneComponent = (component: ComponentNode): ComponentNode => ({
    ...component,
    id: takeIdentifier(usedIdentifiers),
    properties: { ...component.properties },
    observers: component.observers.map((observer) => ({ ...observer })),
    mcpMetadata: component.mcpMetadata
      ? { ...component.mcpMetadata }
      : undefined,
    extensions: component.extensions ? { ...component.extensions } : undefined,
  });
  const cloneColumn = (column: ColumnNode): ColumnNode => ({
    ...column,
    id: takeIdentifier(usedIdentifiers),
    properties: { ...column.properties },
    rows: column.rows.map(cloneRow),
    mcpMetadata: column.mcpMetadata ? { ...column.mcpMetadata } : undefined,
    extensions: column.extensions ? { ...column.extensions } : undefined,
    editorMetadata: column.editorMetadata
      ? { ...column.editorMetadata }
      : undefined,
  });
  const cloneRow = (row: RowNode): RowNode => {
    const common = {
      ...row,
      id: takeIdentifier(usedIdentifiers),
      properties: { ...row.properties },
      mcpMetadata: row.mcpMetadata ? { ...row.mcpMetadata } : undefined,
      extensions: row.extensions ? { ...row.extensions } : undefined,
    };
    if (row.content === "component") {
      return {
        ...common,
        content: "component",
        component: cloneComponent(row.component),
      };
    }
    if (row.content === "columns") {
      return {
        ...common,
        content: "columns",
        columns: row.columns.map(cloneColumn) as [
          ColumnNode,
          ...ColumnNode[],
        ],
      };
    }
    return { ...common, content: "empty" };
  };

  return {
    ...body,
    id: takeIdentifier(usedIdentifiers),
    properties: { ...body.properties },
    columns: body.columns.map(cloneColumn),
    mcpMetadata: body.mcpMetadata ? { ...body.mcpMetadata } : undefined,
    extensions: body.extensions ? { ...body.extensions } : undefined,
  };
}



export function createRowNode(
  children: readonly (ComponentNode | ColumnNode)[] = [],
  usedIdentifiers: Set<string> = new Set(),
): RowNode {
  const components = children.filter(
    (child): child is ComponentNode => child.kind === "component",
  );
  const columns = children.filter(
    (child): child is ColumnNode => child.kind === "column",
  );
  if (components.length > 1 || (components.length > 0 && columns.length > 0)) {
    throw new Error(
      "Aircraft H-3: a row cannot mix components and columns or contain multiple components.",
    );
  }
  if (components.length === 1) {
    return createComponentRowNode(components[0], usedIdentifiers);
  }
  if (columns.length) {
    return createColumnsRowNode(
      columns as [ColumnNode, ...ColumnNode[]],
      usedIdentifiers,
    );
  }
  return createEmptyRowNode(usedIdentifiers);
}
