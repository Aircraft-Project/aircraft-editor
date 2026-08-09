import { create } from "zustand";
import {
  BodyNode,
  DroppedPaletteItem,
  RowHeight,
  countComponentsOfType,
  createColumnNode,
  createComponentNode,
  createEmptyBody,
  createRowNode,
  removeColumnDeep,
  removeRowDeep,
  updateColumnDeep,
  updateComponentDeep,
  updateRowDeep,
} from "@/modules/screens/layoutTree";

export type CanvasMode = "layout" | "trigger-graph";

export type Selection =
  | { kind: "component"; id: string }
  | { kind: "row"; id: string }
  | { kind: "column"; id: string }
  | null;

type EditorState = {
  mode: CanvasMode;
  activeScreenId: string;
  /** Evento activo cuando mode === "trigger-graph" (PRD §6.2). */
  activeEvent: { componentName: string; eventName: string } | null;
  screenTrees: Record<string, BodyNode>;
  selection: Selection;

  setActiveScreen: (screenId: string) => void;
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
  dropOnColumn: (columnId: string, item: DroppedPaletteItem) => void;
  dropOnRow: (rowId: string, item: DroppedPaletteItem) => void;
};

const initialScreenTrees: Record<string, BodyNode> = {
  home: createEmptyBody(),
  login: createEmptyBody(),
};

function updateActiveBody(
  state: Pick<EditorState, "screenTrees" | "activeScreenId">,
  updater: (body: BodyNode) => BodyNode
): Pick<EditorState, "screenTrees"> {
  const body = state.screenTrees[state.activeScreenId];
  return { screenTrees: { ...state.screenTrees, [state.activeScreenId]: updater(body) } };
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: "layout",
  activeScreenId: "home",
  activeEvent: null,
  screenTrees: initialScreenTrees,
  selection: null,

  setActiveScreen: (screenId) => set({ activeScreenId: screenId, selection: null, mode: "layout", activeEvent: null }),

  openTriggerGraph: (componentName, eventName) =>
    set({ mode: "trigger-graph", activeEvent: { componentName, eventName } }),

  backToLayout: () => set({ mode: "layout", activeEvent: null }),

  selectComponent: (id) => set({ selection: { kind: "component", id } }),
  selectRow: (id) => set({ selection: { kind: "row", id } }),
  selectColumn: (id) => set({ selection: { kind: "column", id } }),
  clearSelection: () => set({ selection: null }),

  addColumn: () =>
    set((state) => ({
      ...updateActiveBody(state, (body) => ({ ...body, columns: [...body.columns, createColumnNode()] })),
    })),

  addColumnToRow: (rowId) =>
    set((state) => {
      const newColumn = createColumnNode();
      return {
        ...updateActiveBody(state, (body) =>
          updateRowDeep(body, rowId, (row) => ({ ...row, children: [...row.children, newColumn] }))
        ),
        selection: { kind: "column", id: newColumn.id },
      };
    }),

  removeColumn: (columnId) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => removeColumnDeep(body, columnId)),
      selection: null,
    })),

  setColumnWeight: (columnId, weight) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => updateColumnDeep(body, columnId, (column) => ({ ...column, weight }))),
    })),

  removeRow: (rowId) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => removeRowDeep(body, rowId)),
      selection: null,
    })),

  setRowWeight: (rowId, weight) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => updateRowDeep(body, rowId, (row) => ({ ...row, weight }))),
    })),

  setRowHeight: (rowId, height) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => updateRowDeep(body, rowId, (row) => ({ ...row, height }))),
    })),

  renameComponent: (componentId, name) =>
    set((state) => ({
      ...updateActiveBody(state, (body) => updateComponentDeep(body, componentId, (component) => ({ ...component, name }))),
    })),

  dropOnColumn: (columnId, item) =>
    set((state) => {
      const body = state.screenTrees[state.activeScreenId];
      const displayIndex = countComponentsOfType(body, item.type) + 1;
      const component = createComponentNode(item.type, item.subtype, displayIndex);
      const newRow = createRowNode([component]);
      return {
        ...updateActiveBody(state, (b) => updateColumnDeep(b, columnId, (column) => ({ ...column, rows: [...column.rows, newRow] }))),
        selection: { kind: "component", id: component.id },
      };
    }),

  dropOnRow: (rowId, item) =>
    set((state) => {
      const body = state.screenTrees[state.activeScreenId];
      const displayIndex = countComponentsOfType(body, item.type) + 1;
      const component = createComponentNode(item.type, item.subtype, displayIndex);
      return {
        ...updateActiveBody(state, (b) => updateRowDeep(b, rowId, (row) => ({ ...row, children: [...row.children, component] }))),
        selection: { kind: "component", id: component.id },
      };
    }),
}));
