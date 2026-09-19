import { create } from "zustand";
import type { SchemaValue } from "@/modules/aircraft-schema";
import {
  BodyNode,
  DroppedPaletteItem,
  RowHeight,
  cloneBody,
  countComponentsOfType,
  createColumnNode,
  createComponentNode,
  createEmptyBody,
  createRowNode,
  nextId,
  removeColumnDeep,
  removeRowDeep,
  updateColumnDeep,
  updateComponentDeep,
  updateRowDeep,
} from "@/modules/screens/layoutTree";

export type CanvasMode = "layout" | "trigger-graph";
export type ScreenContext = string;

export interface EditorScreen {
  readonly id: string;
  name: string;
  description: string;
  context: ScreenContext;
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
  selection: Selection;

  setActiveScreen: (screenId: string) => void;
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
  setColumnWeight: (columnId: string, weight: number) => void;
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
  resetEditor: () => void;
};

function createInitialDocument(): Pick<
  EditorState,
  | "mode"
  | "screens"
  | "initialScreenId"
  | "activeScreenId"
  | "activeEvent"
  | "screenTrees"
  | "selection"
> {
  return {
    mode: "layout",
    screens: [
      {
        id: "home",
        name: "Home",
        description: "Pantalla principal",
        context: "interface",
      },
      {
        id: "login",
        name: "Login",
        description: "Inicio de sesión",
        context: "interface",
      },
    ],
    initialScreenId: "home",
    activeScreenId: "home",
    activeEvent: null,
    screenTrees: {
      home: createEmptyBody(),
      login: createEmptyBody(),
    },
    selection: null,
  };
}

function updateActiveBody(
  state: Pick<EditorState, "screenTrees" | "activeScreenId">,
  updater: (body: BodyNode) => BodyNode,
): Pick<EditorState, "screenTrees"> {
  const body = state.screenTrees[state.activeScreenId];
  return {
    screenTrees: {
      ...state.screenTrees,
      [state.activeScreenId]: updater(body),
    },
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  ...createInitialDocument(),

  setActiveScreen: (screenId) =>
    set((state) => {
      if (!state.screenTrees[screenId]) {
        return state;
      }
      return {
        activeScreenId: screenId,
        selection: null,
        mode: "layout",
        activeEvent: null,
      };
    }),

  createScreen: (name, description, context) => {
    const id = nextId("screen");
    set((state) => ({
      screens: [...state.screens, { id, name, description, context }],
      screenTrees: { ...state.screenTrees, [id]: createEmptyBody() },
      activeScreenId: id,
      selection: null,
    }));
    return id;
  },

  updateScreen: (screenId, updates) =>
    set((state) => ({
      screens: state.screens.map((screen) =>
        screen.id === screenId ? { ...screen, ...updates } : screen,
      ),
    })),

  duplicateScreen: (screenId) =>
    set((state) => {
      const source = state.screens.find((screen) => screen.id === screenId);
      const sourceTree = state.screenTrees[screenId];
      if (!source || !sourceTree) {
        return state;
      }
      const id = nextId("screen");
      return {
        screens: [
          ...state.screens,
          {
            ...source,
            id,
            name: `${source.name} copia`,
          },
        ],
        screenTrees: {
          ...state.screenTrees,
          [id]: cloneBody(sourceTree),
        },
        activeScreenId: id,
        selection: null,
      };
    }),

  removeScreen: (screenId) =>
    set((state) => {
      if (state.screens.length <= 1) {
        return state;
      }
      const screens = state.screens.filter((screen) => screen.id !== screenId);
      if (screens.length === state.screens.length) {
        return state;
      }
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
      state.screenTrees[screenId]
        ? { initialScreenId: screenId }
        : state,
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
    set((state) => ({
      ...updateActiveBody(state, (body) => ({
        ...body,
        columns: [...body.columns, createColumnNode()],
      })),
    })),

  addColumnToRow: (rowId) =>
    set((state) => {
      const newColumn = createColumnNode();
      return {
        ...updateActiveBody(state, (body) =>
          updateRowDeep(body, rowId, (row) => ({
            ...row,
            children: [...row.children, newColumn],
          })),
        ),
        selection: { kind: "column", id: newColumn.id },
      };
    }),

  removeColumn: (columnId) =>
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        removeColumnDeep(body, columnId),
      ),
      selection: null,
    })),

  setColumnWeight: (columnId, weight) =>
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        updateColumnDeep(body, columnId, (column) => ({
          ...column,
          weight,
        })),
      ),
    })),

  removeRow: (rowId) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => removeRowDeep(body, rowId)),
      selection: null,
    })),

  setRowWeight: (rowId, weight) =>
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        updateRowDeep(body, rowId, (row) => ({ ...row, weight })),
      ),
    })),

  setRowHeight: (rowId, height) =>
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        updateRowDeep(body, rowId, (row) => ({ ...row, height })),
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
    set((state) => ({
      ...updateActiveBody(state, (body) =>
        updateComponentDeep(body, componentId, (component) => ({
          ...component,
          properties: {
            ...component.properties,
            [property]: value,
          },
        })),
      ),
    })),

  dropOnColumn: (columnId, item) =>
    set((state) => {
      const body = state.screenTrees[state.activeScreenId];
      const displayIndex = countComponentsOfType(body, item.type) + 1;
      const component = createComponentNode(
        item.type,
        item.subtype,
        displayIndex,
        item.initialProperties,
      );
      const newRow = createRowNode([component]);
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
      const body = state.screenTrees[state.activeScreenId];
      const displayIndex = countComponentsOfType(body, item.type) + 1;
      const component = createComponentNode(
        item.type,
        item.subtype,
        displayIndex,
        item.initialProperties,
      );
      return {
        ...updateActiveBody(state, (currentBody) =>
          updateRowDeep(currentBody, rowId, (row) => ({
            ...row,
            children: [...row.children, component],
          })),
        ),
        selection: { kind: "component", id: component.id },
      };
    }),

  resetEditor: () => set(createInitialDocument()),
}));
