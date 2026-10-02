"use client";

import { create } from "zustand";
import type { SchemaValue } from "@/modules/aircraft-schema";
import {
  type BodyNode,
  type ColumnNode,
  type DroppedPaletteItem,
  type RowHeight,
  type RowNode,
  cloneBody,
  collectLayoutIdentifiers,
  countComponentsOfType,
  createAircraftIdentifier,
  createColumnNode,
  createComponentNode,
  createComponentRowNode,
  createEmptyBody,
  findComponent,
  removeColumnDeep,
  removeRowDeep,
  updateColumnDeep,
  updateComponentDeep,
  updateRowDeep,
} from "@/modules/screens/layoutTree";

export type CanvasMode = "layout" | "trigger-graph";
export type ScreenContext = "interface";

export interface EditorScreen {
  readonly id: string;
  name: string;
  description: string;
  destination: string;
  context: ScreenContext;
  mcpMetadata?: Readonly<Record<string, string>>;
  extensions?: Readonly<Record<string, SchemaValue>>;
}

export interface EditorCatalogItem {
  readonly id: string;
  name: string;
  destination: string;
  readonly context: "catalog-item";
  layout: BodyNode;
  mcpMetadata?: Readonly<Record<string, string>>;
  extensions?: Readonly<Record<string, SchemaValue>>;
}

export type Selection =
  | { kind: "component"; id: string }
  | { kind: "row"; id: string }
  | { kind: "column"; id: string }
  | null;

type EditorState = {
  mode: CanvasMode;
  screens: EditorScreen[];
  initialScreenId: string;
  activeScreenId: string;
  activeEvent: { componentName: string; eventName: string } | null;
  screenTrees: Record<string, BodyNode>;
  catalogItems: EditorCatalogItem[];
  activeCatalogItemId: string | null;
  selection: Selection;

  setActiveScreen: (screenId: string) => void;
  openCatalogItem: (catalogItemId: string) => void;
  closeCatalogItem: () => void;
  createScreen: (
    name: string,
    description: string,
    context: ScreenContext,
  ) => string;
  updateScreen: (
    screenId: string,
    updates: Partial<Omit<EditorScreen, "id">>,
  ) => void;
  duplicateScreen: (screenId: string) => void;
  removeScreen: (screenId: string) => void;
  setInitialScreen: (screenId: string) => void;

  openTriggerGraph: (componentName: string, eventName: string) => void;
  backToLayout: () => void;
  selectComponent: (id: string) => void;
  selectRow: (id: string) => void;
  selectColumn: (id: string) => void;
  clearSelection: () => void;

  addColumn: () => void;
  addColumnToRow: (rowId: string) => void;
  removeColumn: (columnId: string) => void;
  removeRow: (rowId: string) => void;
  setRowWeight: (rowId: string, weight: number | undefined) => void;
  setRowHeight: (rowId: string, height: RowHeight) => void;
  renameComponent: (componentId: string, name: string) => void;
  setComponentProperty: (
    componentId: string,
    property: string,
    value: SchemaValue,
  ) => void;
  dropOnColumn: (columnId: string, item: DroppedPaletteItem) => void;
  dropOnRow: (rowId: string, item: DroppedPaletteItem) => void;
  hydrateEditor: (document: {
    screens: readonly EditorScreen[];
    initialScreenId: string;
    activeScreenId: string;
    screenTrees: Readonly<Record<string, BodyNode>>;
    catalogItems: readonly EditorCatalogItem[];
  }) => void;
  resetEditor: () => void;
};

function addBodyIdentifiers(target: Set<string>, body: BodyNode): void {
  collectLayoutIdentifiers(body).forEach((identifier) => target.add(identifier));
}

function collectEditorIdentifiers(
  state: Pick<EditorState, "screens" | "screenTrees" | "catalogItems">,
): Set<string> {
  const identifiers = new Set(state.screens.map((screen) => screen.id));
  Object.values(state.screenTrees).forEach((body) =>
    addBodyIdentifiers(identifiers, body),
  );
  for (const item of state.catalogItems) {
    identifiers.add(item.id);
    addBodyIdentifiers(identifiers, item.layout);
  }
  return identifiers;
}

function createInitialDocument(): Pick<
  EditorState,
  | "mode"
  | "screens"
  | "initialScreenId"
  | "activeScreenId"
  | "activeEvent"
  | "screenTrees"
  | "catalogItems"
  | "activeCatalogItemId"
  | "selection"
> {
  const identifiers = new Set<string>();
  const homeId = createAircraftIdentifier(identifiers);
  identifiers.add(homeId);
  const homeBody = createEmptyBody(identifiers);
  addBodyIdentifiers(identifiers, homeBody);
  const loginId = createAircraftIdentifier(identifiers);
  identifiers.add(loginId);
  const loginBody = createEmptyBody(identifiers);
  return {
    mode: "layout",
    screens: [
      {
        id: homeId,
        name: "Home",
        description: "Pantalla principal",
        destination: "home",
        context: "interface",
      },
      {
        id: loginId,
        name: "Login",
        description: "Inicio de sesión",
        destination: "login",
        context: "interface",
      },
    ],
    initialScreenId: homeId,
    activeScreenId: homeId,
    activeEvent: null,
    screenTrees: {
      [homeId]: homeBody,
      [loginId]: loginBody,
    },
    catalogItems: [],
    activeCatalogItemId: null,
    selection: null,
  };
}

function getActiveBody(
  state: Pick<
    EditorState,
    "screenTrees" | "activeScreenId" | "catalogItems" | "activeCatalogItemId"
  >,
): BodyNode {
  const catalogItem = state.activeCatalogItemId
    ? state.catalogItems.find((item) => item.id === state.activeCatalogItemId)
    : undefined;
  return catalogItem?.layout ?? state.screenTrees[state.activeScreenId];
}

function updateActiveBody(
  state: Pick<
    EditorState,
    "screenTrees" | "activeScreenId" | "catalogItems" | "activeCatalogItemId"
  >,
  updater: (body: BodyNode) => BodyNode,
): Pick<EditorState, "screenTrees" | "catalogItems"> {
  if (state.activeCatalogItemId) {
    return {
      screenTrees: state.screenTrees,
      catalogItems: state.catalogItems.map((item) =>
        item.id === state.activeCatalogItemId
          ? { ...item, layout: updater(item.layout) }
          : item,
      ),
    };
  }

  return {
    catalogItems: state.catalogItems,
    screenTrees: {
      ...state.screenTrees,
      [state.activeScreenId]: updater(state.screenTrees[state.activeScreenId]),
    },
  };
}

export function isValidDestination(destination: string): boolean {
  return (
    destination.trim() === destination &&
    destination.length > 0 &&
    !destination.includes("/") &&
    !destination.includes("\\")
  );
}

function isVerticalCatalog(item: DroppedPaletteItem): boolean {
  return (
    item.type === "Catalog" &&
    String(item.initialProperties?.orientation ?? "vertical").toLowerCase() ===
      "vertical"
  );
}

function rowHasVerticalCatalog(row: RowNode): boolean {
  return (
    row.content === "component" &&
    row.component.type === "Catalog" &&
    String(row.component.properties.orientation ?? "vertical").toLowerCase() ===
      "vertical"
  );
}

function findContainingRow(
  body: BodyNode,
  componentId: string,
): RowNode | undefined {
  const visitColumn = (column: ColumnNode): RowNode | undefined => {
    for (const row of column.rows) {
      if (
        row.content === "component" &&
        row.component.id === componentId
      ) {
        return row;
      }
      if (row.content === "columns") {
        for (const child of row.columns) {
          const found = visitColumn(child);
          if (found) return found;
        }
      }
    }
    return undefined;
  };
  for (const column of body.columns) {
    const found = visitColumn(column);
    if (found) return found;
  }
  return undefined;
}

function isInsideScrollableColumn(
  body: BodyNode,
  targetId: string,
): boolean {
  const visitColumn = (
    column: ColumnNode,
    scrollableAncestor: boolean,
  ): boolean => {
    const scrollable =
      scrollableAncestor || column.properties.scrollable === true;
    if (column.id === targetId && scrollable) return true;
    for (const row of column.rows) {
      if (row.id === targetId && scrollable) return true;
      if (
        row.content === "component" &&
        row.component.id === targetId &&
        scrollable
      ) {
        return true;
      }
      if (row.content === "columns") {
        for (const child of row.columns) {
          if (visitColumn(child, scrollable)) return true;
        }
      }
    }
    return false;
  };
  return body.columns.some((column) => visitColumn(column, false));
}

function uniqueCopyName(base: string, screens: readonly EditorScreen[]): string {
  const names = new Set(screens.map((screen) => screen.name));
  let index = 1;
  let candidate = `${base} copia`;
  while (names.has(candidate)) {
    index += 1;
    candidate = `${base} copia ${index}`;
  }
  return candidate;
}

export const useEditorStore = create<EditorState>((set) => ({
  ...createInitialDocument(),

  setActiveScreen: (screenId) =>
    set((state) => {
      if (!state.screenTrees[screenId]) return state;
      return {
        activeScreenId: screenId,
        activeCatalogItemId: null,
        selection: null,
        mode: "layout",
        activeEvent: null,
      };
    }),

  openCatalogItem: (catalogItemId) =>
    set((state) =>
      state.catalogItems.some((item) => item.id === catalogItemId)
        ? {
            activeCatalogItemId: catalogItemId,
            selection: null,
            mode: "layout",
            activeEvent: null,
          }
        : state,
    ),
  closeCatalogItem: () => set({ activeCatalogItemId: null, selection: null }),

  createScreen: (name, description, context) => {
    let createdId = "";
    set((state) => {
      const normalizedName = name.trim();
      if (
        context !== "interface" ||
        !normalizedName ||
        state.screens.some((screen) => screen.name === normalizedName)
      ) {
        return state;
      }
      const identifiers = collectEditorIdentifiers(state);
      const id = createAircraftIdentifier(identifiers);
      identifiers.add(id);
      createdId = id;
      return {
        screens: [
          ...state.screens,
          {
            id,
            name: normalizedName,
            description,
            destination: id,
            context: "interface",
          },
        ],
        screenTrees: {
          ...state.screenTrees,
          [id]: createEmptyBody(identifiers),
        },
        activeScreenId: id,
        selection: null,
      };
    });
    return createdId;
  },

  updateScreen: (screenId, updates) =>
    set((state) => {
      if (updates.context && updates.context !== "interface") return state;
      if (
        updates.name !== undefined &&
        (!updates.name.trim() ||
          state.screens.some(
            (screen) =>
              screen.id !== screenId && screen.name === updates.name,
          ))
      ) {
        return state;
      }
      if (
        updates.destination !== undefined &&
        (!isValidDestination(updates.destination) ||
          state.screens.some(
            (screen) =>
              screen.id !== screenId &&
              screen.destination === updates.destination,
          ) ||
          state.catalogItems.some(
            (item) => item.destination === updates.destination,
          ))
      ) {
        return state;
      }
      return {
        screens: state.screens.map((screen) =>
          screen.id === screenId ? { ...screen, ...updates } : screen,
        ),
      };
    }),

  duplicateScreen: (screenId) =>
    set((state) => {
      const source = state.screens.find((screen) => screen.id === screenId);
      const sourceTree = state.screenTrees[screenId];
      if (!source || !sourceTree) return state;
      const identifiers = collectEditorIdentifiers(state);
      const id = createAircraftIdentifier(identifiers);
      identifiers.add(id);
      return {
        screens: [
          ...state.screens,
          {
            ...source,
            id,
            name: uniqueCopyName(source.name, state.screens),
            destination: id,
            mcpMetadata: source.mcpMetadata
              ? { ...source.mcpMetadata }
              : undefined,
            extensions: source.extensions
              ? { ...source.extensions }
              : undefined,
          },
        ],
        screenTrees: {
          ...state.screenTrees,
          [id]: cloneBody(sourceTree, identifiers),
        },
        activeScreenId: id,
        selection: null,
      };
    }),

  removeScreen: (screenId) =>
    set((state) => {
      if (state.screens.length <= 1) return state;
      const screens = state.screens.filter((screen) => screen.id !== screenId);
      if (screens.length === state.screens.length) return state;
      const screenTrees = { ...state.screenTrees };
      delete screenTrees[screenId];
      const fallbackId =
        state.activeScreenId === screenId
          ? screens[0].id
          : state.activeScreenId;
      return {
        screens,
        screenTrees,
        activeScreenId: fallbackId,
        initialScreenId:
          state.initialScreenId === screenId
            ? screens[0].id
            : state.initialScreenId,
        selection: null,
      };
    }),

  setInitialScreen: (screenId) =>
    set((state) =>
      state.screenTrees[screenId] ? { initialScreenId: screenId } : state,
    ),

  openTriggerGraph: (componentName, eventName) =>
    set({
      mode: "trigger-graph",
      activeEvent: { componentName, eventName },
    }),

  backToLayout: () => set({ mode: "layout", activeEvent: null }),
  selectComponent: (id) => set({ selection: { kind: "component", id } }),
  selectRow: (id) => set({ selection: { kind: "row", id } }),
  selectColumn: (id) => set({ selection: { kind: "column", id } }),
  clearSelection: () => set({ selection: null }),

  addColumn: () =>
    set((state) => {
      const body = getActiveBody(state);
      const identifiers = collectEditorIdentifiers(state);
      const column = createColumnNode(identifiers);
      return {
        ...updateActiveBody(state, () => ({
          ...body,
          columns: [...body.columns, column],
        })),
      };
    }),

  addColumnToRow: (rowId) =>
    set((state) => {
      const body = getActiveBody(state);
      const identifiers = collectEditorIdentifiers(state);
      const newColumn = createColumnNode(identifiers);
      let changed = false;
      const nextBody = updateRowDeep(body, rowId, (row) => {
        if (row.content === "component") return row;
        changed = true;
        return row.content === "columns"
          ? {
              ...row,
              columns: [...row.columns, newColumn] as [
                ColumnNode,
                ...ColumnNode[],
              ],
            }
          : { ...row, content: "columns", columns: [newColumn] };
      });
      return changed
        ? {
            ...updateActiveBody(state, () => nextBody),
            selection: { kind: "column", id: newColumn.id },
          }
        : state;
    }),

  removeColumn: (columnId) =>
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        removeColumnDeep(body, columnId),
      ),
      selection: null,
    })),

  removeRow: (rowId) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => removeRowDeep(body, rowId)),
      selection: null,
    })),

  setRowWeight: (rowId, weight) =>
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        updateRowDeep(body, rowId, (row) => {
          if (weight === undefined && rowHasVerticalCatalog(row)) return row;
          const next = { ...row };
          delete next.height;
          delete next.weight;
          return weight === undefined
            ? { ...next, height: "wrap_content" }
            : { ...next, weight };
        }),
      ),
    })),

  setRowHeight: (rowId, height) =>
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        updateRowDeep(body, rowId, (row) => {
          if (rowHasVerticalCatalog(row)) return row;
          const next = { ...row };
          delete next.height;
          delete next.weight;
          return { ...next, height };
        }),
      ),
    })),

  renameComponent: (componentId, name) =>
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        updateComponentDeep(body, componentId, (component) => ({
          ...component,
          name,
        })),
      ),
    })),

  setComponentProperty: (componentId, property, value) =>
    set((state) => {
      const body = getActiveBody(state);
      const component = findComponent(body, componentId);
      const becomesVerticalCatalog =
        component?.type === "Catalog" &&
        property === "orientation" &&
        String(value).toLowerCase() === "vertical";
      if (
        becomesVerticalCatalog &&
        isInsideScrollableColumn(body, componentId)
      ) {
        return state;
      }
      let nextBody = updateComponentDeep(
        body,
        componentId,
        (currentComponent) => ({
          ...currentComponent,
          properties: {
            ...currentComponent.properties,
            [property]: value,
          },
        }),
      );
      if (becomesVerticalCatalog) {
        const row = findContainingRow(nextBody, componentId);
        if (row) {
          nextBody = updateRowDeep(nextBody, row.id, (currentRow) => {
            const next = { ...currentRow };
            delete next.height;
            return { ...next, weight: currentRow.weight ?? 1 };
          });
        }
      }
      return updateActiveBody(state, () => nextBody);
    }),

  dropOnColumn: (columnId, item) =>
    set((state) => {
      const body = getActiveBody(state);
      if (isVerticalCatalog(item) && isInsideScrollableColumn(body, columnId)) {
        return state;
      }
      const identifiers = collectEditorIdentifiers(state);
      const displayIndex = countComponentsOfType(body, item.type) + 1;
      const component = createComponentNode(
        item.type,
        item.subtype,
        displayIndex,
        item.initialProperties,
        identifiers,
      );
      const row = createComponentRowNode(component, identifiers);
      const newRow = isVerticalCatalog(item)
        ? { ...row, height: undefined, weight: 1 }
        : row;
      return {
        ...updateActiveBody(state, (currentBody) =>
          updateColumnDeep(currentBody, columnId, (column) => ({
            ...column,
            rows: [...column.rows, newRow],
          })),
        ),
        selection: { kind: "component", id: component.id },
      };
    }),

  dropOnRow: (rowId, item) =>
    set((state) => {
      const body = getActiveBody(state);
      if (
        isVerticalCatalog(item) &&
        isInsideScrollableColumn(body, rowId)
      ) {
        return state;
      }
      const identifiers = collectEditorIdentifiers(state);
      const displayIndex = countComponentsOfType(body, item.type) + 1;
      const component = createComponentNode(
        item.type,
        item.subtype,
        displayIndex,
        item.initialProperties,
        identifiers,
      );
      let changed = false;
      const nextBody = updateRowDeep(body, rowId, (row) => {
        if (row.content !== "empty") return row;
        changed = true;
        const next = {
          ...row,
          content: "component" as const,
          component,
        };
        if (!isVerticalCatalog(item)) return next;
        const weighted = { ...next };
        delete weighted.height;
        return { ...weighted, weight: 1 };
      });
      return changed
        ? {
            ...updateActiveBody(state, () => nextBody),
            selection: { kind: "component", id: component.id },
          }
        : state;
    }),

  hydrateEditor: (document) =>
    set({
      mode: "layout",
      screens: document.screens.map((screen) => ({ ...screen })),
      initialScreenId: document.initialScreenId,
      activeScreenId: document.activeScreenId,
      activeEvent: null,
      screenTrees: { ...document.screenTrees },
      catalogItems: document.catalogItems.map((item) => ({ ...item })),
      activeCatalogItemId: null,
      selection: null,
    }),
  resetEditor: () => set(createInitialDocument()),
}));
